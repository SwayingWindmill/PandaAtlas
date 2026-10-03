# Vinext evaluation for the Cloudflare Web runtime

- Date: 2026-10-03
- Decision ticket: #385 `Evaluate vinext for the Cloudflare Web runtime`
- Baseline commit: `de019fdfdbb46a3773ac0e4842bf0d1e1516ec33`
- Status: accepted evaluation; **no production runtime change in this ticket**
- Current production source of truth: [`docs/deployment/runtime-status.md`](../deployment/runtime-status.md)

## Question

Should PandaAtlas keep OpenNext as the long-term Cloudflare adapter for the Next.js 16 Web application, or schedule a deliberate migration to vinext now that Cloudflare has released vinext 1.0?

The decision must be based on the current PandaAtlas application and deployment seams, not on framework novelty or headline compatibility percentages.

## Decision summary

**Schedule a deliberate follow-up migration from OpenNext to vinext. Keep OpenNext as the production Web adapter until that migration passes the existing public behavior and Cloudflare build/deploy seams.**

The migration is justified because the remaining PandaAtlas-specific incompatibilities are narrow while the runtime simplification is material:

1. `vinext 1.0.1 check` against the current Web reports **93% compatibility**: 18 supported checks, one partial feature, and one concrete source issue.
2. All six currently used `next/*` / Next-adjacent import families reported by the checker are supported. `proxy.ts`, App Router routing, nuqs, Tailwind, and lucide also pass the checker.
3. The only concrete source incompatibility is a test fixture using `__dirname`; it is not production application code.
4. `typedRoutes` remains partial because vinext does not currently generate the same typed `Link` href surface as Next. PandaAtlas already runs `next typegen` before `tsc`; preserving Next only as temporary development-time type-generation tooling is possible without retaining two production runtimes.
5. The current OpenNext cache topology is configured but not exercised by current Web application code. The repository has no `revalidateTag`, `revalidatePath`, `unstable_cache`, Cache Components, positive `revalidate` interval, or `force-cache` use. The only route-level `revalidate` exports are `revalidate = 0` on force-dynamic/private pages. Therefore the R2 incremental-cache bucket, Durable Object revalidation queue, sharded tag cache, and Web self-binding should not be reproduced automatically in a vinext migration.
6. The current Web build is a multi-adapter chain: Next build -> OpenNext -> custom asset copy -> Cloudflare Vite packaging -> Cloudflare Build Output -> `cf`. Vinext can collapse this to Vite + vinext + the Cloudflare Vite plugin -> Cloudflare Build Output -> `cf`.
7. PandaAtlas can keep `cf` as its primary operator/deployment CLI. Cloudflare documents that the Vite plugin writes the Build Output consumed by `cf deploy --prebuilt`; vinext therefore does not require returning Wrangler to the primary deployment path.
8. The production-specific Cloudflare behavior that does need to survive is small and explicit: the `HOME_MEDIA` R2 request handling, the `V2_API` service binding, and current public routing/proxy behavior.

This is a migration decision, not a runtime switch. Production remains Next.js 16 + OpenNext 1.20.8 until a separate implementation ticket removes OpenNext and proves the vinext artifact through the existing deployment seam.

## 1. Current PandaAtlas Web topology

The production Web path at the baseline commit is:

```text
Next.js 16
  -> next build
  -> OpenNext 1.20.8
  -> .open-next/worker.js + assets
  -> repository asset-copy step
  -> custom Worker wrapper
       - HOME_MEDIA R2 reads
       - OpenNext fetch delegation
       - OpenNext cache Durable Object exports
  -> Cloudflare Vite plugin
  -> .cloudflare/output/v0
  -> cf deploy --prebuilt --mode production
```

The current adapter-specific files and seams are:

- `apps/web/open-next.config.ts`
  - R2 incremental cache
  - Durable Object revalidation queue
  - sharded Durable Object tag cache
- `apps/web/scripts/build-cloudflare.mjs`
  - runs the OpenNext build
  - copies OpenNext assets into the Cloudflare Vite input directory
  - invokes Vite for the final Cloudflare artifact
