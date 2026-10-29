# Production release and rollback

Production changes reach Cloudflare only through the `Production Deploy` workflow (`.github/workflows/production-deploy.yml`). [Deployment runtime status](../deployment/runtime-status.md) describes the topology this runbook acts on.

## Release

1. Merge the pull request into `main`. If it touches the Web app, the API, the API client, a migration or the root manifests, the workflow starts automatically; otherwise run it with **Run workflow** on `main`.
2. Wait for the `build` job. It builds both Workers from that commit and boots each built Worker in workerd.
3. Approve the `production` Environment deployment in the workflow run. The job:
   1. applies every pending migration in `infra/supabase/migrations` with `supabase db push`;
   2. deploys the API Worker, then the Web Worker, each version tagged with the first 12 characters of the commit;
   3. probes `api.zhipanda.com/health`, `/ready` and `www.zhipanda.com/zh`.
4. Run the `Production Probe` workflow once by hand and confirm it passes.

A failed step stops the later ones. Migrations run while the previous API still serves traffic, and the new API may briefly serve the previous Web Worker, which is why both directions must stay compatible (below). Re-run the job once the cause is fixed, or roll the Worker back.

## Publish a content release

Public pages and the API read the **active content release**, an immutable snapshot of the database, not the live tables. Merged data (a content migration, curated records) appears only after a release that includes it is built, sealed and activated. Production serves no staff console, so releases go through the `release.build` and `release.publish` operations of the **Bounded Batch Operations** workflow ([interface](../architecture/batch-workflow-interfaces.md)).

1. **Write the manifest.** In a pull request, add `data/release-manifests/<version>.json` ([contract](../../contracts/release-manifest.v1.json)): a new version such as `2026.10.26.1`, `"action": "publish"` and a reason naming what the release brings. Merge it, and first deploy and migrate whatever the release must include.
2. **Build.** Run the workflow on `main` with operation `release.build`, that manifest path, **execute** checked and the pull request as change reference, then approve the `production-batch` environment. The job builds the release without making it public and writes its counts and changes against the current release to the job summary; the `protected-batch-result-*` artifact holds every changed resource. A repeated run reports the same release again.
3. **Review** the summary: the changes should be what the release is for, and nothing else should be added or removed.
4. **Publish.** Run the workflow again with operation `release.publish` and the same manifest. After approval it seals and activates that exact release, then waits until `https://api.zhipanda.com/api/v2/release` reports the version. Run `Production Probe` once afterwards.

**Roll back** with a manifest whose `version` is the earlier sealed release and `"action": "rollback"`, published through `release.publish`; it only moves the active-release pointer. Every lifecycle step records the system actor `release-batch-workflow` with the manifest reason, change reference and run URL in `publication.release_transitions`.

### Add 猜熊猫 questions

猜熊猫 serves published rows of `game.questions` whose photo is public in the active release. The `curation.guess-questions` operation draws them from that release: one question per living panda with a public cover photo, the other three options preferring pandas at the same place (difficulty `hard`, `medium` or `easy` by how many it found), and tips from confirmed birth dates and current homes.

1. **Write the manifest.** In a pull request, add `data/curation/guess-questions/<batch>.json` ([contract](../../contracts/guess-question-manifest.v1.json)) with a new batch such as `2026.10.27.1` and the reason. Publish the content release the questions should come from first.
2. **Run.** Run the workflow on `main` with operation `curation.guess-questions`, that manifest, **execute** checked and the pull request as change reference, then approve `production-batch`. The summary states how many questions the release yields, how many were new and the mix of difficulty. A pair of panda and photo is never written twice, so running again after a new release adds only the pandas and photos that release brought.

The `production-batch` environment holds `SUPABASE_DB_URL` (the same session-pooler connection the deploy uses) and `SUPABASE_DB_SSL_CA_CERT` (the Supabase root CA from the dashboard's database settings; the command refuses a remote database without it), requires the owner's approval, and allows `main` only.

## Migration rules

- **Expand first.** A migration must keep the currently deployed API working: add tables, columns, grants and functions; do not rename, drop or tighten what the running API uses. Remove the old shape in a later release, after no deployed code uses it.
- **Grant what the API uses.** The app-role grants test (`app-role-grants.integration.spec.ts`) derives the privileges from the API source and fails when a migration forgets one.
- **Forward only.** Never edit, renumber or delete a migration that has reached production; correct it with a new migration. Number a new migration after the highest one on `main`.
- **Only this workflow migrates production.** Do not apply migrations with the Supabase dashboard, the Supabase MCP `apply_migration` tool or a local `supabase db push`: they record migrations under different versions, and the next deploy's `db push` then refuses with "Remote migration versions not found". Fixing that means repairing `supabase_migrations.schema_migrations` by hand (done once on 2026-10-13 for 0054–0058).
- **Destructive changes need the owner.** A migration that drops data runs only after the owner approves it in its issue, as in #575.

## Roll back a Worker

Each deploy creates a Worker version tagged with its commit. Rolling back deploys an earlier version to 100% of traffic; it does not rebuild anything.

```powershell
npx cf workers versions list --worker zhipanda-v2-api
# rollback.json: [{"version_id":"<previous version id>","percentage":100}]
npx cf workers deployments create --worker zhipanda-v2-api --strategy percentage --versions @rollback.json
```

Use `zhipanda-v2-web` for the Web Worker. When both Workers must go back, roll back the Web Worker first and then the API, the reverse of the release order. Add `--dry-run` to see the effect first.

A rollback does not undo database migrations. Because migrations are expand-first, the previous API version keeps working against the newer schema; a bad migration is corrected by a new forward migration, never by editing or deleting an applied one.

After a rollback, revert the offending commit on `main` so the next release does not redeploy it.

## Credentials

The workflow's secrets exist only in the `production` Environment, so only the approved deploy job can read them:

- `CLOUDFLARE_API_TOKEN`: deploys the Workers.
- `SUPABASE_DB_URL`: the **Session pooler** connection string for the `postgres` role, copied from the Supabase dashboard (Connect → Session pooler; `postgresql://postgres.<project-ref>:<password>@<region pooler host>:5432/postgres`, password percent-encoded). Migrations need the schema owner, and GitHub runners have no IPv6 route to the direct `db.<project-ref>.supabase.co` host. Locally, `cf` prefers a `CLOUDFLARE_API_TOKEN` environment variable over the OAuth login (`cf auth whoami` shows which is in use); remove a stale variable rather than overriding it per command.
