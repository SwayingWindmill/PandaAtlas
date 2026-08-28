# NestJS V2 observability, error taxonomy, testing, and architecture enforcement

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #319 `Define observability, error taxonomy, testing, and architecture enforcement`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

What cross-cutting engineering baseline should NestJS V2 adopt for structured logging, tracing, metrics, error taxonomy, request and correlation IDs, Sentry/OpenTelemetry integration, unit/application/repository/HTTP/E2E testing, dependency-rule enforcement, schema drift checks, and release quality gates so observability and testability are architectural properties from the start?

## Decision summary

The V2 baseline is intentionally small and composable:

```text
Nest/Fastify application
        |
        +-- RequestContext (native AsyncLocalStorage)
        |      requestId / correlationId / traceId / actor context
        |
        +-- Pino structured JSON logs -> stdout/stderr -> Vercel Logs
        |
        +-- @vercel/otel -> OpenTelemetry traces
        |      +-- first-party Fastify instrumentation / explicit application spans
        |      +-- approved outbound trace propagation
        |
        +-- @sentry/nestjs -> unexpected error aggregation + source maps
        |      skipOpenTelemetrySetup=true
        |
        +-- provider-native metrics
        |      Vercel function/HTTP + Supabase DB/platform
        |
        +-- low-cardinality operational measurement events
               Outbox / PGMQ / pool / publication / notification
               -> structured logs -> Vercel Observability queries/alerts

CI
  +-- TypeScript strict typecheck
  +-- ESLint layer restrictions
  +-- dependency-cruiser graph rules
  +-- V2 architecture/storage checker
  +-- OpenAPI/client drift
  +-- JSON Schema dual-language validation
  +-- clean Supabase migration replay + DB type drift
  +-- Vitest unit/application/module tests
  +-- real PostgreSQL/PostGIS/PGMQ integration tests
  +-- Fastify inject HTTP/E2E tests
  +-- Playwright Web journeys
  +-- deployed staging acceptance/load smoke
```

Key decisions:

1. Use **Pino directly** behind one DI-managed Nest `LoggerService`; do not add `nestjs-pino` or another request-context system.
2. Keep the native AsyncLocalStorage RequestContext from #311 as the one application correlation context.
3. Use `@vercel/otel` as the primary tracing SDK on Vercel and OpenTelemetry API for application spans.
4. Use the Fastify-maintained OTel instrumentation where automatic Fastify spans are useful; do not adopt the deprecated OpenTelemetry Fastify instrumentation package.
5. Do **not** auto-instrument PostgreSQL query text in production; instrument DB transaction/query boundaries with safe low-cardinality attributes and explicit pool measurements instead.
6. Use `@sentry/nestjs` for unexpected error aggregation/source maps, configured with `skipOpenTelemetrySetup: true` so Sentry does not create a competing OTel provider.
7. Do not adopt NestJS Observe in the baseline: it would introduce a third overlapping telemetry platform beside Vercel and Sentry without a demonstrated gap.
8. Do not deploy Prometheus or a custom metrics collector in V2 baseline. Use Vercel/Supabase provider-native metrics plus structured numeric operational events that are queryable/alertable.
9. Standardize external failures on RFC 9457 from #313 and define stable domain/application error codes independent of exception class/message.
10. Adopt **Vitest + SWC + V8 coverage** for Nest V2 tests, with `@nestjs/testing`; Fastify HTTP tests use `inject()`.
11. Test real SQL/PostGIS/PGMQ behavior against disposable/local Supabase rather than mocking Kysely.
12. Enforce the modular architecture mechanically with `dependency-cruiser`, ESLint restricted imports, and a narrow V2-specific static checker backed by a machine-readable architecture contract.
13. Every generated contract/type artifact is checked for drift in CI; CI fails instead of silently regenerating or committing artifacts.
14. Production promotion requires staging evidence for auth, DB, queues, publication and critical Web journeys, not only unit-test success.

---

## 1. Observability is not Audit

V2 has two different evidence systems.

### Operational observability

Purpose:

- diagnose failures;
- measure latency and saturation;
- correlate one request/job across components;
- alert on degraded runtime behavior;
- compare deployments;
- support incident investigation.

It may be sampled/retained according to operations policy.

### Audit module

Purpose:

- append-only security/business evidence;
- high-impact actor/action/reason records;
- privacy/security-sensitive reads when policy requires evidence;
- publication/moderation/privacy governance evidence.

Audit is durable PostgreSQL business evidence and is never reconstructed from Vercel or Sentry logs.

Therefore:

> A log line is not an Audit event, and an Audit event should not be duplicated into logs with its full sensitive payload merely for convenience.

---

## 2. One request context

The native `AsyncLocalStorage` context from #311 remains the single request/correlation context.

Conceptually:

```ts
interface RequestContext {
  requestId: string;
  correlationId: string;
  traceId?: string;
  spanId?: string;
  accountId?: string;
  authSessionId?: string;
  locale?: string;
  idempotencyKeyHash?: string;
}
```

This interface is conceptual; security-sensitive values are not automatically logged.

Do not introduce parallel context storage through:

```text
request-scoped providers
nestjs-pino AsyncLocalStorage
Sentry-only scope as business context
OTel baggage as application state
Fastify request decorators used as the only context authority
```

Tracing/logging adapters read/enrich the same application RequestContext.

Domain code never reads AsyncLocalStorage implicitly.

---

## 3. Request ID

Every incoming HTTP request receives a server-controlled UUID `requestId` at the earliest HTTP boundary.

Rules:

- use `crypto.randomUUID()` or equivalent standards-based UUID generation;
- always create a PandaAtlas request ID even when a client supplies one;
- return it as:

```text
X-Request-Id: <uuid>
```

- include it in RFC 9457 `requestId`;
- include it in request-completion/error logs;
- add it to Sentry error context/tagging where safe;
- make it available for trace correlation.

Do not allow an arbitrary incoming header to become the authoritative request ID, because it can contain unbounded/untrusted content and can cause collisions/confusing incident evidence.

---

## 4. Correlation ID

`correlationId` follows an end-to-end logical operation across requests/jobs/events.

For ordinary requests with no upstream application correlation, initialize:

```text
correlationId = requestId
```

A bounded syntactically valid incoming `X-Correlation-Id` may be accepted as external correlation metadata when the caller is a trusted PandaAtlas component or explicitly supported integration.

For durable work the correlation ID is persisted in:

- Outbox event;
- PGMQ job envelope;
- notification intent/delivery job;
- pipeline job where applicable;
- publication operation;
- Audit event where relevant.

Background work also carries:

```text
eventId
causationId
jobId
attempt
```

where those concepts exist.

Do not overload `requestId` as a cross-day business process ID.

---

## 5. Trace context

OpenTelemetry owns distributed trace context.

