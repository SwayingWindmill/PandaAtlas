# ZhiPanda hybrid production deployment

This deployment keeps the public delivery plane on Cloudflare while running the authoritative FastAPI, PostgreSQL/PostGIS, Supabase Auth, and private Storage on one controlled Linux server.

## Architecture

```text
Cloudflare Workers / CDN
  ├─ public web
  └─ public read Worker API + D1/R2

Cloudflare Tunnel (outbound-only connector)
  ├─ api.example.com       -> http://api:8000
  ├─ auth.example.com      -> http://kong:8000
  ├─ admin-api.example.com -> http://api:8000  [Access protected]
  └─ studio.example.com    -> http://studio:3000 [Access protected]

Private Docker network
  ├─ FastAPI
  ├─ Supabase Kong, Auth, REST, Storage, Realtime, Studio
  ├─ PostgreSQL/PostGIS
  └─ Supavisor
```

The production overlay removes the upstream Kong and Supavisor host port bindings. FastAPI also has no host port. `cloudflared` is the only application ingress and creates outbound connections to Cloudflare.

## Host requirements

- Linux server with Docker Engine and Docker Compose 2.24.4 or newer;
- Git, OpenSSL, and Node.js 20 or newer;
- a domain managed by Cloudflare and a remotely managed Cloudflare Tunnel;
- at least 4 GB RAM and 40 GB SSD; 4 CPU cores, 8 GB RAM, and 80 GB SSD are the recommended production baseline;
- a backup target outside the Docker data directory, plus an off-host copy process.

Do not use the Supabase CLI local stack (`supabase start`) as the production runtime.

## 1. Bootstrap the pinned Supabase source

From the repository root:

```bash
npm ci
npm run check:hybrid-production
npm run hybrid:bootstrap
```

The bootstrap command sparse-fetches the upstream Supabase `docker/` directory at the commit recorded in `supabase.ref`. It writes the generated runtime to:

```text
.hybrid-production/supabase
```

The runtime directory is ignored by Git. The committed overlay and environment supplement are copied into it.

## 2. Generate Supabase keys

Change to the generated runtime:

```bash
cd .hybrid-production/supabase
sh utils/generate-keys.sh --update-env
sh utils/add-new-auth-keys.sh --update-env
```

The second command enables asymmetric Auth signing keys and opaque Supabase API keys in the copied upstream Compose file.

Never copy generated keys into tracked files, shell history, issue comments, or CI logs.

## 3. Configure `.env`

Edit `.hybrid-production/supabase/.env`.

Required upstream values include:

```dotenv
SUPABASE_PUBLIC_URL=https://auth.example.com
API_EXTERNAL_URL=https://auth.example.com/auth/v1
SITE_URL=https://www.example.com
ADDITIONAL_REDIRECT_URLS=https://www.example.com/**
```

Configure production SMTP before enabling email signup, recovery, or invitations. Configure OAuth providers in the upstream Auth environment only after their callback URLs use the production Auth hostname.

Replace every `[REDACTED_SECRET]` in the appended ZhiPanda block. Use independent random values for the FastAPI administrator token and each signing key. Set `ZHIPANDA_REPO_ROOT` and `ZHIPANDA_BACKUP_DIR` to absolute paths on the server.

The service-role and tunnel credentials remain backend-only. Never expose them through `NEXT_PUBLIC_*` variables.

Configure the Cloudflare-hosted web runtime with the repository's actual variables:

```dotenv
# Keep public catalogue and map reads on the Cloudflare Worker projection.
NEXT_PUBLIC_API_BASE_URL=https://public-api.example.com

# Server-only Next.js calls that require the authoritative FastAPI runtime.
API_BASE_URL=https://api.example.com

# Browser-safe Supabase endpoint and opaque publishable key.
NEXT_PUBLIC_SUPABASE_URL=https://auth.example.com
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Do not point `NEXT_PUBLIC_API_BASE_URL` at the Access-protected administrator hostname. Do not put `SUPABASE_SECRET_KEY`, `SERVICE_ROLE_KEY`, `ADMIN_API_TOKEN`, or the tunnel token in the web deployment.

## 4. Configure Cloudflare Tunnel

Create one remotely managed tunnel and copy its token into the untracked runtime `.env` as `CLOUDFLARE_TUNNEL_TOKEN`.

Add these public hostname routes in Cloudflare Zero Trust:

| Hostname | Tunnel service | Policy |
| --- | --- | --- |
| `api.example.com` | `http://api:8000` | Public API; block `/api/v1/admin` and `/api/v1/admin/*` with WAF |
| `auth.example.com` | `http://kong:8000` | Public Supabase API paths only; block dashboard and management paths |
| `admin-api.example.com` | `http://api:8000` | Cloudflare Access required; FastAPI bearer token still required |
| `studio.example.com` | `http://studio:3000` | Cloudflare Access required |

