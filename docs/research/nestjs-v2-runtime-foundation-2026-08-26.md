# NestJS V2 runtime foundation research

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #311 `Define the NestJS runtime foundation and project conventions`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

What NestJS 11 runtime foundation and code conventions should PandaAtlas standardize on for main bootstrap, Fastify, configuration, validation, exception mapping, request context, dependency injection, module exports, lifecycle hooks, and serverless-safe behavior so the new backend follows NestJS best practices instead of reproducing FastAPI patterns?

## Decision summary

PandaAtlas V2 should standardize on a conventional NestJS 11 application with Fastify, Node.js 24 LTS, strict TypeScript using NodeNext module resolution, one normal `src/main.ts` bootstrap, singleton providers by default, framework-free domain code, validated typed configuration, global request-boundary validation/error handling, AsyncLocalStorage-based request context, and explicit serverless-safe lifecycle rules.

The runtime must remain a normal NestJS application. Vercel is a deployment target, not a second application architecture.

## Runtime baseline

- **Node.js:** 24.x LTS.
- **NestJS:** 11.x stable packages kept on one compatible major/minor line.
- **HTTP platform:** `@nestjs/platform-fastify` with Fastify 5.
- **TypeScript:** strict mode, modern stable TypeScript supported by the selected Nest 11 dependency set.
- **Module system:** `module = nodenext`, `moduleResolution = nodenext`.
- **Decorator metadata:** enabled because Nest DI and DTO metadata depend on it.
- **Process model:** one Nest modular-monolith process/function; no microservice transport inside the authoritative API.
- **Deployment model:** conventional Nest entrypoint; Vercel detects and runs the application as one Vercel Function.

Node 24 is chosen because it is the current LTS line as of this decision and is supported by the target managed platform. NestJS 11 requires Node 20 or newer and supports Fastify 5.

## Bootstrap convention

There is one authoritative bootstrap path.

Conceptually:

```ts
async function createApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(fastifyOptions),
    {
      bufferLogs: true,
      abortOnError: true,
    },
  );

  configureHttpApplication(app);
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  await app.listen(port, host);
}

void bootstrap();
```

Rules:

1. `src/main.ts` remains conventional and contains or invokes `app.listen()`.
2. Tests and local tooling should construct the application through the same `createApplication()` / bootstrap configuration rather than reproducing global pipes, filters or Fastify setup elsewhere.
3. There is no Vercel-specific alternate Nest application, handler tree, custom compatibility wrapper or second composition root.
4. HTTP prefix/versioning details are deferred to #313, but they must be configured centrally rather than repeated per module.
5. Bootstrap performs composition only; it does not contain domain behavior.

## Fastify rules

Fastify is the only HTTP adapter for the V2 API.

- Do not install or depend on Express-specific middleware or request/response types in application code.
- Prefer Nest platform-neutral decorators and return values over direct `FastifyReply`/`FastifyRequest` access.
- Avoid `@Res()`/manual response control unless the route genuinely requires streaming, a file response or another adapter-specific feature.
- Fastify plugins are registered at the HTTP/platform composition boundary, not ad hoc from business services.
- CORS is explicit and allowlisted. With Fastify 5, allowed methods must be configured explicitly where CORS is enabled.
- Request/body size limits are explicit platform configuration, not route-by-route magic defaults.
- `trustProxy`, forwarded headers and client-IP interpretation must be set from the deployment decision in #318 rather than guessed in domain code.

## TypeScript conventions

The Nest service is a strict TypeScript codebase.

Required baseline:

- `strict: true`;
- `forceConsistentCasingInFileNames: true`;
- `noUncheckedIndexedAccess: true` unless a specific framework/library incompatibility is proven;
- `useUnknownInCatchVariables: true`;
- `isolatedModules: true`;
- `emitDecoratorMetadata: true`;
- `experimentalDecorators: true`;
- `module: nodenext`;
- `moduleResolution: nodenext`.

Do not weaken compiler strictness globally to make migrated code compile. Fix migrated types at their owner boundary.

Path aliases, package boundaries and exact build orchestration are decided by #320. Aliases must not be used to bypass module-public interfaces.

## Configuration architecture

Use `@nestjs/config` as the environment/configuration integration layer, but do not allow untyped `process.env` reads throughout the application.

Rules:

1. Environment variables are read and validated once at startup.
2. Invalid or missing required configuration fails startup immediately.
3. Production does not silently fall back to developer defaults for secrets, external URLs, authorization switches or security-sensitive values.
4. Business modules do not call `process.env`.
5. Raw `ConfigService.get<string>('SOME_STRING_KEY')` usage should be confined to the configuration/platform composition layer.
6. Business/application providers receive typed configuration objects/tokens for the values they actually need.
7. Configuration is grouped by capability, for example database, auth, http, media, notification and observability, rather than one giant application-settings object.
8. Local `.env` loading is a developer convenience only; managed production configuration comes from Vercel/Supabase/GitHub/Cloudflare secret/config stores as appropriate.
9. Config validation should reject unknown or malformed security-critical values and should report all actionable startup errors together where practical.

The exact schema-validation helper for environment parsing is an implementation detail; the architectural requirement is one fail-fast typed configuration boundary, not a second business validation framework.

## Request validation

Use Nest's global `ValidationPipe` with concrete DTO classes at the HTTP boundary.

Baseline behavior:

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: false,
  },
  validationError: {
    target: false,
    value: false,
  },
});
```

Rules:

- Request DTOs are concrete classes, not TypeScript interfaces, because runtime validation requires metadata.
- DTOs live in the owning module's HTTP boundary.
- Domain objects are not decorated with `class-validator` or HTTP/OpenAPI annotations.
- Extra request fields fail rather than being silently accepted.
- Automatic implicit primitive conversion is disabled; use explicit `ParseUUIDPipe`, `ParseIntPipe`, `ParseBoolPipe`, `ParseArrayPipe`, etc. where the transport needs conversion.
- Validation messages must not echo secrets or arbitrary payload values.
- The canonical API error envelope and OpenAPI representation are decided by #313/#319.

## Exception and error mapping

Nest HTTP exceptions stop at the HTTP/platform boundary.

Rules:

1. Domain and application code must not import or throw `HttpException`, `BadRequestException`, `NotFoundException`, `ConflictException`, Fastify errors or other HTTP framework types.
2. Infrastructure adapters translate database/storage/provider failures into framework-neutral application/domain errors where callers can act on them.
3. A global DI-managed `APP_FILTER` maps known application/domain errors into HTTP responses.
4. Unknown errors become 500 responses and are logged/reported with internal diagnostics that are not exposed to clients.
5. Controllers normally do not wrap every call in `try/catch`; the global mapper owns transport translation.
6. Validation errors enter the same externally stable error contract rather than exposing Nest's incidental default format as a permanent API design.
7. HTTP-specific exceptions are allowed only inside HTTP adapters/platform code for transport-only failures.

The detailed error taxonomy, safe logging rules and observability behavior are finalized by #319.

## Request context

Use Node.js `AsyncLocalStorage` directly for request-scoped context propagation rather than REQUEST-scoped Nest providers.

Canonical context fields should include, as applicable:

- `requestId`;
- `correlationId`;
- `traceId`;
- authenticated `accountId` / actor identity after auth resolution;
- session/authentication references needed by authorization/audit;
- locale where resolved;
- command/idempotency metadata where appropriate.

Rules:

1. The ALS store is created at the earliest HTTP middleware boundary and wraps the full Nest request pipeline.
2. Validate any caller-supplied request/correlation identifier before accepting it; otherwise generate a server identifier.
3. Authentication/authorization guards may enrich the current context after identity resolution.
4. Application services may use a narrow RequestContext service for logging/audit/command metadata.
5. Domain objects and pure domain policies do not read hidden ALS state; required actor/time/idempotency facts are explicit domain/application inputs.
6. Do not use Nest REQUEST scope merely to carry request IDs or users. Singleton providers remain the default.
7. Whether a database transaction is propagated through ALS is deliberately deferred to #312.
8. OpenTelemetry trace propagation is finalized by #319, but it should integrate with the same request-context boundary rather than create a parallel context system.

Nest documents AsyncLocalStorage specifically as an alternative to request-scoped providers for propagating per-request state.

## Dependency injection and provider scopes

### Default scope

Use singleton providers by default.

- Request-scoped providers are prohibited unless a concrete need cannot be met through explicit inputs or AsyncLocalStorage.
- Transient providers require a documented reason.
- Singleton providers must not hold authoritative mutable business state.
- In-memory caches, if introduced, are optimization only and must be safe to lose/recreate.

### Constructor injection

Use constructor injection for dependencies. Avoid service locator patterns (`ModuleRef.get()` in ordinary business code), global static containers and imports that instantiate dependencies manually.

### Interface tokens

Cross-module dependencies use the public interface exported by the target module. Runtime DI may use a symbol token, explicit facade class or another small stable provider token. Consumers must not inject another module's repository/infrastructure provider.

### `forwardRef`

Business modules must not use Nest `forwardRef()` to make circular dependencies compile. A required `forwardRef()` is treated as an architecture defect and resolved by changing ownership, introducing a narrow read port or switching a downstream dependency to a durable event.

## Module export conventions

Every business module follows the ownership decision from #310.

Rules:

- Export only deliberately public application/query ports or facades.
- Do not export repositories, Kysely helpers, entities used as persistence records, controllers, internal command handlers or infrastructure clients.
- Do not re-export another business module simply for convenience.
- Business modules are never `@Global()`.
- There is no business `SharedModule`, `CommonModule` or `UtilsModule` used as an escape hatch.
- Cross-cutting technical providers may live in explicit platform modules, but platform modules cannot own business rules.
- Dynamic Nest modules are reserved for infrastructure adapters/configurable platform integration where configuration truly varies; normal business modules remain static modules.

## Internal module shape

The runtime convention refines #310 without requiring ceremony-heavy CQRS:

```text
modules/<module>/
  domain/          framework-free model, policies, errors
  application/     use cases, commands/queries, public ports
  infrastructure/  PostgreSQL/R2/provider adapters
  http/            controllers, DTOs, presenters
  <module>.module.ts
  index.ts          deliberately narrow public exports, if needed