Use W3C Trace Context (`traceparent`) for transport propagation.

RequestContext may expose the current `traceId`/`spanId` for logs/error responses, but it does not attempt to implement an OTel context manager.

Do not place account IDs, Panda IDs, query text or business payload in OTel baggage merely to make it globally available.

---

## 6. Logging implementation

Use **Pino** as the structured application logger.

Do not add `nestjs-pino` in the baseline.

Reason:

- Nest officially supports a custom DI-managed `LoggerService` and specifically identifies Pino as a common high-performance external logger;
- #311 already established native ALS as the request context;
- PandaAtlas needs one very small logging adapter, not another framework that installs request context/interceptors and creates overlapping lifecycle behavior.

Conceptual setup:

```text
Pino core instance
      |
PinoNestLogger implements Nest LoggerService
      |
NestFactory.create(..., { bufferLogs: true })
      |
app.useLogger(app.get(PinoNestLogger))
```

HTTP/infrastructure/platform providers may use Nest `Logger` calls routed to this backend. Application use cases remain framework-neutral and use a narrow logging/telemetry port only where operation-specific logging is materially useful.

Domain entities/value objects do not log.

---

## 7. Log destination

Production writes JSON logs to process stdout/stderr only.

Do not add:

- local log files;
- file rotation;
- an Elasticsearch client inside the request path;
- an Axiom/Datadog client inside every module;
- synchronous remote log HTTP writes.

Vercel Runtime Logs collect stdout/stderr.

If later retention/query/alerting needs exceed Vercel, configure a Vercel Log Drain or other provider-level integration without changing business-module logging calls.

---

## 8. Log levels

Baseline:

```text
fatal/error   unexpected failure, corruption/invariant breach, exhausted durable work
warn          degraded/retryable condition, security denial worth attention, slow/saturation signal
info          request/job completion and important lifecycle transitions
debug         development/staging diagnostic details; disabled or strongly bounded in production
trace         not a production baseline
```

Expected user/business 4xx conditions are not `error` by default.

Examples:

```text
panda.notFound                 normal 404 -> request completion info
request.validationFailed       normal 400 -> request completion info
publication.preconditionFailed operator conflict -> info/warn based on operation
system.dependencyUnavailable   503 -> warn/error with safe provider classification
system.internal                500 -> error + Sentry
```

---

## 9. One HTTP completion log

Emit one structured request-completion log for ordinary requests.

Do not automatically log both “request started” and “request completed” for every request because that doubles volume without proportional value.

Example shape:

```json
{
  "event": "http.request.completed",
  "service": "zhipanda-api",
  "environment": "production",
  "requestId": "...",
  "correlationId": "...",
  "traceId": "...",
  "method": "GET",
  "route": "/api/v2/pandas/:reference",
  "status": 200,
  "durationMs": 42,
  "errorCode": null
}
```

Use the normalized route template, not a high-cardinality concrete URL.

Do not log raw query strings.

Successful `/health` probes should be excluded or heavily suppressed from normal application logs. `/ready` failures are logged because they represent dependency degradation.

---

## 10. Module/application operation logs

Important commands/jobs use stable event names rather than sentence-only log messages.

Examples:

```text
publication.release.build.completed
publication.release.activation.completed
outbox.dispatch.completed
queue.consumer.batch.completed
notification.delivery.attempt.completed
privacy.operation.phase.completed
pipeline.job.accepted
```

A completion event may carry low-cardinality numeric measurements:

```json
{
  "event": "outbox.dispatch.completed",
  "consumerGroupCount": 3,
  "eventCount": 50,
  "oldestAgeMs": 4200,
  "durationMs": 81,
  "outcome": "success"
}
```

These are intentionally queryable operational measurements.

---

## 11. Sensitive logging rules

Never log by default:

- `Authorization` header;
- cookies;
- JWT access/refresh tokens;
- Supabase signing/private keys;
- DB passwords/connection strings;
- provider API secrets;
- R2 signing secrets;
- R2 presigned URLs or their query signatures;
- full HTTP request/response bodies;
- raw Contribution submissions/attachments;
- raw acquired Evidence bodies;
- personal email/phone/address unless an explicitly reviewed security workflow absolutely requires a redacted form;
- private wildlife coordinates;
- SQL bind values;
- notification body content;
- provider webhook payloads before redaction;
- arbitrary exception `cause` serialization.

Logs may include stable low-cardinality classification and bounded safe identifiers only when operationally required.

Actor/account identity belongs primarily in Audit. General request logs should not automatically include account UUIDs merely because the RequestContext knows them.

---

## 12. Error logging

Known application errors log:

```text
errorCode
errorCategory
status
module
operation
retryable (internal operational classification)
```

Unexpected errors additionally log a safe exception class/name, stack at the controlled error sink, and Sentry event ID when available.

Do not serialize arbitrary error objects into JSON because provider/driver errors often contain SQL, host information or request bodies.

---

## 13. Primary tracing SDK

Use **`@vercel/otel`** as the primary OpenTelemetry SDK in Vercel deployments.

Reasons:

- it is the Vercel-native OTel bootstrap;
- it preserves Vercel tracing integrations/session/trace-drain behavior;
- it provides standard OTel context and custom span APIs;
- manually replacing it with a separate NodeSDK would sacrifice Vercel-specific tracing integration for no current requirement.

Initialize instrumentation before application code.

The precise physical filename/loading mechanism for Nest/Vercel is implemented/tested in #320, but the semantic rule is fixed:

> telemetry provider registration happens before Nest/Fastify/pg modules that require instrumentation are loaded.

---

## 14. Fastify tracing

Use Fastify-maintained OpenTelemetry instrumentation where automatic Fastify HTTP lifecycle spans are useful.

Do not select deprecated `@opentelemetry/instrumentation-fastify` as the long-term dependency; current OpenTelemetry JS guidance has moved Fastify users to the Fastify-maintained instrumentation package.

The instrumentation should:

- create/continue request spans;
- use route templates in names;
- ignore or reduce `/health` probe noise;
- avoid headers/bodies as span attributes;
- integrate with the `@vercel/otel` provider instead of starting another provider.

Application use cases still add manual spans where framework HTTP spans are insufficient.

---

## 15. Application spans

Use `@opentelemetry/api` to create low-cardinality application spans for meaningful boundaries.

Examples:

```text
app.command publication.activate
app.command contribution.submit
app.query panda.profile
app.query lineage.graph
worker.outbox.dispatch
worker.notification.deliver
worker.publication.build
pipeline.contract.accept
```

Do not create spans for every helper/function.

Span attributes use stable categories such as:

```text
app.module = publication
app.operation = activate
app.outcome = success | rejected | failed
worker.consumer = updates
error.code = publication.releaseNotSealed
```