On the public Supabase hostname, allow only the application surfaces that are actually enabled, normally `/auth/v1/*`, `/rest/v1/*`, `/graphql/v1/*`, `/storage/v1/*`, `/realtime/v1/*`, and `/functions/v1/*`. Block the Kong dashboard root, `/pg/*`, and any unused surface. Apply rate limits to login, signup, recovery, and token endpoints.

Cloudflare Access is defense in depth. It does not replace `ADMIN_API_TOKEN`, workflow actor tokens, Supabase JWT validation, or database authorization.

Recommended origin firewall policy:

- allow established traffic and outbound DNS, HTTPS, and Cloudflare Tunnel connectivity;
- allow SSH only from a trusted management network or use a separate Zero Trust SSH route;
- deny public inbound access to PostgreSQL, Supavisor, Kong, Studio, FastAPI, and the Docker daemon.

For tunnel high availability, run a second connector with the same remotely managed tunnel token on another host after the single-host deployment is stable.

## 5. Preflight and start

From the repository root:

```bash
npm run hybrid:preflight
npm run hybrid:config
npm run hybrid:up
```

`hybrid:up` performs these controlled steps:

1. starts the pinned upstream Supabase services and waits for health;
2. builds the FastAPI migration and application image;
3. creates a checksummed pre-migration PostgreSQL backup;
4. runs unapplied forward migrations under a PostgreSQL advisory lock;
5. records migration versions and repository checksums in `supabase_migrations.schema_migrations`;
6. starts FastAPI and waits for `/health`;
7. starts `cloudflared`.

A previously applied migration whose recorded name or checksum differs from the repository is a hard failure. A restored legacy migration history without checksums also fails closed. After auditing the restored history, set `MIGRATION_ADOPT_LEGACY_HISTORY=true` for one migration run to attach the current names and checksums, then immediately return it to `false`. Never edit an already-applied SQL file to bypass the check.

## 6. Operations

```bash
npm run hybrid:status
npm run hybrid:logs
npm run hybrid:backup
npm run hybrid:down
```

`hybrid:backup` enters a short maintenance window: it stops `cloudflared`, FastAPI, Storage, and imgproxy when they are running; creates the backup set; then restores exactly those services. It creates:

- a PostgreSQL custom-format dump and SHA-256 sidecar;
- a compressed Supabase Storage archive and SHA-256 sidecar.

Both outputs are written through `.partial` files and renamed only after their underlying command succeeds. The backup directory must be outside `.hybrid-production/supabase`. Copy every successful backup to a different machine or storage provider. A backup that has not passed a restore drill is not accepted recovery evidence.

## Restore outline

Do not restore over a running production database.

1. stop the application profile and block tunnel traffic;
2. create a fresh, pinned Supabase runtime;
3. verify the dump and archive SHA-256 files;
4. restore PostgreSQL with `pg_restore` into the fresh database;
5. restore the Storage directory while Storage is stopped;
6. run `hybrid:preflight` and the existing PostgreSQL attachment recovery checks;
7. start the application profile and verify login, admin authorization, public reads, writes, and release publication;
8. switch Cloudflare Tunnel traffic only after acceptance passes.

## Upgrades

The upstream Supabase source is immutable per repository commit. To upgrade:

1. create and verify fresh backups;
2. update `supabase.ref` in a dedicated pull request;
3. review the upstream Docker changelog and image changes;
4. bootstrap a separate runtime with `--runtime <new-path>`;
5. apply the documented Supabase database upgrade procedure when the PostgreSQL major version changes;
6. restore or migrate data into the new runtime;
7. execute recovery and application acceptance checks;
8. move tunnel traffic to the new runtime;
9. retain the previous runtime until rollback is no longer required.

Do not use `--force` against a live runtime containing database or Storage data.
