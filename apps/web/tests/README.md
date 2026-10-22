# Web browser-test contract

Use these tests to protect current user-visible Web behavior, not to preserve retired releases or product surfaces.

## Default fixture boundary

`fixtures/v2-public-api-server.mjs` is an intentionally bounded V2 API fixture for the default Playwright suites. Read the fixture when a test depends on specific published facts; do not infer production dataset size, historical cohorts, relationships, media, or places that the fixture does not publish.

A browser test that needs data outside the default fixture must own an explicit fixture/suite for that behavior. When the owning product surface is retired, retire its browser test rather than adding a compatibility path or enlarging the default fixture to keep history green.

## Suites

- `tests/smoke/`: current public/private browser contract; run with `npm run smoke` in this workspace or `npm run smoke:web` from the repository root.
- `tests/admin/`: retained V2 Admin shell/audit behavior; run with `npm run test:admin-shell` in this workspace.
- accessibility and browser-matrix suites are separate acceptance surfaces; do not duplicate their assertions into smoke merely to increase coverage counts.

The default suites may mock identity or feature APIs at the browser boundary, but production responses must never silently fall back to these fixtures.

## Running locally

- Each suite starts its own servers and refuses a port that is already taken (smoke: Web 3100 and fixture API 3300; admin: Web 3300), so run the suites one after another. An interrupted run can leave those servers behind: stop the listening processes before the next run instead of setting `PLAYWRIGHT_REUSE_EXISTING_SERVER`, which would test a stale build.
- The first spec against a cold Vite dev server can fail with `Failed to fetch dynamically imported module` while dependencies are optimized. Re-run that spec alone before treating it as a product failure; a failure that repeats is real.