Do not put entity/account UUIDs, free-text search strings, URLs with query strings, notification addresses or raw SQL in span names/attributes.

---

## 16. Database tracing

Do **not** enable generic production PostgreSQL instrumentation that exports raw query text by default.

Current `@opentelemetry/instrumentation-pg` is useful and can measure query/pool spans, but it includes `db.query.text` in its standard span attributes. PandaAtlas deliberately avoids making SQL text part of the default external trace surface because SQL may expose schema/internal field structure and dynamic statements can contain operationally sensitive context.

Instead instrument the DB platform boundary with safe spans/measurements such as:

```text
db.transaction
  module
  operation
  outcome
  durationMs

db.query
  module
  logicalQueryName
  operationKind = select | insert | update | delete | call
  durationMs
```

and pool measurements:

```text
totalCount
idleCount
waitingCount
acquireDurationMs
```

No SQL bind values are emitted.

If a future reviewed instrumentation can guarantee query-text suppression while retaining useful pool spans, it may replace the manual DB instrumentation without changing application code.

---

## 17. Outbound trace propagation

Propagate W3C trace context only to approved service origins where correlation is useful.

Examples:

- PandaAtlas-controlled API/service endpoints;
- approved observability-aware provider endpoint when documented;
- internal/staging equivalents.

Do not blindly propagate trace baggage/headers to every arbitrary evidence URL, crawler destination, media source or third-party web page.

This also avoids leaking internal trace topology into unrelated requests.

---

## 18. Trace sampling

Sampling is operational configuration, not business behavior.

Initial baseline:

```text
local/test      tracing off unless a test explicitly validates it
staging         100% sampled
production      parent-based ratio, initial 10%
```

Production ratio is adjustable from observed volume/cost and incident needs without code changes.

Errors are captured by Sentry independently of trace sampling.

High-impact manually initiated incident/release tests may use supported Vercel session tracing rather than raising the global production ratio.

---

## 19. Sentry role

Use **`@sentry/nestjs`** for:

- unexpected exception aggregation;
- issue grouping;
- deployment/release correlation;
- readable source-mapped stack traces;
- selected dependency failure investigation.

Sentry is not:

- authorization;
- Audit;
- the trace context owner;
- the application logger;
- the durable metrics store for business truth;
- a fallback request path.

---

## 20. Avoid double OpenTelemetry initialization

Vercel OTel is primary.

Configure Sentry with:

```text
skipOpenTelemetrySetup: true
```

so the Sentry SDK does not create a second OTel setup that can conflict with Vercel trace propagation.

This is a hard integration rule, not an optional style preference.

Do not set both Vercel and Sentry up as independent tracing SDK owners.

---

## 21. Sentry capture policy

Capture:

- uncaught/unexpected `500` failures;
- invariant/corruption failures;
- selected repeated provider/dependency failures after classification;
- failed worker attempts when exhausted/meaningfully actionable;
- release build failures when they indicate an application defect rather than expected invalid input.

Do not capture every:

- 400 validation error;
- 401 invalid/missing token;
- 403 capability denial;
- 404;
- expected 409/412 workflow conflict;
- normal queue retry attempt.

Expected errors remain visible through structured logs/metrics without flooding the error tracker.

---

## 22. Sentry privacy and release data

Baseline Sentry config:

```text
sendDefaultPii = false
release = git commit/deployment release identity
environment = staging | production
source maps uploaded during build/release
```

Attach safe tags/context:

```text
service
module
operation
errorCode
requestId
correlationId
traceId
deployment environment
release/commit
```

Use `beforeSend`/equivalent scrubbers as defense-in-depth.

Do not attach full request bodies, auth headers, cookies, SQL, evidence content or signed URLs.

Sentry failure/latency never blocks a user response.

---

## 23. Why not NestJS Observe

NestJS now has an official `@nestjs/observe` platform that can automatically collect Nest requests, jobs, errors, logs and traces.

Do **not** adopt it in the PandaAtlas V2 baseline.

Reason is not technical quality. It is architecture economy:

- Vercel already supplies platform observability/tracing integration;
- Sentry is already selected for error aggregation;
- Pino is selected for structured application logs;
- adding Observe would create another agent/dashboard/credentials/retention/cost plane and duplicate request/error/trace collection.

Revisit only if a concrete Nest lifecycle visibility gap remains after staging evidence.

---

## 24. Metrics baseline

Do not deploy an in-process Prometheus scrape endpoint or a custom metrics collector for the V2 serverless baseline.

Serverless instances are ephemeral and concurrent, so per-process counters are not an authoritative global metric source.

Use three sources:

### Vercel provider metrics

For:

- requests/invocations;
- HTTP status/error rate;
- function duration/active CPU/wall duration where available;
- timeouts;
- deployment/build signals;
- outbound request traces/platform signals.

### Supabase provider/database metrics

For:

- database resource health;
- connection/backend pressure;
- pooler health;
- database/storage/backup/platform signals available from the selected plan.

### PandaAtlas structured operational measurements

Emit numeric low-cardinality completion events through Pino for:

- `db.pool.snapshot` / pool wait;
- `outbox.dispatch.completed`;
- oldest undelivered Outbox age;
- PGMQ queue depth/oldest age;
- retry/DLQ counts;
- notification outcome counts;
- publication build duration/outcome;
- public release state change;
- pipeline job outcomes where relevant.

Vercel Logs/Observability can filter/aggregate structured events. If stronger retention/alerting is required, add a platform Log Drain rather than changing every module.

This is a deliberate simple metrics architecture, not an omission.

---

## 25. Metric/event cardinality rules

Never use these as metric dimensions/grouping fields:

- `requestId`;
- `traceId`;
- account ID;
- Panda/entity ID;
- raw route URL;
- error message text;
- notification recipient;
- search query;
- source URL.

Allowed dimensions are fixed bounded enums such as:

```text
environment
module
operation
route template
status class
errorCode (bounded registry)
consumerKey
queueKey
outcome
providerKey (bounded configured provider)
```

IDs can exist in individual diagnostic logs where approved, but not metric aggregation dimensions.

---

## 26. Minimum operational signals

Before production cutover, the following must be observable and queryable:

```text
HTTP request count/status/latency
unexpected 5xx
readiness failure
DB pool waiting/acquire latency
DB transaction/query duration at logical operation level
Outbox undispatched count + oldest age
PGMQ queue depth + oldest age
retry/DLQ counts
Cron pump outcome + processed count + duration
notification delivery outcomes
publication build outcome/duration
current publication state transitions
R2 upload/finalize failures
```

Exact numerical alert thresholds are calibrated from staging/production evidence rather than hardcoded in architecture documentation.

---

## 27. Alert classes

Production must have actionable alerts/notifications for at least:

- unexpected elevated 5xx/error anomaly;
- repeated `/ready` failure;
- DB connection/acquisition saturation;
- Outbox oldest age substantially exceeding its expected pump cadence;
- PGMQ oldest job/retry/DLQ growth;
- Cron pump repeatedly failing or not successfully draining over multiple expected windows;
- unexpected Publication suspension/takedown state requiring operator awareness;
- publication build repeatedly failing;
- notification provider/DLQ failure spike;
- new high-severity Sentry issue.

Threshold values and delivery channels are operational deployment configuration, finalized during staging/cutover.

---

# Error taxonomy

## 28. Framework-neutral errors

Domain/application code does not throw Nest `HttpException` as business behavior.

Use framework-neutral errors with stable semantic fields.

Conceptually:

```ts
type ErrorCategory =
  | 'invalid_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'precondition_failed'
  | 'rate_limited'
  | 'dependency_unavailable'
  | 'internal';

interface ApplicationErrorShape {
  code: string;
  category: ErrorCategory;
  safeDetail?: string;
  retryable?: boolean;
  cause?: unknown; // internal only
}
```

Concrete implementation may use base classes/discriminated errors, but there is no giant global enum containing every domain rule.

Each module owns its stable error codes while the platform owns category-to-HTTP mapping.

---

## 29. Stable error-code naming

Use:

```text
<namespace>.<camelCaseCondition>
```

Examples:

```text
request.validationFailed
request.invalidCursor

auth.authenticationRequired
auth.invalidToken
auth.recentAuthRequired
auth.aalInsufficient

authorization.capabilityRequired

panda.notFound
panda.slugConflict

contribution.revisionConflict
review.caseNotAssignable
moderation.appealNotAllowed

publication.releaseNotSealed
publication.releaseSchemaUnsupported
publication.preconditionFailed
publication.deliverySuspended

notification.providerUnavailable
notification.deliveryExhausted

privacy.operationConflict

system.dependencyUnavailable
system.internal
```

Codes are machine contracts and are not rewritten casually to improve English wording.

Human UI copy localizes from stable codes where practical.

---

## 30. HTTP mapping

The global exception filter maps semantic categories to #313's wire contract:

| Category / transport condition | HTTP |
| --- | ---: |
| invalid request / DTO validation | 400 |
| unauthenticated | 401 |
| forbidden / recent auth requirement | 403 |
| not found / deliberately hidden | 404 |
| business conflict | 409 |
| failed representation/precondition | 412 |
| body too large | 413 |
| unsupported media type | 415 |
| rate limited | 429 |
| required dependency unavailable | 503 |
| unknown/unclassified | 500 |

`202`, `204`, etc. remain success semantics from #313.

Do not create new status mappings just to reproduce FastAPI behavior.

---

## 31. Problem Details

Continue the #313 RFC 9457 format:

```json
{
  "type": "urn:zhipanda:problem:request-validation-failed",
  "title": "Request validation failed",
  "status": 400,
  "detail": "The request contains invalid fields.",
  "instance": "/api/v2/pandas",
  "code": "request.validationFailed",
  "requestId": "...",
  "errors": []
}
```

Rules:

- `type` is stable and derived from a registered problem type, not arbitrary exception class;
- `title` is stable safe protocol text;
- `detail` is safe and bounded;
- `code` is stable machine-readable application code;
- `requestId` always present for HTTP failures once request context exists;
- `errors` appears only for bounded validation/item diagnostics.

---

## 32. Validation error details

Validation diagnostics use:

```text
path
code
message
```

Never echo rejected values automatically.

Limit the number of field diagnostics returned/logged, conceptually around 20, and summarize additional failures.

This prevents attacker-controlled payloads from creating unbounded response/log output.

---

## 33. Unexpected failures

Unknown exceptions become:

```text
HTTP 500
code = system.internal
safe generic detail
requestId
```

The original exception is available only to controlled internal logs/Sentry after redaction.

No stack trace, SQL, provider response, host, credential, filesystem path or raw cause is returned to the client.

---

## 34. Dependency failures

Infrastructure adapters classify provider failures into framework-neutral errors where actionable.

Examples:

```text
DB unavailable                 system.dependencyUnavailable
R2 unavailable                 media.storageUnavailable
notification provider outage  notification.providerUnavailable
JWKS temporarily unreachable  auth.identityProviderUnavailable (only when cache cannot verify)
```

The HTTP boundary may map a required unavailable dependency to 503.

An internal `retryable` classification helps background jobs; it is not blindly exposed as a public promise that every 503/429 operation can be replayed.

---

## 35. Optimistic/precondition conflicts

Use `412` when an explicit HTTP precondition such as `If-Match` fails.

Use `409` when current business state makes a command invalid but it is not an HTTP representation precondition.

Examples:

```text
stale ETag                          412
same idempotency key, other payload 409
review already completed           409
release is not sealed              409
```

---

## 36. Rate limiting

Rate limiting policy is applied at the HTTP/security platform boundary, not inside domain services.

When enforced:

```text
429
code = request.rateLimited
Retry-After where a meaningful safe retry time is known
```

Keys should use appropriate authenticated account/session/IP/application route groups, not one global count for all traffic.

Exact numeric limits are deployment/security policy and should be calibrated from production/staging behavior.

---

# Testing baseline

## 37. Test runner

Use **Vitest** for Nest V2 TypeScript tests.

Compile test files with **SWC** using the current Nest-supported Vitest recipe:

```text
vitest
unplugin-swc
@swc/core
@vitest/coverage-v8
@nestjs/testing
```

Reasons:

- current official Nest documentation supports Vitest + SWC;
- it fits the modern strict NodeNext/TypeScript stack;
- it avoids introducing Jest merely because the Nest starter historically defaults to it;
- V8 coverage keeps coverage collection straightforward.

This choice does not require converting the existing Web Playwright suite to Vitest.

---

## 38. Type checking is separate from SWC

SWC/Vitest compilation does not replace TypeScript semantic checking.

CI always runs strict `tsc --noEmit` (or equivalent project-reference typecheck) separately.

A passing Vitest suite with type errors is a failing build.

---

## 39. Domain unit tests

Pure domain tests:

- instantiate entities/value objects/policies directly;
- no Nest testing module;
- no DB;
- no HTTP;
- no Kysely;
- no mocks of framework types.

Focus on invariants, transitions and edge cases.

These should be the fastest and most numerous API tests.

---

## 40. Application/use-case tests

Application command/query tests use typed fakes for explicit ports:

```text
repository port
time/ID port
other module public port
outbox interface where command boundary requires it
```

Do not mock private implementation methods.

Tests assert:

- transaction orchestration intent where represented by a fake boundary;
- domain error mapping;
- authorization/domain preconditions passed to the right policy;
- event/outbox creation semantics;
- no remote side effect in DB transaction.

---

## 41. Nest module wiring tests