```

Rules:

- A simple query does not need a Command class plus Handler plus Factory just to satisfy a pattern.
- Complex state-machine modules may use explicit command handlers when they improve reasoning/testability.
- `@Injectable()` belongs on Nest-managed application/infrastructure services, not on domain entities/value objects merely for convenience.
- Controllers remain thin: parse/validate/authenticate -> call application use case -> present result.

## Global enhancers and platform composition

Use Nest's DI-aware global provider tokens where dependency injection is required:

- `APP_FILTER` for global error mapping;
- `APP_GUARD` for true global authentication/security policies where appropriate;
- `APP_INTERCEPTOR` for cross-cutting request logging/metrics/response metadata where appropriate;
- `APP_PIPE` or the single central application bootstrap for global validation.

Prefer DI-managed global enhancers over constructing complex filters/guards/interceptors manually with `new` in `main.ts`.

Do not make business-specific authorization or behavior global simply because Nest supports global enhancers.

## Lifecycle rules

Lifecycle hooks are available but intentionally constrained.

### Constructors

Provider/module constructors must have no external side effects.

### `onModuleInit` / `onApplicationBootstrap`

Allowed:

- cheap local initialization;
- validating static invariants that cannot be validated during config parsing;
- preparing in-memory derived metadata;
- registering purely local framework resources where required.

Not allowed:

- running database migrations;
- starting poll loops;
- starting queue consumers;
- crawling/importing data;
- publishing releases;
- fetching required remote state simply to make the process start;
- performing writes that would repeat on cold start/redeployment.

External dependencies such as PostgreSQL/JWKS/R2 should be initialized lazily or through bounded provider clients unless a later deployment ticket proves a specific eager check is required.

### Shutdown

- Local/long-lived execution may enable Nest shutdown hooks so pools/resources can close cleanly.
- Production correctness must not depend on `SIGTERM`/shutdown hooks being delivered by a serverless platform.
- `app.close()` should be used in tests and controlled local execution to trigger cleanup.
- Long-running workers are separate runtime responsibilities decided by #315/#318, not lifecycle hooks inside the HTTP application.

## Serverless-safe application rules

Because Vercel runs the Nest app as one reusable Fluid Compute function, the following are mandatory:

1. **No process-memory authority.** Sessions, idempotency, account state, locks, publication state, queue state and business counters live in authoritative storage.
2. **No `setInterval`/forever loop in the HTTP app.** Pollers and consumers run through the background execution architecture selected by #315/#318.
3. **No migration-at-startup.** Supabase SQL migrations are a deployment/operations concern.
4. **No required local filesystem state.** Ephemeral files may be used only as bounded temporary implementation details where the platform allows it; they are never durable truth.
5. **Safe cold start and reuse.** Singleton clients/pools may be reused across requests but must be recreatable after a cold start.
6. **Bounded request work.** Crawling, release building, bulk media processing, recovery drills and other unbounded jobs never run in request handlers.
7. **No correctness dependency on shutdown.** A function may terminate without application cleanup hooks.
8. **No alternate serverless domain layer.** The same Nest modules and application use cases run locally, in tests and on Vercel.
9. **No Edge-runtime assumption.** The authoritative Nest API targets the Node.js runtime; Node/PostgreSQL/native ecosystem needs take precedence over edge portability.
10. **Health/readiness are bounded queries.** Exact endpoints and production probe behavior are finalized by #318.

Vercel currently detects conventional NestJS entrypoints and deploys the app as a single Vercel Function, so a custom per-route function rewrite is explicitly rejected.

## Prohibited migration patterns

The Nest migration must not introduce these patterns:

```text
FastAPI router.py        -> giant Nest controller folder
FastAPI service.py       -> giant Nest service with all domain rules
Pydantic BaseModel       -> one global DTO/model tree
HTTPException in service -> BadRequestException in service
Depends(...) everywhere  -> request-scoped provider graph everywhere
Python common/utils      -> TypeScript shared/common dumping ground
startup event workers    -> onModuleInit queue polling
serverless wrapper       -> second Nest composition root
```

The migration should move behavior into the V2 owner determined by #310 and then implement the runtime conventions in this document.

## Initial target skeleton

The exact monorepo/package layout is #320, but the API runtime itself should converge on a shape equivalent to:

```text
services/api/
  src/
    main.ts
    app.module.ts
    platform/
      config/
      http/
      request-context/
      auth-adapters/
      database/
      observability/
    modules/
      evidence/
      panda/
      lineage/
      places/
      life-history/
      media/
      contribution/
      review/
      moderation/
      curation/
      publication/
      identity/
      engagement/
      game/
      updates/
      notification/
      privacy/
      audit/
