# Phase 1: Parallel Vercel Web deployment

- Status: Vercel project deployed; acceptance in progress
- Decision: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)
- Phase 0 baseline: [Managed-cloud inventory](managed-cloud-phase-0-inventory.md)
- Deployment plan: [`contracts/vercel-web-deployment.v1.json`](../../contracts/vercel-web-deployment.v1.json)
- Deployment evidence: [`data/deployment-evidence/vercel-web-2026-08-01.json`](../../data/deployment-evidence/vercel-web-2026-08-01.json)
- Acceptance workflow: [`.github/workflows/vercel-web-acceptance.yml`](../../.github/workflows/vercel-web-acceptance.yml)
- Plan validation: `npm run check:vercel-web-deployment-plan`

## Objective

Deploy `apps/web` to a Vercel preview URL and verify the existing Panda Atlas Web behavior without changing production traffic or data infrastructure.

The Vercel project now exists as `swaying-windmill/zhipanda`, with `apps/web` as its Root Directory. The stable Vercel-only URL is `https://zhipanda.vercel.app`. It remains separate from the public Panda Atlas custom domains.

During this phase:

- `zhipanda.com` and `www.zhipanda.com` remain on the Cloudflare Web Worker.
- `api.zhipanda.com` remains on the Cloudflare public API Worker.
- D1, R2, production release activation, and rollback behavior remain unchanged.
- Vercel Preview and its initial branch-tracked Production deployment use `NEXT_PUBLIC_API_BASE_URL=https://api.zhipanda.com`.
- No Vercel production domain is attached.
- No Vercel deployment, promotion, rollback, or production secret is executed by the repository acceptance workflow.

## Why the initial project uses platform defaults

The Next.js application already has standard `dev`, `build`, and `start` scripts. Phase 1 therefore records no custom Vercel install command, build command, or output directory. Overrides should be introduced only after a real preview build demonstrates a specific need.

The Vercel project Root Directory must be `apps/web`. The repository-level npm lockfile and workspace structure remain the source dependency boundary. Local `.vercel` project linkage remains ignored by Git through `apps/web/.vercel/`.

## Vercel project setup

The project owner must perform the following managed-platform actions:

1. Import the `SwayingWindmill/PandaAtlas` GitHub repository into Vercel.
2. Set **Root Directory** to `apps/web`.
3. Keep the framework preset as **Next.js**.
4. Set the production branch to `master`, matching the existing production release guard.
5. Leave Install Command, Build Command, and Output Directory on the Vercel defaults for the first deployment.
6. Configure the same public environment variable for **Preview** and **Production**:

   ```text
   NEXT_PUBLIC_API_BASE_URL=https://api.zhipanda.com
   ```

7. Do not add `zhipanda.com` or `www.zhipanda.com` to the Vercel project during this phase. Vercel may label the deployment from `master` as a Production Deployment, but it remains isolated on a `*.vercel.app` URL and receives no Panda Atlas production traffic.
8. After the initial import, create a preview deployment from a non-production branch or pull request.
9. Record the non-secret Vercel project ID and team ID in `contracts/vercel-web-deployment.v1.json`.
10. Run the GitHub Actions workflow **Vercel Web Acceptance** with the generated HTTPS `*.vercel.app` preview URL.

The initial preview requires no application secret. `NEXT_PUBLIC_API_BASE_URL` is public configuration and already points to the approved public-read boundary.

## Acceptance workflow

The manual workflow accepts one input:

```text
base_url=https://<generated-preview>.vercel.app
```

It rejects non-HTTPS targets and hosts outside `.vercel.app`, then performs:

1. Clean checkout.
2. Pinned Node.js and npm setup.
3. Lockfile installation with `npm ci`.
4. Chromium and runtime dependency installation.
5. Existing browser smoke tests with `PLAYWRIGHT_BASE_URL`.
6. Existing automated accessibility tests with `PLAYWRIGHT_BASE_URL`.
7. Upload of `.release-gate` and Playwright evidence.

The existing Playwright configuration disables its local Web server whenever `PLAYWRIGHT_BASE_URL` is present, so the same tests exercise the deployed preview directly.

## Required manual verification

Automated checks are necessary but not sufficient for the first preview. Record the following observations in the deployment evidence:

- Chinese and English landing routes render correctly.
- Locale switching preserves route and query state.
- Atlas, panda profile, lineage, map, and collection routes load.
- Server-rendered and no-JavaScript paths remain usable.
- Public media loads through the existing `api.zhipanda.com/media/...` route.
- Canonical URLs and metadata do not accidentally claim that the preview URL is production.
- 320 px layout, keyboard navigation, focus visibility, and reduced-motion behavior remain acceptable.
- Preview logs contain no repeated runtime errors.
- Preview build and function usage are recorded for budget planning.

## Evidence record

After the first successful preview, add a versioned evidence file under `data/frontend-evidence/` or a dedicated deployment-evidence directory containing:

- Git commit SHA.
- Vercel project ID and deployment ID.
- Preview URL.
- Deployment creation time.
- `NEXT_PUBLIC_API_BASE_URL` classification and expected value, without copying unrelated secrets.
- Workflow run URL or run ID.
- Browser smoke outcome.
- Automated accessibility outcome.
- Manual verification outcome.
- Build duration and relevant usage observations.
- Rollback owner and action: delete or ignore the preview while Cloudflare production remains active.

## Exit criteria

Phase 1 remains incomplete until all of the following are true:

- Vercel project and team identifiers are recorded.
- Preview environment configuration is verified.
- A preview successfully builds from `apps/web`.
- Browser smoke passes against the preview URL.
- Automated accessibility passes against the preview URL.
- Manual route, locale, no-JavaScript, media, keyboard, and narrow-layout checks pass.
- Observability, budget, and rollback ownership are recorded.
- The preview can be removed or redeployed without affecting current production.

Production DNS cutover belongs to Phase 4 and requires a separate reviewed change.