Use `@nestjs/testing` selectively to prove:

- provider graph resolves;
- public port bindings are correct;
- global guards/filters/interceptors register in the intended order;
- no accidental request-scope/circular workaround is required.

Do not build a Nest TestingModule for every pure application/domain unit test.

---

## 42. Repository integration tests

Repository/persistence tests run against **real disposable PostgreSQL/Supabase** with the actual SQL migration history.

Do not mock Kysely to prove SQL correctness.

Cover:

- constraints;
- indexes/uniqueness semantics where behavior matters;
- transaction rollback;
- `SELECT ... FOR UPDATE` concurrency behavior;
- PostGIS queries;
- JSONB/operators/raw SQL escape hatches;
- PGMQ functions;
- module schema ownership;
- release immutability triggers/constraints;
- outbox atomicity.

Use isolated test data/schema/database lifecycle; never point automated integration tests at production.

---

## 43. PGMQ/background integration tests

Real DB queue tests prove:

- enqueue/read/archive/delete semantics used by V2;
- visibility timeout/retry behavior;
- idempotent `consumer_receipts`;
- duplicate delivery safety;
- Outbox fan-out atomicity;
- DLQ transfer/exhaustion policy;
- bounded worker batch behavior.

A fake in-memory queue may be used for pure application unit tests but cannot replace integration coverage.

---

## 44. HTTP contract tests

Create the real Nest/Fastify application and use Fastify's in-process `inject()`.

Cover:

- URI `/api/v2` routing;
- request DTO validation/400;
- unknown field rejection;
- camelCase contract;
- RFC 9457 bodies;
- request ID response/header;
- auth guard/public marker;
- capability/recent-auth behavior;
- ETag/If-Match;
- idempotency header behavior;
- content type/body size failures;
- representative success response serialization.

Do not start a TCP server for ordinary API contract tests when Fastify injection can exercise the full pipeline.

---

## 45. Full API E2E

A smaller E2E suite runs:

```text
real Nest app
+ local/disposable Supabase PostgreSQL/PostGIS/PGMQ
+ controlled JWT/JWKS test issuer or supported Supabase local Auth
+ real migrations
```

It validates cross-module user journeys, not every error branch.

Examples:

- account bootstrap -> favorite Panda -> personalized Updates eligibility;
- Contribution -> Review -> Curation recommendation boundary;
- approved knowledge -> build/seal/activate Public Release -> public read;
- publication rollback/takedown;
- notification intent -> queue/receipt behavior without sending real production email.

---

## 46. Web E2E remains Playwright

Keep the existing Playwright investment for browser journeys/accessibility.

Migrate its data source from V1 mocks/static truth to the V2 generated client/staging/local API as product slices move.

Critical V2 browser journeys eventually include:

- public Panda discovery/profile;
- lineage;
- map;
- login/auth state;
- favorites/collections/check-ins;
- Updates/notification center where enabled;
- admin Review/Curation/Publication paths;
- accessibility;
- locale/SEO critical behavior.

Do not rewrite Playwright tests merely to standardize on one test runner.

---

## 47. Deployed staging acceptance

The stable staging deployment from #318 is part of testing, not just an operations convenience.

A release candidate must prove against real managed Vercel + staging Supabase:

```text
/health
/ready
JWT/JWKS verification
capability authorization
Kysely transaction
PostGIS representative query
PGMQ send/read/archive
Outbox dispatcher
Cron authentication and one bounded drain
Publication build/seal/activate/rollback/takedown
R2 presigned upload/finalize
public media delivery/takedown
OpenAPI generated-client smoke
critical Web journey
```

This is the evidence that local abstractions match managed-platform reality.

---

## 48. Load/performance acceptance

Do not create a large permanent performance lab in the baseline.

Before cutover and after major DB/query changes, run focused staging load tests for:

- Panda catalog/search;
- Panda profile/lineage;
- map spatial read;
- representative authenticated command;
- queue pump drain;
- publication read after activation.

Measure:

```text
p50/p95/p99 response latency
error rate
DB query/acquire latency
pg waitingCount
Supabase connection pressure
function duration/concurrency
```

Use staging results to tune `DB_POOL_MAX`, query/index design and trace sampling.

Exact load tool/script packaging is #320 implementation detail; a standard tool such as k6/autocannon is preferable to a bespoke load generator.

---

## 49. Coverage policy

Coverage is a regression signal, not the definition of correctness.

Initial floor for **domain + application** TypeScript code:

```text
lines >= 80%
branches >= 80%
```

Do not impose one repository-wide 80% number on infrastructure/generated/HTTP bootstrap files where integration/E2E tests are the appropriate evidence.

Critical security/publication/privacy invariants require explicit tests regardless of coverage percentage.

Generated code is excluded from coverage.

A later team may raise the floor; lowering it requires an explicit reviewed architecture/quality change rather than silently editing CI.

---

## 50. Test determinism

Use injected/explicit abstractions for nondeterministic domain inputs when they materially affect behavior:

```text
Clock
ID generator
random game selector/seed
```

Do not globally mock Date/crypto/network in ways that hide real behavior across unrelated tests.

Repository integration tests use transaction/test-data isolation rather than relying on execution order.

---

## 51. No production providers in tests

CI tests do not send:

- real production email;
- production R2 mutations;
- production Supabase writes;
- production Sentry test noise except a deliberate deployment integration test;
- public crawler traffic unless a bounded explicit acquisition workflow is being tested.

Use provider test/staging adapters or contract fixtures.

---

# Architecture enforcement

## 52. Architecture rules are executable

V2 architectural boundaries cannot exist only in Markdown.

Keep one machine-readable contract conceptually containing:

```text
business modules
allowed synchronous module dependencies
public import surfaces
owned PostgreSQL schemas/tables
allowed platform capabilities
layer restrictions
forbidden legacy paths/packages
```

The exact filename/package location is #320, but there is one canonical machine-readable architecture inventory.

Human architecture docs explain why; CI contracts decide whether a source graph is legal.

---

## 53. dependency-cruiser

Use **dependency-cruiser** as the TypeScript dependency-graph enforcement tool.

Fail CI on:

- runtime circular dependencies;
- business-module cycles;
- module-to-module edges not in the approved graph;
- imports into another module's internal paths;
- production source importing test files;
- production source importing dev-only dependencies;
- unresolved/undeclared npm dependencies;
- forbidden legacy paths/packages.

Configure violations as errors, not informational warnings.

Do not use a checked-in “ignore all known violations” baseline for V2 new code. V2 starts clean.

---

## 54. Module public surfaces

Cross-business-module imports must target only explicit public application ports/facades.

Conceptually legal:

```text
modules/life-history/application/ports/panda-reference-reader
modules/review/application/public
```

Conceptually illegal:

```text
modules/panda/infrastructure/repository
modules/panda/domain/internal-entity
modules/panda/http/dto
```

