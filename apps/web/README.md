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

## Impeccable design workflow

Impeccable is the default workflow for user-visible Web UI/UX work; a task does not need to name it explicitly. Repository agents are instructed by `AGENTS.md` to load the project-local skill at `../../.agents/skills/impeccable/` before public frontend work.

Durable design context lives here:

- `PRODUCT.md` — product truth, users, capabilities and constraints.
- `DESIGN.md` — durable ZhiPanda Web visual language.
- `.impeccable/surfaces/*.md` — route/component-specific briefs.
- `.impeccable/config.json` — shared detector/hook configuration.

For a concrete surface, Impeccable resolves the correct context with its `context.mjs` setup before editing. Specialized commands such as critique, shape, layout, typeset, adapt, audit or polish are optional user directions; ordinary frontend work should apply the relevant passes automatically.

The deterministic detector is part of the normal lint gate:

```powershell
npm run check:impeccable
npm run lint
```

Fix real detector findings instead of broadly suppressing them. Generated code, third-party code, fixtures and intentionally retired prototypes are the only normal exclusion classes.

Project hook manifests provide immediate feedback in supported agent environments. Codex project hooks are currently unavailable in native Windows Codex, so the repository rule plus the mandatory lint detector remain the authoritative cross-platform enforcement path.

## Production deployment

Vercel owns the online Web runtime. `vercel.json` pins the primary function region to `hnd1`.

The Production `NEXT_PUBLIC_API_BASE_URL` is `https://api.zhipanda.com`. Changes to production environment variables require a new Vercel deployment before they become active.

Application code must remain standard Next.js code and must not depend on Cloudflare Worker bindings or OpenNext compatibility behavior.
