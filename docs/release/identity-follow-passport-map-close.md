# Secure identity, Follow, and private Passport map-close

Issue #181 is the final integration gate for parent map #172. It verifies the combined delivery from #177, #178, #179, and #180 rather than introducing a second identity or engagement implementation.

## Authoritative commands

Run the reproducible map-close gate from a clean checkout:

```bash
npm ci
npm run release:map-close
```

The gate sets deterministic browser-build endpoints, executes the full default release gate, then adds identity/capability, Follow, consent, private Passport, admin-shell, public-bundle, browser-write, and legacy Saved checks.

Run the fresh local Supabase foundation and destructive recovery verification with Docker available:

```bash
npm run infra:start
npm run infra:reset
npm run infra:preflight
RUN_REAL_DB_TESTS=1 DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres REAL_DB_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres \
  uv run --isolated --directory services/api --frozen --extra dev pytest -q tests/integration/test_engagement_real_db.py
DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres \
  npm run drill:identity-engagement-recovery
npm run infra:stop
```

The GitHub `Supabase reset and identity recovery` job runs the same start, reset, preflight, real-database test, recovery drill, and stop sequence on a clean checkout.

## Evidence

The gate writes reviewable evidence under `.release-gate/`:

- `default.json` and `default.md`: full release-gate result.
- `map-close.json` and `map-close.md`: identity/engagement integration result.
- `secure-engagement-boundary.json`: public bundle, admin header, browser-write, and legacy Saved audit.
- `identity-engagement-recovery.json`: deletion, retry, fail-closed, and outer-transaction restore evidence.
- `map-close-manifest.json`: commit-bound SHA-256 inventory of JSON evidence.
- `map-close-manifest.sha256`: digest for the manifest itself.

CI uploads separate evidence artifacts for the authoritative map-close gate, the fresh Supabase foundation job, and an explicitly dispatched extended gate.

## Security invariants

- Browser code cannot write directly to `identity.*`, `engagement.*`, or public business tables.
- Public production chunks cannot contain React-admin, `ra-core`, or Material UI administration runtime.
- `/admin` publishes `noindex` metadata and sends `Cache-Control: no-store` plus `X-Robots-Tag: noindex`.
- Legacy anonymous Saved Panda keys are deleted locally and are never migrated into account Follow state.
- Engagement commands re-check account state inside the write transaction.
- Private account engagement rows are deleted once; an identical idempotency key replays the original result without duplicating audit or outbox evidence.
- Hashed anonymous Follow history remains available for aggregate facts after private data deletion.

## Rollback

The operational rollback order is:

1. Set `ENGAGEMENT_ENABLED=false` to make Follow, consent, and Passport commands return the safe not-found boundary before database access.
2. Set `ADMIN_SHELL_ENABLED=false` to withdraw the staff shell independently of account identity.
3. Set `IDENTITY_AUTH_ENABLED=false` only when identity session endpoints must also be withdrawn.
4. Set `NEXT_PUBLIC_ENGAGEMENT_ENABLED=false` and rebuild the Web application to remove public Follow UI.
5. Preserve migrations and audit/outbox evidence; do not recreate anonymous Saved Panda state.

Rollback tests require the disabled API surfaces to return the same generic 404 response and require deleted accounts to remain fail-closed.