Do not use barrel files that re-export an entire module tree merely to satisfy the checker.

---

## 55. Layer dependency rules

Baseline direction within a module:

```text
http ----------> application -------> domain
                    ^                  ^
                    |                  |
infrastructure -----+------------------+
```

More precisely:

- `domain` imports only domain-safe TS/standard-library code and explicitly approved pure packages;
- `application` may depend on domain and framework-neutral ports;
- `infrastructure` implements application/domain ports and may depend on Kysely/pg/provider SDKs;
- `http` depends on application interfaces/DTO mapping and Nest/Fastify/OpenAPI decorators;
- domain/application do not depend on HTTP;
- HTTP does not import repositories/Kysely/private persistence records;
- infrastructure never becomes the business module's public cross-module interface.

---

## 56. ESLint restricted imports

Use ESLint `no-restricted-imports`/targeted rules for local package/layer restrictions that are simpler than graph analysis.

Examples:

`domain/**` forbidden imports:

```text
@nestjs/*
@nestjs/swagger
fastify
kysely
pg
@supabase/*
pino
@sentry/*
@opentelemetry/*
HTTP DTO paths
```

Also forbid:

- `application/**` importing Nest/Fastify/OpenAPI/Pino/Sentry/OpenTelemetry/provider SDKs; application use cases stay framework-neutral behind ports;
- application/domain importing another module's `infrastructure`/`http`;
- ordinary business modules importing platform internals not exposed as a narrow capability;
- `src/**` importing test fixtures/helpers;
- direct `process.env` outside platform config;
- direct provider SDK imports outside owning infrastructure adapters.

---

## 57. V2-specific static checker

Some important rules are semantic/path conventions not reliably expressed by dependency-cruiser alone.

Use a small focused TypeScript AST/path checker for V2.

It should fail on at least:

- business `forwardRef(`;
- business `ModuleRef` service-locator use;
- business `@Global()`;
- request-scoped provider declarations unless explicitly allowlisted with reason;
- `modules/**/shared`, `common`, `utils` escape-hatch directories;
- cross-module repository imports;
- cross-module persistence-table/full generated `Database` type access;
- dynamic SQL identifier construction in reviewed persistence surfaces;
- raw SQL writes to schemas/tables outside module ownership/explicit infrastructure integration targets;
- unauthorized `process.env` reads;
- durable work implemented with `setInterval`/startup polling;
- legacy FastAPI/Worker/D1/Wrangler compatibility imports in V2 packages.

Keep the checker narrow and test it with positive/negative fixtures.

Do not build a general-purpose TypeScript compiler plugin.

---

## 58. Storage ownership enforcement

V1 already proved that machine-readable storage-write ownership checks are useful. V2 keeps that **principle**, not the Python checker implementation.

Each business module owns a private PostgreSQL schema/table set.

CI should detect application persistence writes and ensure they target:

- the current module's owned schema/table; or
- an exact explicitly approved platform integration target such as Outbox via the platform transaction participant.

No wildcard “may write integration.*” exception for every module if the platform Outbox API can encapsulate it.

Cross-module writes remain forbidden even if PostgreSQL credentials technically allow them.

---

## 59. Database read ownership

Also prevent arbitrary private cross-module SQL reads.

A module may not solve a dependency by writing:

```sql
select ... from other_module.private_table
```

Cross-module application reads go through public module interfaces unless a deliberately shared derived delivery/read schema such as #317 `public_read` has a defined reader ownership rule.

Platform/admin diagnostic SQL is separately scoped and not an excuse for business-module leakage.

---

## 60. No architecture exceptions for migration convenience

Because V2 is a rebuild, the architecture checker does not carry a large “legacy exception” list to make FastAPI-shaped translated code pass.

If migrated business code violates a V2 boundary:

- refactor it into the correct target module/port;
- or record a new target architecture decision if evidence proves the boundary itself is wrong.

Do not add `// architecture-ignore` to make a migration slice green without a deliberate reviewed reason and expiry.

---

# Contract/schema drift

## 61. OpenAPI drift

#313's generated OpenAPI + TS client are derived artifacts.

CI:

1. builds the Nest application metadata/spec deterministically;
2. generates `openapi.v2.json`;
3. generates the TypeScript API client;
4. fails when tracked artifacts differ from generated output.

CI does not silently commit regenerated artifacts.

A developer intentionally changes the HTTP contract and commits the regenerated result in the same change.

---

## 62. OpenAPI compatibility checks

Before V2 production cutover, breaking changes within the still-private migration API are allowed when intentional; there is no promise to keep V1 compatibility.

After V2 becomes the production contract, add an OpenAPI semantic diff gate against the production baseline:

- additive compatible changes pass normal review;
- breaking changes fail/require explicit reviewed API-version decision.

Do not confuse “no V1 compatibility” with “V2 production API can break accidentally forever.”

---

## 63. Shared JSON Schema drift

#316 shared contracts remain canonical Draft 2020-12 JSON Schema.

Every shared schema in CI must:

- validate as a Draft 2020-12 schema in Python;
- compile under Ajv 2020 strict mode;
- validate golden positive fixtures;
- reject negative fixtures for important invariants;
- keep schema `$id`/version rules stable;
- regenerate derived TS/Python conveniences when applicable and fail on drift.

The previously discovered acquisition-bundle/Ajv strictTypes mismatch becomes a regression fixture during V2 migration rather than being hidden by disabling strict mode.

---

## 64. Integration event contract drift

Durable cross-module Integration Events are versioned contracts.

CI validates:

```text
event type
version
schema
producer fixture
consumer fixture/compatibility
```

Do not modify the meaning of an already-persisted `eventType + version` schema in place.

Breaking meaning creates a new event version and bounded consumer migration.

---

## 65. SQL migration authority and drift

`infra/supabase/migrations/*.sql` remains the sole schema migration authority from #312.

CI must prove:

1. an empty/local Supabase can replay the full migration history;
2. expected extensions/schemas exist;
3. PostgreSQL lint/static checks configured by the project pass;
4. generated Kysely database types match the resulting schema;
5. repository integration tests pass on that schema.

No Prisma/TypeORM/Kysely schema-sync step participates.

---

## 66. Generated DB type surface

Generate a full physical DB type only inside platform database tooling.

Business modules import narrowed owned-table types from their module infrastructure boundary.

CI prevents business module source from importing the full generated database shape directly.

This turns #312's storage-autocomplete boundary into an enforceable rule rather than a coding convention.

---

# CI and release quality gates

## 67. Fast PR gate

Every API-affecting PR runs at least:

```text
format/lint
strict TS typecheck
dependency-cruiser
V2 architecture/storage checker
OpenAPI/client drift
shared JSON Schema validation
unit/application/module Vitest
coverage floor for domain/application
```