- `apps/web/worker/index.mjs`
  - imports the generated OpenNext worker
  - re-exports OpenNext cache Durable Objects
  - serves selected media paths from `HOME_MEDIA`
  - delegates all other requests to OpenNext
- `apps/web/lib/server/v2-api.ts`
  - uses `getCloudflareContext()` from `@opennextjs/cloudflare` to reach the `V2_API` service binding
- `apps/web/cloudflare.config.ts`
  - declares media and API bindings
  - also declares the OpenNext-specific self, cache-R2, queue, and tag-cache bindings

The production deployment CLI itself is already adapter-neutral: `cf deploy --prebuilt --mode production` consumes Cloudflare Build Output rather than an OpenNext-specific deployment format.

## 2. Compatibility evidence

### 2.1 `vinext check`

The evaluation installed `vinext@1.0.1` outside the repository and ran its compatibility checker from `apps/web` so the probe did not modify `package.json` or the lockfile.

Result:

```text
93% compatible
18 supported
1 partial
1 issue
```

Supported imports reported by the checker:

```text
next/headers      13 uses
next/navigation   44 uses
next/server       25 uses
server-only        5 uses
next/link         33 uses
next/dynamic       2 uses
```

Supported application/library checks included:

- App Router: 41 pages, 3 layouts, 24 route handlers, loading/error/not-found boundaries;
- Next 16 `proxy.ts`;
- `transpilePackages`;
- nuqs;
- Tailwind;
- lucide-react.

The two non-green findings were:

1. **Partial — `typedRoutes`:** vinext type generation does not currently provide equivalent typed `Link` href generation.
2. **Issue — Node global in a fixture:** `apps/web/tests/fixtures/golden-dataset.ts` uses `__dirname` / `__filename` style module-path behavior.

A repository scan confirmed the module-path issue is confined to that test fixture; production Web source did not produce another hit.

### 2.2 Dependency delta

The current installed Web stack at evaluation time is Next 16.3.8, React/React DOM 19.2.4, Vite 8.2.2, and Cloudflare Vite plugin 2.0 beta.

Vinext 1.0.1 currently requires the React Server Components peer set around React 19.2.6 or later and Vite 8. An implementation should therefore expect:

- a React / React DOM patch-level alignment;
- `vinext`;
- `@vitejs/plugin-rsc`;
- `react-server-dom-webpack`.

`apps/web` is already ESM (`"type": "module"`), so there is no CommonJS-to-ESM migration cost.

## 3. `typedRoutes` is a development-time gap, not a production-runtime blocker

PandaAtlas currently enables `typedRoutes` in `next.config.ts`, includes `.next/types/**` in TypeScript, and runs:

```text
next typegen && tsc --noEmit
```

Vinext's route-aware type generation supports route component helper types but does not yet reproduce Next's typed `Link` href surface. This is a real regression if PandaAtlas simply removes Next type generation.

The follow-up migration must therefore verify route typing explicitly. The smallest acceptable bridge is to keep the real Next package only as **development-time type-generation tooling** while production dev/build/start commands use vinext. This is not a second production runtime and must not be used as runtime fallback behavior.

That bridge should be removed when vinext supplies equivalent route-link typing or PandaAtlas deliberately replaces the current `typedRoutes` contract with an equally strong local typing seam. The migration must not add a parallel production Next/OpenNext path merely to preserve route types.

## 4. The configured OpenNext cache topology is currently unused

The baseline production configuration declares:

```text
NEXT_INC_CACHE_R2_BUCKET
NEXT_CACHE_DO_QUEUE
NEXT_TAG_CACHE_DO_SHARDED
WORKER_SELF_REFERENCE
```

and `open-next.config.ts` wires R2 incremental caching, the Durable Object queue, and the sharded tag cache.

Those resources would matter if the application currently depended on time-based ISR, on-demand tag/path revalidation, or cached Next data. The current Web source does not.

Searches against the baseline tree found:

- no `revalidateTag`;
- no `revalidatePath`;
- no `unstable_cache`;
- no `cacheTag` / Cache Components use;
- no `cache: "force-cache"`;
- no positive route-level `revalidate` interval;
- five route-level `revalidate` exports, all `revalidate = 0` on force-dynamic/private pages;
- many explicit `cache: "no-store"` request paths.

