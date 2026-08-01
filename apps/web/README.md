# Panda Atlas Web

- Application status: **Current product / Target-compatible**
- Current production deployment: **Transitional OpenNext on Cloudflare Worker**
- Approved target deployment: **Native Next.js on Vercel**
- Governing status page: [`docs/deployment/runtime-status.md`](../../docs/deployment/runtime-status.md)

The application under `app/`, `features/`, `components/`, `foundation/`, `lib/`, and `styles/` is the long-term Next.js product code. It must continue to build and run through the standard Next.js scripts without depending on Cloudflare-only behavior.

The following files and directories are retained for current production, migration safety, and rollback until ADR 0002 Phase 4 and Phase 6 complete:

- `open-next.config.ts`;
- `cloudflare/`;
- `wrangler.jsonc`;
- `wrangler.staging.jsonc`;
- `wrangler.staging.withdrawn.jsonc`;
- OpenNext and Wrangler package scripts and dependencies.

Do not add new application behavior that works only through OpenNext or Cloudflare bindings. Production custom domains remain on Cloudflare during Vercel Phase 1; the parallel Vercel deployment continues to call the existing public API and does not authorize DNS cutover.

## Local development

```bash
npm install
npm run dev
```

## Standard verification

```bash
npm run lint
npm run typecheck
npm run build
```

Cloudflare preview and deployment commands remain available only for current-production maintenance and rollback. Vercel acceptance and production cutover are governed by the phase documents under `docs/deployment/`.
