# ZhiPanda Web

`apps/web` is the production V2 Web application. It keeps the Next App Router source contract while vinext + Vite own development and Cloudflare production runtime execution.

## Runtime

- Next.js 16
- React 19
- Cloudflare Worker `zhipanda-v2-web`
- vinext 1.x on Vite for the Next-compatible Worker runtime
- Cloudflare R2 for reviewed public media
- canonical API base: `https://api.zhipanda.com`

The deployed Worker uses a service binding to `zhipanda-v2-api`. Non-Worker server execution uses the canonical HTTPS API origin; browser code does not receive Worker bindings. Next remains development tooling for route type generation only.

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

Cloudflare owns the online Web runtime. `cloudflare.config.ts` declares the production Worker name, domains, bindings, and compatibility settings. `vite.config.ts` composes vinext with the Cloudflare Vite plugin and produces Cloudflare Build Output directly.

Build the deployable artifact with `npm run build:cloudflare -w web`. Deployment uses `cf` through `npm run deploy:cloudflare -w web`; the Web workspace does not require Wrangler or OpenNext.

The Production `NEXT_PUBLIC_API_BASE_URL` is `https://api.zhipanda.com`. Cloudflare binding access stays at the server/runtime boundary rather than leaking into client features.