These do not require a remote production/staging dependency.

---

## 68. Database/integration gate

When API persistence/contracts/migrations are affected, CI additionally runs:

```text
clean disposable Supabase/PostgreSQL setup
full SQL migration replay
Kysely DB type generation/drift
repository integration
PostGIS tests
PGMQ/Outbox tests
Fastify HTTP contract/e2e
```

Changed-scope optimization may skip obviously unrelated jobs, but the default failure mode must be conservative: if dependency impact cannot be determined confidently, run the broader gate.

---

## 69. Web-connected gate

For changes that affect the public/generated client or product journeys:

```text
Next typecheck/build
critical Playwright smoke
accessibility subset
API generated-client integration
```

Existing Web testing infrastructure is reused and gradually pointed at V2.

---

## 70. Staging promotion gate

Before production promotion, stable staging must be green for:

- managed `/health` + `/ready`;
- JWT/JWKS/auth capability tests;
- representative DB/PostGIS/PGMQ path;
- Outbox/Cron pump;
- Publication build/activate/rollback/takedown;
- R2 upload/finalize/takedown path;
- generated API client;
- critical Playwright journeys;
- focused load test/connection evidence;
- no unresolved contract/schema drift;
- observability smoke showing request log + trace + deliberately triggered non-production Sentry exception.

---

## 71. Production promotion gate

Production promotion requires:

```text
all required staging evidence green
protected migration gate green
production deployment built from reviewed commit
Sentry release/source maps prepared
required secrets/config present
backup/recovery prerequisites from #321 satisfied
known rollback target available
```

Production cutover does not proceed because “unit tests pass” while managed staging evidence is absent.

---

## 72. CI evidence

Important release/migration/deployment workflows produce immutable or retained evidence artifacts containing safe metadata such as:

```text
commit SHA
deployment ID
test/gate names + result
schema migration head
OpenAPI artifact hash
release ID/version
staging base URL identity
load-test summary
```

Do not include secret connection strings/tokens in evidence artifacts.

The existing V1 practice of guarded workflow inputs and uploaded release-gate evidence is a useful operational principle; its FastAPI/Public-Release-specific scripts are not copied into V2.

---

## 73. Flaky tests

A flaky test is a defect.

Do not permanently add broad automatic retries that convert nondeterministic tests into green CI.

Allowed:

- a small bounded browser/network retry in staging where the platform itself is eventually consistent and the retry semantics are explicit;
- quarantine only with an owner, issue and expiry while the defect is being fixed.

Unit/integration tests should be deterministic without retry.

---

## 74. Test data and secrets

Test fixtures use synthetic identities/content.

No production data dump is casually copied into developer/CI environments.

If a sanitized production-derived fixture is ever needed, it becomes a reviewed artifact with a documented anonymization process.

---

# Security-specific observability and tests

## 75. Auth tests

At minimum prove:

- missing Bearer -> 401;
- malformed/invalid signature -> 401;
- wrong issuer/audience where enforced -> 401;
- expired token -> 401;
- active verified JWT + inactive PandaAtlas account -> denied;
- no capability -> 403/hidden response as policy requires;
- recent-auth requirement cannot be satisfied by token refresh `iat` alone;
- AAL2/live-session gates apply only to configured high-impact capability;
- JWT email/custom role cannot grant authorization;
- public endpoint is public only when explicitly marked.

---

## 76. Sensitive-output tests

Automated tests inspect representative logs/Problem Details/traces to ensure they do not contain:

```text
Authorization bearer token
cookie
password
DB URL password
presigned R2 signature
raw submission text where prohibited
precise protected coordinates
SQL bind values
stack trace in HTTP response
```

This is particularly important because observability instrumentation can otherwise become a data-leak path.

---

## 77. Publication safety tests

#317's release/takedown properties are hard gates:

- unsafe public field prevents seal;
- sealed release rows/members cannot mutate;
- activation pointer + transition + Outbox atomic;
- rollback returns exact older release without copying content;
- emergency takedown survives rollback;
- suspended publication fails public reads closed;
- no fallback to private/latest authoritative data;
- public media takedown does not expose a public URL through supported API.

---

## 78. Architecture rule tests

Architecture checker configuration itself has tests.

For each important rule maintain small fixtures/examples that prove:

- legal same-module dependency passes;
- allowed public module edge passes;
- private cross-module import fails;
- cycle fails;
- domain -> Nest import fails;
- HTTP -> repository import fails;
- cross-schema write fails;
- business `forwardRef` fails;
- direct `process.env` in business source fails;
- V1 Worker/D1 compatibility import fails.

Do not trust an architecture checker merely because it exits zero on the real repository.

---

# Rejected alternatives

## 79. Nest built-in text logger only

Rejected for production because PandaAtlas needs stable structured fields/queryability/correlation. Pino adds that with small runtime overhead and standard Nest logger integration.

## 80. `nestjs-pino`

Not selected for the baseline because #311 already has one native ALS RequestContext. Adding another framework integration creates overlapping request-context/request-logging machinery for little benefit. Direct Pino + Nest LoggerService is sufficient.

## 81. NestJS Observe

Not selected because it duplicates Vercel/Sentry/Pino responsibilities and adds a third telemetry backend. Revisit only for demonstrated missing Nest lifecycle visibility.

## 82. Sentry owns tracing

Rejected. Vercel OTel owns tracing; Sentry disables automatic OTel setup and focuses on error aggregation.

## 83. Manual generic NodeSDK replacing `@vercel/otel`

Rejected because it loses Vercel-native session/trace-drain integration without a current requirement.

## 84. Automatic PostgreSQL query-text tracing

Rejected as default because raw SQL text is unnecessary external trace data and increases sensitive/internal metadata exposure. Use logical DB spans/measurements.

## 85. Prometheus scrape endpoint

Rejected for serverless baseline because ephemeral per-instance metrics do not form a clean global scrape model and add another operational system.

## 86. Elasticsearch/Datadog/Axiom client in business code

Rejected. Logs go to stdout and external retention/analysis integrates at the platform/drain boundary.

## 87. Jest solely because Nest starter uses it

Rejected. Current Nest documentation explicitly supports Vitest/SWC; V2 can start on the modern runner without migration compatibility requirements.

## 88. Mocked Kysely repository tests only

Rejected because they cannot prove PostgreSQL constraints, PostGIS, locks, transaction semantics or PGMQ behavior.

## 89. One giant custom architecture checker

Rejected. Use the established tool best suited to each rule:

```text
dependency-cruiser -> graph/edge/cycle/npm dependency rules
ESLint              -> import/source-level local restrictions
small V2 checker     -> storage ownership/Nest-specific conventions not expressible cleanly elsewhere
```

## 90. 100% global code coverage

