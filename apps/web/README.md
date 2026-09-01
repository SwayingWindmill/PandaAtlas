# ZhiPanda Web

`apps/web` is the production Next.js V2 application.

## Runtime

- Next.js 15
- React 19
- Vercel
- production functions pinned to Tokyo (`hnd1`) where applicable
- canonical API base: `https://api.zhipanda.com`

Cloudflare remains authoritative for DNS and R2 only. OpenNext, Wrangler Web deployment, and Cloudflare Worker runtime support were retired at the V2 production cutover.

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

Vercel owns the online Web runtime. `vercel.json` pins the primary function region to `hnd1`.

The Production `NEXT_PUBLIC_API_BASE_URL` is `https://api.zhipanda.com`. Changes to production environment variables require a new Vercel deployment before they become active.

Application code must remain standard Next.js code and must not depend on Cloudflare Worker bindings or OpenNext compatibility behavior.
