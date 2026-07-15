# Cloudflare staging accessibility evidence — 2026-07-15

## Deployment identity

- URL: <https://panda-atlas-web-staging.hao1012812011.workers.dev>
- Cloudflare Worker: `panda-atlas-web-staging`
- Cloudflare version: `e9b31ccb-4e6f-42d0-b9fc-07ca3accd71d`
- Deployed at: `2026-07-15T11:17:39.810Z`
- Git commit represented by the application build: `739064ffcd866e0acd8fb6795d9e461b6e6e6904`
- Public API base URL: `https://api.zhipanda.com`

The staging Worker has `workers_dev` enabled and an empty `routes` array. It does not bind `zhipanda.com` or `www.zhipanda.com`. The production Worker deployment history remained unchanged after this deployment; its latest recorded deployment was still `2026-07-15T10:25:13.495Z`.

## Remote automated evidence

All checks below ran against the public Cloudflare staging URL, not a local server.

- Direct HTTP checks returned `200` for the Chinese profile, English profile, global distribution, and focused lineage routes.
- Playwright/axe core accessibility suite: `14 passed`.
- Existing production browser journey suite: `22 passed`.
- TypeScript check: passed.
- Release configuration tests, including staging/production route isolation: `27 passed`.

The retained machine-readable axe evidence is [`staging-accessibility-axe-2026-07-15.json`](./staging-accessibility-axe-2026-07-15.json). It records 11 rendered-state scans, the exact staging URLs and timestamps, axe/runner versions, Windows/Edge user agent, rule configuration, DOM targets, `0` automated violations, and `11` `color-contrast` incomplete results that still require human visual resolution.

Commands used for the deployed checks:

```powershell
$env:PLAYWRIGHT_BASE_URL='https://panda-atlas-web-staging.hao1012812011.workers.dev'
$env:PLAYWRIGHT_BROWSER_CHANNEL='msedge'
npm run test:accessibility -w web
npm run smoke:web
```

The Playwright configuration accepts `PLAYWRIGHT_BASE_URL` so the same browser suites can target a deployed candidate without starting a local web server.

## Human acceptance status

**PENDING — No-Go for a WCAG 2.2 AA claim.**

Use [`wcag-2.2-aa-human-acceptance-checklist.md`](./wcag-2.2-aa-human-acceptance-checklist.md) against the staging URL. The remote automated results do not replace named human keyboard, real screen-reader, visual, text-resize/reflow, reduced-motion, map-equivalence, or lineage-equivalence sessions. English distribution and lineage journeys also remain unavailable.