Rejected. It rewards low-value tests and gives false confidence. Use an initial 80% floor for domain/application plus explicit invariant/integration/E2E gates.

---

# Migration implications

## 91. Do not migrate V1 observability structure

There is little coherent V1 observability stack to preserve. Do not translate Python `logging.getLogger()` calls mechanically.

During business migration:

- move meaningful operation classification into stable Pino events;
- remove ad hoc print/log messages that expose payloads;
- map FastAPI/SQLAlchemy exceptions into the V2 error registry;
- add the correct test layer rather than translating pytest fixture shape blindly.

---

## 92. Reuse V1 enforcement philosophy, not implementation

Existing V1 assets already prove two useful principles:

- dependency rules can be machine-readable and fail closed;
- storage-write ownership can be statically checked.

V2 does **not** retain:

```text
services/api/scripts/check_domain_dependencies.py
services/api/scripts/check_domain_storage_writes.py
FastAPI app.* path contracts
review_moderation/privacy-only guarded slice
```

It creates TypeScript-wide enforcement for all 18 V2 modules from the first implementation slices.

---

## 93. Existing Playwright investment is retained

Browser behavior tests are product evidence, not FastAPI architecture.

Keep useful critical journeys/accessibility behavior and change their backend/data setup to V2 as endpoints become available.

Delete tests whose only purpose is Worker/D1/FastAPI compatibility after #321 retires those runtimes.

---

# Required initial implementation artifacts

## 94. API platform observability components

Conceptually:

```text
services/api/src/platform/observability/
  logger/
    pino-logger.service.ts
    redaction.ts
  tracing/
    instrumentation.ts
    tracing.service.ts
  request-observability.interceptor.ts
  error-reporting/
    sentry.adapter.ts
```

Exact files are #320, but ownership is platform, not a business module.

## 95. Error components

Conceptually:

```text
platform/http/errors/
  problem-details.mapper.ts
  global-exception.filter.ts
  validation-error.mapper.ts

application/domain module
  module-owned error codes/classes
```

Do not create a giant `errors.ts` containing all module behavior.

## 96. Test layout

Conceptually:

```text
src/modules/.../*.spec.ts             fast pure/unit tests
services/api/test/integration/...     DB/PGMQ integration
services/api/test/e2e/...             full API journeys
apps/web/tests/...                    Playwright
contracts/...                         schema/golden fixtures
```

Exact package scripts/aliases are #320.

---

# External facts verified for this decision

Current official/upstream documentation checked on 2026-08-26 establishes:

- Nest supports replacing its logger with a DI-managed custom `LoggerService`, including the `bufferLogs` + `app.useLogger(app.get(...))` pattern, and identifies Pino as a popular external logger choice;
- Nest currently documents Vitest with `unplugin-swc`, `@swc/core` and `@vitest/coverage-v8` as a supported test setup;
- Nest has an official Sentry recipe for `@sentry/nestjs` and recommends source maps for readable production stacks;
- Vercel's `@vercel/otel` is the platform-supported OTel bootstrap and manual OTel SDK replacement loses Vercel Session Tracing/Trace Drains;
- Vercel explicitly warns that Sentry v8+ and Vercel OTel can conflict when both set up OTel and documents `skipOpenTelemetrySetup: true` when Vercel OTel is primary;
- Vercel Observability exposes function request/error/duration/platform signals and captures application stdout logs;
- NestJS now offers the official `@nestjs/observe` observability product, which is intentionally not selected here because the chosen V2 stack already has overlapping telemetry planes;
- OpenTelemetry/Fastify guidance now points to Fastify's own OTel instrumentation rather than the deprecated OTel contrib Fastify instrumentation;
- dependency-cruiser supports TypeScript forbidden/allowed dependency rules, cycles, folder-level checks and dependency-type rules that can fail CI.

---

# Decisions deferred

- Exact npm workspace/package/script placement, test aliases and config file names: #320.
- Exact GitHub workflow splitting/changed-scope orchestration: #320.
- Exact production/staging alert thresholds/channels and final trace sample ratio after staging volume evidence: implementation/#321 operational acceptance.
- Exact Vercel/Sentry project provisioning and secret names: #321 deployment/cutover.
- Exact RPO/RTO/rollback evidence requirements: #321.
- Consolidated final baseline and implementation slices: #322.

---

# Acceptance for #319

Later planning can assume all of the following without reopening this ticket:

- native AsyncLocalStorage is the one RequestContext; requestId/correlationId/trace context are not implemented by parallel logging/APM contexts;
- server-generated request IDs are returned in `X-Request-Id` and RFC 9457 errors;
- Pino JSON logging is the application logging baseline through a DI-managed Nest `LoggerService`;
- request logs use normalized route templates, one completion event and strict sensitive-data redaction;
- Vercel Runtime Logs are the first log destination; external retention/analysis attaches through drains rather than business-code provider clients;
- `@vercel/otel` owns tracing; OpenTelemetry API is used for low-cardinality application/worker spans;
- Fastify-maintained OTel instrumentation may instrument the HTTP lifecycle; deprecated OTel Fastify instrumentation is not selected;
- PostgreSQL raw query-text auto-instrumentation is not the production default; DB logical operations/pool saturation are instrumented safely without bind values;
- Sentry owns unexpected error aggregation/source maps and uses `skipOpenTelemetrySetup: true` to avoid competing OTel providers;
- NestJS Observe is explicitly not in the baseline unless a later measured gap justifies another platform;
- no Prometheus/custom metrics collector is required initially; Vercel/Supabase metrics plus structured low-cardinality operational measurement events cover the baseline;
- error codes follow stable `<namespace>.<condition>` semantics and map centrally to RFC 9457/HTTP categories;
- unexpected errors become `system.internal` with safe client output and controlled internal diagnostics;
- Vitest + SWC + V8 coverage is the Nest V2 TypeScript test stack, with strict typecheck run separately;
- domain/application code has an initial 80% line/branch coverage floor, while infrastructure correctness relies on integration/E2E evidence rather than a global percentage;
- Kysely/PostGIS/PGMQ repositories are tested against real disposable/local PostgreSQL/Supabase, not merely mocks;
- Fastify `inject()` is the standard HTTP contract test mechanism;
- Playwright remains the Web/browser E2E tool;
- stable managed staging acceptance is a required release gate;
- dependency-cruiser enforces graph/cycle/module boundaries, ESLint enforces local import/layer restrictions, and a small tested V2 checker enforces storage ownership/Nest-specific rules;
- V2 starts without a broad legacy architecture exception baseline;
- OpenAPI/client, JSON Schema, integration-event schemas and generated Kysely DB types are CI drift gates;
- full SQL migration replay on a disposable database is a CI prerequisite for DB-affecting changes;
- production promotion requires staging/auth/DB/queue/publication/Web evidence and not merely unit-test success.
