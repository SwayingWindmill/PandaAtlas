# Production release and rollback

Production changes reach Cloudflare only through the `Production Deploy` workflow (`.github/workflows/production-deploy.yml`). [Deployment runtime status](../deployment/runtime-status.md) describes the topology this runbook acts on.

## Release

1. Merge the pull request into `main`. If it touches the Web app, the API, the API client or the root manifests, the workflow starts automatically; otherwise run it with **Run workflow** on `main`.
2. Wait for the `build` job. It builds both Workers from that commit and boots the API Worker in workerd.
3. Database migrations: until the deploy job applies them (#574), push any pending migration in `infra/supabase/migrations` to production with `supabase db push` **before** approving. A migration must keep the currently deployed API working (expand first, remove in a later release).
4. Approve the `production` Environment deployment in the workflow run. The job deploys the API Worker, then the Web Worker, each version tagged with the first 12 characters of the commit, and then probes `api.zhipanda.com/health`, `/ready` and `www.zhipanda.com/zh`.
5. Run the `Production Probe` workflow once by hand and confirm it passes.

A failed step stops the later ones. A failure after the API deployed but before the Web deployed leaves the new API serving the previous Web Worker; both are backward compatible by the expand-first rule, so re-run the job once the cause is fixed, or roll the API back.

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

The workflow's `CLOUDFLARE_API_TOKEN` is a `production` Environment secret, available only to the approved deploy job. Locally, `cf` prefers a `CLOUDFLARE_API_TOKEN` environment variable over the OAuth login (`cf auth whoami` shows which is in use); remove a stale variable rather than overriding it per command.
