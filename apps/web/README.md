# ZhiPanda Web

`apps/web` is the production Next.js V2 application.

## Runtime

- Next.js 16
- React 19
- Cloudflare Worker `zhipanda-v2-web`
- OpenNext Cloudflare adapter for the Next.js Worker bundle
- Cloudflare R2/Durable Objects for the OpenNext cache and public media bindings
- canonical API base: `https://api.zhipanda.com`

The deployed Worker uses a service binding to `zhipanda-v2-api`. Native Next/OpenNext builds use the canonical HTTPS API origin; browser code does not receive Worker bindings.

## Local development

From the repository root on Windows:

```powershell
npm run dev:web
npm run typecheck:web
npm run lint:web
npm run build:web
```

Or from this workspace directly:

```powershell
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Production deployment

Cloudflare owns the online Web runtime. `cloudflare.config.ts` declares the production Worker name, domains, bindings, and compatibility settings. `open-next.config.ts` owns the Next-to-Worker adapter configuration.

Build the deployable artifact with `npm run build:cloudflare -w web`. Deployment uses `cf` through `npm run deploy:cloudflare -w web`; Wrangler remains installed only because the current OpenNext adapter requires it as a build dependency.

The Production `NEXT_PUBLIC_API_BASE_URL` is `https://api.zhipanda.com`. Cloudflare binding access stays at the server/runtime boundary rather than leaking into client features.
