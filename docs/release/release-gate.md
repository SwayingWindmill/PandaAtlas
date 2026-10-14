# Current verification and deployability gate

Verification is split by ownership, and the Cloudflare deployability workflow is the deployability gate for online Web/API changes.

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

`.github/workflows/cloudflare-deployability.yml` is the single deployability workflow for Web/API runtime changes. It runs on pull requests and pushes to `main` that touch the paths it declares, and:

1. installs the locked npm workspace;
2. installs (or restores from cache) Playwright Chromium;
3. runs the Web smoke suite and the Admin shell browser suite;
4. builds the Cloudflare Web and API artifacts and boots the API Worker in workerd.

A runtime change that needs more deployability proof extends this workflow rather than adding a parallel gate.

## Other checks

Repository policy checks, such as repository hygiene, are exposed through Development Operations. Use [deployment runtime status](../deployment/runtime-status.md) for current production topology.
