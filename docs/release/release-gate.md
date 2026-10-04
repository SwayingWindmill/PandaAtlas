# Current verification and deployability gate

PandaAtlas no longer has the V1 monolithic `release:default` / `release:extended` gate. Current verification is split by ownership and the repository-owned Cloudflare PR workflow is the deployability gate for online Web/API changes.

## Local verification

Changed-scope development acceptance is selected from the tracked command catalog:

```powershell
npm run verify:dev:list
npm run verify:dev
```

The catalog in `scripts/development/catalog.mjs` is the command source of truth. Use `npm run ops -- list` or `npm run ops -- describe <command>` instead of copying command inventories into docs.

For Web behavior that reaches the browser boundary:

```powershell
npm run smoke:web
npm run test:admin-shell -w web
```

The fixture and ownership rules for those suites are documented in [`apps/web/tests/README.md`](../../apps/web/tests/README.md).

For Cloudflare artifacts:

```powershell
npm run build:cloudflare
```

Web-only production Build Output can also be checked with the Web workspace's `build:cloudflare` command followed by `cf deploy --prebuilt --mode production --dry-run`.

## Pull-request deployability gate

`.github/workflows/cloudflare-deployability.yml` is the single repository-owned deployability workflow for Web/API runtime changes. It runs on the runtime/workspace paths declared by that workflow and:

1. installs the locked npm workspace;
2. installs Playwright Chromium;
3. runs the current Web smoke suite and Admin shell browser suite;
4. builds the current Cloudflare Web and API artifacts.

Do not add a parallel framework-comparison, Vercel, OpenNext, or legacy Worker/D1 gate. A runtime change extends this workflow when it needs additional deployability proof.

## Other checks

Release/data policy checks remain individually callable where their owning feature still uses them, for example `npm run check:beta-hard-gates` and the repository hygiene checks exposed through Development Operations. Their existence does not recreate the retired V1 release pipeline.

Historical release evidence under `docs/release/`, `docs/deployment/history/`, and Git history describes the runtime that produced that evidence. Use [deployment runtime status](../deployment/runtime-status.md) for current production topology.