`generateStaticParams` is used for bounded static route generation, but that does not by itself require the current R2 + Durable Object revalidation topology.

Therefore a vinext migration should **delete these unused OpenNext cache resources instead of porting them by default**. If PandaAtlas later adds ISR or tag/data caching, that feature should choose and test its cache semantics at that time.

This finding removes the largest apparent migration objection. Vinext's first-party Cloudflare cache path is not a byte-for-byte equivalent of OpenNext's R2 + Durable Object setup, but current PandaAtlas behavior does not require that equivalence.

## 5. Cloudflare-specific behavior that must survive

### `HOME_MEDIA`

The current custom Worker serves selected `/media/...` requests directly from the `HOME_MEDIA` R2 binding, including GET/HEAD, range responses, ETags, content metadata, and cache-control behavior.

Vinext supports custom Cloudflare Worker entries. The migration should retain this request seam and delegate all non-media requests to the vinext App Router entry rather than to `.open-next/worker.js`.

This behavior must be verified through the existing public/browser or HTTP seams; do not unit-test vinext or Cloudflare internals.

### `V2_API`

`apps/web/lib/server/v2-api.ts` currently reaches the service binding through OpenNext's `getCloudflareContext()`.

Vinext/Cloudflare Vite applications can access Workers bindings through the native `cloudflare:workers` environment. The follow-up should replace this single application-level OpenNext coupling with the native Cloudflare binding seam while retaining the existing external HTTP fallback used outside the Worker runtime.

### `proxy.ts`

The checker reports Next 16 `proxy.ts` support. PandaAtlas still needs its actual redirects, locale header propagation, Supabase session refresh, and private/admin response headers exercised by the existing behavior tests. Checker support alone is not acceptance evidence.

## 6. Build/deploy comparison

### Current OpenNext chain

```text
next build
  -> OpenNext build
  -> generated .open-next worker/assets
  -> repository copy/reshape step
  -> Vite + Cloudflare plugin packaging
  -> Cloudflare Build Output
  -> cf deploy --prebuilt
```

### Candidate vinext chain

```text
Vite + vinext
  -> Cloudflare Vite plugin
  -> Cloudflare Build Output
  -> cf deploy --prebuilt
```

Cloudflare's current Vite plugin supports RSC child environments and writes standard Build Output consumed by the `cf` CLI. The Cloudflare `cf` documentation also states that its Vite plugin path does not depend on Wrangler.

That means the migration can retain the repository's accepted deployment ownership:

- `cloudflare.config.ts` remains the Cloudflare resource/deployment source;
- `cf` remains the operator/deployment CLI;
- the existing Cloudflare deployability workflow remains the single PR artifact gate;
- no second vinext-specific CI gate is required.

If no Web-only command still requires Wrangler after OpenNext is removed, the Web workspace's explicit Wrangler dependency becomes a candidate for removal in the same migration. Repository-wide Wrangler uses outside this Web adapter decision are separate and must not be deleted mechanically.

## 7. Build probe and what it proves

A production build probe was run with vinext against the **unchanged current PandaAtlas Vite configuration**.

It failed immediately because `apps/web/worker/index.mjs` imports the generated OpenNext file `../.open-next/worker.js`, which does not exist when OpenNext is not run first. The Cloudflare Vite plugin therefore reported an unresolved `.open-next/worker.js` import.

This is expected evidence about the migration seam, not evidence that vinext cannot build PandaAtlas. It proves that the current Worker wrapper and build orchestration are one adapter-specific unit and must be replaced together. A valid migration cannot be implemented as only:

```text
next build -> vinext build
```

while retaining the OpenNext Worker entry.

A clean vinext build with the replacement Worker entry is the first mandatory acceptance seam for the follow-up migration. #385 intentionally does not make that production configuration change.

## 8. Risk comparison

### Reasons to migrate

- removes `@opennextjs/cloudflare` from application/runtime code;
- removes the OpenNext config and generated-worker dependency;
- removes the custom OpenNext asset-copy/build orchestration;
- can remove currently unused OpenNext cache R2/DO resources;
- likely removes the Web workspace's OpenNext-only Wrangler dependency;
- uses Cloudflare's first-party Vite/RSC build path while retaining `cf` and `cloudflare.config.ts`;
- reduces the number of transformation stages between Next-compatible source and the Cloudflare artifact.

