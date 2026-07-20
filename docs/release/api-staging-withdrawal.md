# API Staging withdrawal drill

This runbook owns the independent Cloudflare API Staging environment used for Public Release withdrawal evidence. It must not be used against Production resources.

## Open-source and dependency decision

The drill reuses the repository's existing Cloudflare Workers SDK/Wrangler and Playwright toolchain. Miniflare is suitable for local workerd simulation but cannot prove remote D1, R2, workers.dev routing, caching, or deployment identity. Schemathesis would add OpenAPI property-testing and Hypothesis dependencies that are unnecessary for this directed release-withdrawal path. No dependency is added by this slice.

## Isolated resources

The only allowed identities are:

- Worker: `panda-atlas-api-staging`
- D1: `panda-atlas-staging`
- media R2: `panda-atlas-media-staging`
- geo R2: `panda-atlas-geo-staging`
- route surface: the Worker account's `workers.dev` hostname only
- environment: `APP_ENV=staging`

`services/worker-api/wrangler.staging.jsonc` declares these bindings. `scripts/release/api-staging-withdrawal.mjs` rejects the Production Worker name, D1 name, Production D1 UUID, Production R2 bucket names, custom routes, non-HTTPS URLs, and any URL that is not the exact Staging Worker on `workers.dev`.

The provisioned D1 UUID is part of the reviewed configuration. A zero UUID is a non-executable placeholder and is rejected by every write action.

## Commands

Generate a read-only plan:

```bash
npm run staging:api:plan
```

Bootstrap or restore the isolated Staging state:

```bash
npm run staging:api:bootstrap
```

Deploy only the Staging Worker:

```bash
npm run staging:api:deploy
```

Run the withdrawal checks against an already deployed Staging Worker:

```bash
npm run staging:api:drill -- --base-url https://panda-atlas-api-staging.<account>.workers.dev
```

Run bootstrap, deploy, and the complete drill in one operation:

```bash
npm run staging:api:full
```

All actions except `plan` contain an explicit `--execute`. Calling the Node entry point directly without `--execute` fails before any remote command.

## Bootstrap order

The bootstrap path performs these operations after strict config validation:

1. Drop only `current_public_release`, `current_public_records`, and the four versioned Public Release tables in Staging.
2. Remove only the Public Release migration journal entries and replay the tracked migration runner. Legacy archive tables are not reset.
3. Import immutable baseline release `2026.07.18.1` and verify pointer, release row, record count, API panda count, and zero withdrawals.
4. Use the guarded activation implementation to activate `2026.07.20.1` and then `2026.07.20.2`.
5. Read the 14 reviewed WebP derivative objects from Production R2, verify byte size and SHA-256 against reviewed batch `2026.07.20.2`, upload them to Staging R2, download them again, and verify the same bytes and digest.

Production R2 is read-only in this path. Production D1 and the Production Worker are not migration, deployment, or mutation targets.

## Evidence sequence

The complete drill records:

1. Git commit SHA and Staging config SHA-256.
2. Staging Worker deployment URL and Cloudflare Version ID.
3. Production current-release read-only canary before the drill.
4. Staging baseline: current release `2026.07.20.2`, schema `1.2.0`, migration `0007`, four Ueno profiles, reviewed media, parentage, WebP MIME, and immutable cache policy.
5. Append-only Ri Ri entity withdrawal. The current release remains available, Ri Ri returns 404, Shin Shin remains available, and immutable Ri Ri release/history rows remain in D1.
6. Deletion of all Ri Ri derivatives from Staging R2. Both reviewed derivative URLs return 404 while both Shin Shin derivatives remain 200.
7. Append-only whole-release withdrawal. The release pointer and immutable rows remain, while the current release and public-data endpoints return 410.
8. Production current-release read-only canary after the drill.

The JSON report is written below `.release-gate/` unless `--report` supplies another path. Failed operations also write their identity, completed steps, and error text.

A completed drill intentionally leaves the Staging release withdrawn. Re-run `npm run staging:api:bootstrap` to restore the isolated environment for another drill.

## Retry policy

The runner uses a bounded retry only where repeating the operation is provably safe:

- the migration runner may retry recognized transport failures because the D1 migration journal skips every committed migration;
- Production R2 reads and Staging R2 put/get verification may retry because the reviewed object key and bytes are immutable and an identical put is idempotent;
- the workers.dev baseline may retry before any withdrawal write, allowing deployment propagation to settle.

Retries are limited, use increasing delays, and recognize transport failures such as fetch failed, connection resets, timeouts, DNS retry conditions, and Undici socket/connect errors. Manifest, hash, release-state, SQL, and business-rule failures are not retryable. Reset, seed import, release activation, Worker deployment, entity withdrawal, and whole-release withdrawal are not blindly retried; inspect their persisted state before resuming.

WRANGLER_LOG=debug writes diagnostic text to stdout and can corrupt commands whose callers parse JSON output. Use it for an isolated probe or inspect Wrangler's log file; do not enable it around the JSON-parsing migration or activation runners.

## Frontend architecture limitation

Localized Atlas profile pages currently consume build-time Public Release data from `apps/web/features/public-content/public-release.ts`. They do not dynamically read D1. This API drill therefore does **not** claim that an entity or whole-release D1 withdrawal automatically changes an already built frontend profile.

Frontend Staging browser evidence requires a real immutable frontend release that represents the withdrawn state, or a separately reviewed architecture change. A mock response is not acceptable evidence for that linkage.

## Failure policy

Stop and record BLOCKED when any of these occur:

- config identity does not match all four Staging resource names;
- a Production UUID, bucket, route, or hostname is present;
- migration journal or release counts do not verify;
- media bytes or SHA-256 differ before or after copy;
- the deployment output does not include both the workers.dev URL and Version ID;
- any required version header is absent;
- unrelated data becomes hidden during entity withdrawal;
- withdrawn media remains available;
- whole-release reads do not return 410;
- the Production canary changes.

Do not weaken a failed assertion, switch to Production, or replace remote Staging evidence with a local mock.