```

`platform/` is technical plumbing only; modules own all product/domain behavior.

## Decisions deferred to other Wayfinder tickets

- Database library, pooling, transaction propagation and transaction context: #312.
- OpenAPI/DTO generation, versioning and client contract: #313.
- Supabase identity verification, guards/capability decorators and recent-auth enforcement: #314.
- Domain/integration event envelope, Outbox and PGMQ execution: #315.
- Python runtime seam: #316.
- Public read/publication projections: #317.
- Vercel deployment topology, regions, connection behavior and health probes: #318.
- Logging implementation, OpenTelemetry/Sentry, detailed error taxonomy and test enforcement: #319.
- Monorepo/package/build tooling and exact lint/TS configs: #320.
- Migration/cutover sequence: #321.

## External references checked

- NestJS 11 migration guide: https://docs.nestjs.com/migration-guide
- NestJS Fastify performance/adapter guidance: https://docs.nestjs.com/techniques/performance
- NestJS validation: https://docs.nestjs.com/techniques/validation
- NestJS exception filters: https://docs.nestjs.com/exception-filters
- NestJS AsyncLocalStorage recipe: https://docs.nestjs.com/recipes/async-local-storage
- NestJS configuration: https://docs.nestjs.com/techniques/configuration
- NestJS lifecycle events: https://docs.nestjs.com/fundamentals/lifecycle-events
- Official Nest TypeScript starter: https://github.com/nestjs/typescript-starter
- Node release status: https://nodejs.org/en/about/previous-releases
- Vercel NestJS runtime documentation: https://vercel.com/docs/frameworks/backend/nestjs
- Vercel NestJS deployment guide: https://vercel.com/kb/guide/ship-a-nestjs-app-on-vercel

## Acceptance for #311

The runtime foundation is resolved when later work can assume all of the following without reopening the decision:

- Node 24 LTS + NestJS 11 + Fastify 5 is the V2 API runtime baseline.
- The service uses one conventional Nest bootstrap and one composition root.
- TypeScript is strict and uses NodeNext module resolution.
- Config is validated once and exposed as typed capability-specific configuration; business code does not read `process.env`.
- Incoming HTTP data is globally validated and unknown fields fail.
- Domain/application code is HTTP-framework-free; a global filter maps framework-neutral errors to transport responses.
- AsyncLocalStorage carries request context; request-scoped providers are not the default context mechanism.
- Singleton DI is the default; business `forwardRef()` cycles are forbidden.
- Modules export only narrow public application/query interfaces.
- Lifecycle hooks do not launch workers, migrations or durable work.
- Vercel/serverless operation never relies on process memory, shutdown hooks or a special compatibility application.
