# ZhiPanda V2 production cutover runbook

Status: prepared by #332; execution belongs to #333 after managed-staging acceptance.

## Preconditions

Do not begin the production freeze until all are true:

- #332 managed staging is accepted against a distinct staging Supabase project and stable Vercel Nest project.
- Final migration plan has zero blockers and the full rebuild duration fits the approved freeze window.
- One candidate V2 release can be built and sealed from migrated V2 authority.
- V1 publication/business writes, async pumps and long-running batch jobs have an explicit freeze mechanism.
- Supabase production backup/PITR state and restore point are recorded below.
- Cloudflare DNS current records, intended Vercel records, TTLs and rollback values are recorded below.
- The final legacy production source commit/tag is recorded.

## Required cutover values

These fields are operational inputs, not defaults. Never infer them from source code.

| Value | Required before cutover | Current repository knowledge |
|---|---|---|
| legacy source tag/commit | yes | create immediately before destructive legacy cleanup |
| Vercel Web stable project hostname | yes | external |
| Vercel Nest API stable project hostname | yes | external |
| Supabase production project/ref + region | yes | external |
| Supabase transaction-pool endpoint | yes | external |
| Supabase backup/PITR restore point | yes | external |
| `zhipanda.com` current DNS record + TTL | yes | currently routes to Cloudflare OpenNext Web Worker `panda-atlas-web`; exact DNS value external |
| `www.zhipanda.com` current DNS record + TTL | yes | currently routes to Cloudflare OpenNext Web Worker `panda-atlas-web`; exact DNS value external |
| `api.zhipanda.com` current DNS record + TTL | yes | currently routes to Cloudflare Worker `panda-atlas-api`; exact DNS value external |
| Web rollback DNS value | yes | exact pre-cutover `zhipanda.com` / `www` values captured immediately before Step A |
| API rollback DNS value | yes | exact pre-cutover `api.zhipanda.com` value captured immediately before Step B |

## Freeze and final migration

1. Announce and begin the bounded V1 write/publication/job freeze.
2. Confirm no V2 production business writes are enabled.
3. Capture the final legacy source commit/tag and the production DB restore point.
4. Run `migrate-v1-to-v2.mjs` in plan mode against production; require zero blockers.
5. Run the deterministic full migration under migration credentials.
6. Run `verify-v1-to-v2.mjs`; require all compact invariants to pass.
7. Record migration duration. Do not introduce a delta pass unless this measured production-scale run exceeds the approved freeze window.
8. Build and seal the candidate V2 release; do not source anything from D1.
9. Verify the V2 Web against the stable Vercel API hostname before public routing changes.

## Step A — Web cutover

1. Change `zhipanda.com` and `www.zhipanda.com` from the captured Cloudflare OpenNext values to the Vercel Web values.
2. Keep `api.zhipanda.com` on the legacy Worker.
3. Keep V2 Web configured to the stable Vercel API project hostname, not the canonical API hostname.
4. Validate critical public journeys, auth, favorites/collections/check-ins/seen, contribution, notification inbox/preferences, games, admin review/curation/publication, R2 media and release-scoped public reads.
5. If Step A fails before the Web rollback window closes, restore the exact captured Web DNS values. Database authority remains frozen; do not reopen mixed V1/V2 writes.
6. Close the legacy-Web rollback window only after acceptance.

## Step B — API cutover

1. Change `api.zhipanda.com` from the captured Cloudflare Worker value to the Vercel Nest API value.
2. V2 Web still calls the stable Vercel API project hostname during this verification window.
3. Validate `/health`, `/ready`, Supabase Auth/capabilities, Publication/PublicRead, Outbox/PGMQ pumps, Notification, Privacy/Audit boundaries, R2 access and observability.
4. If Step B fails before the API rollback window closes, restore the exact captured API DNS value while writes remain frozen.
5. Close the legacy-API rollback window only after acceptance.

## V2 commit point

The commit point is explicit and irreversible with respect to legacy runtime rollback:

1. Declare V2 the only runtime authority.
2. Close Worker/D1/FastAPI rollback before enabling any new V2 authoritative write.
3. Reopen V2 business writes, publication and async execution.
4. Reconfigure V2 Web from the temporary stable Vercel API hostname to `https://api.zhipanda.com`.
5. From this point, rollback is V2-to-V2 (previous known-good Vercel deployment, forward fix, or database restore for genuine corruption), never routing back to V1.

## Immediate post-cutover work

Proceed with #333 legacy retirement after rollback windows close:

- retire OpenNext Web runtime;
- retire Worker/D1 API projection runtime;
- remove FastAPI online/runtime compatibility paths and serverless-closure tooling;
- retain Cloudflare DNS/R2, Vercel, Supabase and GitHub Actions;
- retain the legacy source tag and archived audit/recovery evidence for forensic purposes.