### Reasons not to switch production inside #385

- vinext 1.0 is newly released and is less battle-tested than OpenNext on mature production applications;
- `typedRoutes` is not yet equivalent;
- actual PandaAtlas custom media Worker delegation and service-binding behavior still need a complete vinext build plus existing smoke coverage;
- vinext deliberately differs from Next in some image/font/cache behavior and does not yet implement all Cache Components/PPR behavior.

These are implementation verification risks, not reasons to keep the current adapter indefinitely. They justify a bounded migration ticket with an abort condition rather than an immediate runtime flip.

## 9. Smallest credible migration plan

Use one vertical follow-up ticket/PR. Do not create a permanent dual-runtime phase.

1. Align the vinext/RSC peer dependencies and add a minimal App Router Vite configuration using vinext plus the Cloudflare Vite plugin.
2. Replace the OpenNext-specific custom Worker delegation with a vinext entry while preserving the `HOME_MEDIA` public behavior.
3. Replace `getCloudflareContext()` with native Cloudflare binding access for `V2_API`, retaining the current non-Worker HTTP transport path.
4. Remove the OpenNext build/config/dependency path and the unused OpenNext cache bindings/resources from the Web artifact definition.
5. Preserve route typing through the smallest development-only seam required for the current codebase; do not create a production runtime fallback.
6. Keep the existing `cf` Build Output deployment flow and existing deployability workflow rather than adding a second comparison gate.
7. Verify, in order:
   - `vinext check` has no unexplained production-code issue;
   - Web typecheck is green, including the chosen route-typing seam;
   - the vinext + Cloudflare Vite production build produces valid Cloudflare Build Output;
   - `cf deploy --prebuilt --mode production --dry-run` accepts that artifact;
   - existing Web browser/smoke coverage passes for public routing, media, authenticated/private surfaces, and admin routing that already have coverage.
8. Merge only when the branch has **one** production Web runtime. OpenNext files/dependencies must be deleted in the same migration rather than retained as fallback code.

### Abort condition

If the replacement Worker cannot preserve `HOME_MEDIA`, `V2_API`, `proxy.ts`, or current route-typing/build behavior without adding a second production adapter, stop the migration and keep OpenNext. Record the concrete failure instead of adding a compatibility layer.

## 10. Why this ticket does not add an ADR

This evaluation changes the **planned adapter direction**, not the current production topology. `docs/deployment/runtime-status.md` remains authoritative and still names OpenNext until a migration actually lands.

Creating an architecture ADR that says vinext is the active runtime before the implementation is verified would conflict with that source of truth. This research decision is therefore the durable evidence for #385; the follow-up migration should update the production runtime status when it actually replaces OpenNext.

## Sources

Primary sources used for framework/runtime behavior:

- Cloudflare, Next.js on Workers: <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>
- Cloudflare, Vinext 1.0 announcement (2026-09-28): <https://blog.cloudflare.com/vinext-nextjs-on-vite/>
- Cloudflare vinext repository and migration guidance: <https://github.com/cloudflare/vinext>
- Vinext Cloudflare/App Router configuration examples: <https://github.com/cloudflare/vinext/blob/main/.agents/skills/migrate-to-vinext/references/config-examples.md>
- Cloudflare Build Output: <https://developers.cloudflare.com/cf/projects/build-output/>
- Cloudflare `cf` project build/deploy behavior: <https://developers.cloudflare.com/cf/projects/>
- Cloudflare Vite plugin API / RSC child environments: <https://developers.cloudflare.com/workers/vite-plugin/reference/api/>
- Cloudflare Vite RSC child-environment changelog: <https://developers.cloudflare.com/changelog/post/2026-02-11-vite-plugin-child-environments/>
- OpenNext Cloudflare caching model: <https://opennext.js.org/cloudflare/caching>
- Cloudflare Workers KV consistency model: <https://developers.cloudflare.com/kv/concepts/how-kv-works/>
