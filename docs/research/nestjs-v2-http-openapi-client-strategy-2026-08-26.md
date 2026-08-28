# NestJS V2 HTTP contract, OpenAPI, and generated client strategy

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #313 `Define the HTTP contract, OpenAPI, and generated client strategy`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

What should be the single source of truth for NestJS V2 HTTP contracts, DTO validation, OpenAPI generation, API versioning, compatibility policy, and generated TypeScript clients so Next.js and any trusted clients stop maintaining duplicate hand-written transport types?

## Decision summary

PandaAtlas V2 uses a **code-first HTTP contract with generated artifacts**:

```text
Nest controller route metadata
+ request/response DTO classes
+ class-validator rules
+ explicit OpenAPI protocol annotations
            |
            v
      @nestjs/swagger
            |
            v
 contracts/http/openapi.v2.json
            |
            v
 openapi-typescript
            |
            v
 generated TypeScript transport types
            |
            v
        openapi-fetch
            |
            v
 Next.js / trusted TypeScript callers
```

The only hand-authored HTTP truth is the NestJS HTTP boundary. The checked OpenAPI document and TypeScript client types are **derived artifacts** and must never be edited as independent sources of truth.

The API starts as URI-versioned **`/api/v2`**. PandaAtlas does not reproduce FastAPI `/api/v1` compatibility routes inside NestJS.

## Why the V1 contract model must be replaced

V1 currently has several overlapping representations of the same transport contract:

- FastAPI route/Pydantic declarations;
- FastAPI-generated OpenAPI;
- a hand-maintained 5,000+ line `services/api/openapi/panda-atlas-v1.yaml`;
- multiple hand-maintained OpenAPI fragments for governance domains;
- `contracts/public-api-v1.json`, which repeats field presence/nullability from OpenAPI;
- large hand-written transport type sets in the Next.js application;
- custom fetch wrappers that parse JSON into `unknown` and cast it with `as T`.

For example, `apps/web/features/contribute/types.ts` manually reproduces Submission, Revision, Attachment, Status and command-result response shapes, while `apps/web/features/contribute/api.ts` parses an unvalidated body and casts it to a generic caller-selected type.

This is a drift-prone architecture. NestJS V2 must remove it rather than recreate it in TypeScript.

## Contract authority model

There are three distinct artifacts but only one authored authority.

### 1. Authored authority: Nest HTTP boundary

The following together define the route contract:

- `@Controller`, method decorators and route parameters;
- concrete request DTO classes;
- concrete response DTO classes;
- runtime validation decorators;
- explicit response/status/content/security/header OpenAPI metadata where reflection cannot determine the contract safely;
- stable operation IDs.

This code is the only place engineers intentionally change the HTTP contract.

### 2. Canonical wire artifact: generated OpenAPI

Generate a deterministic checked artifact conceptually at:

```text
contracts/http/openapi.v2.json
```

This is the canonical language-neutral representation consumed by code generators, CI, review tooling and any trusted non-TypeScript client.

It is checked in so contract changes are visible in pull requests, but it is **generated-only**. CI regenerates it and fails if the checked file differs.

There are no manually maintained module-level OpenAPI YAML fragments in V2.

### 3. Derived TypeScript client

Generate TypeScript transport types from the checked OpenAPI document and use one thin fetch client runtime.

Selected stack as of 2026-08-26:

- `openapi-typescript` 7.x; current checked version during this research: `7.13.0`;
- `openapi-fetch`; current checked version during this research: `0.17.0`.

A repository-local package is expected conceptually:

```text
packages/api-client/
  src/
    generated/
      schema.d.ts
    client.ts
    index.ts
```

The exact package/build layout remains #320, but the transport strategy is fixed here.

## Generator validation against PandaAtlas

`openapi-typescript 7.13.0` was run against the existing PandaAtlas OpenAPI 3.1 contract:

```text
services/api/openapi/panda-atlas-v1.yaml
```

The current 5,467-line contract generated a 7,976-line TypeScript declaration file successfully in approximately 188 ms.

This verifies that the selected generator can consume the current PandaAtlas schema complexity; the choice is not based only on a toy example.

## OpenAPI version

V2 standardizes on **OpenAPI 3.1.0**.

Reasons:

- PandaAtlas already uses OpenAPI 3.1.0 in its current checked contract;
- current `@nestjs/swagger` 11.4.x supports setting the OpenAPI version explicitly through `DocumentBuilder.setOpenAPIVersion(...)` and contains OpenAPI 3.1-aware behavior;
- `openapi-typescript` supports OpenAPI 3.x and successfully consumed PandaAtlas's existing 3.1 document;
- 3.1 gives modern JSON Schema semantics without moving prematurely to OpenAPI 3.2 while the ecosystem is still catching up.

The document generator must explicitly set `3.1.0`; do not depend on the Nest Swagger default, which remains `3.0.0` unless configured.

## Nest Swagger strategy

Use `@nestjs/swagger` 11.x aligned with NestJS 11.

The Swagger CLI plugin should be enabled to avoid duplicating `@ApiProperty` on every field.

Baseline plugin intent:

```json
{
  "name": "@nestjs/swagger",
  "options": {
    "classValidatorShim": true,
    "introspectComments": true,
    "esmCompatible": true,
    "dtoFileNameSuffix": [".dto.ts"]
  }
}
```

Exact compiler integration is finalized by #320. If #320 chooses SWC, it must preserve Swagger plugin metadata generation rather than silently producing a weaker contract.

### What the plugin may infer

The plugin may infer routine schema information such as:

- property types;
- optional/required state;
- arrays;
- basic enums;
- defaults;
- validation bounds derived from class-validator;
- response model metadata where safe.

### What must stay explicit

Use explicit OpenAPI annotations when contract meaning cannot be reliably inferred:

- all non-default failure response status codes;
- authentication/security requirements;
- custom headers;
- `ETag` / `If-Match` semantics;
- multipart form uploads;
- file/binary/NDJSON content;
- discriminated unions and important `oneOf`/`anyOf` shapes;
- named enum schemas where stable reuse matters;
- examples that are useful to consumers;
- endpoint deprecation;
- response variants whose status codes have different shapes.

Do not contort domain/application code merely to improve Swagger reflection.

## DTO rules

### Request DTOs

Request DTOs are concrete classes in the owning module's HTTP adapter, consistent with #311.

They contain:

- transport property names;
- class-validator decorators;
- transport-only transformation where explicitly required;
- OpenAPI annotations only where automatic inference is insufficient.

They do not contain domain behavior.

### Response DTOs

Response contracts are also concrete transport classes or explicitly described schemas.

Controllers/application presenters map domain/application results into response DTO shapes. A Kysely row, database record, domain entity or internal application result must never accidentally become the public contract merely because TypeScript structural typing allows it.

### No DTO sharing with the frontend

Next.js must **not import Nest DTO classes**.

Rejected architecture:

```text
packages/shared-types/
  CreatePandaDto.ts
  PandaResponseDto.ts

NestJS <---- same classes ----> Next.js
```

That couples the frontend to decorators/runtime framework concerns and creates a pseudo-shared domain.

Instead:

```text
Nest DTO classes
    -> OpenAPI
    -> generated transport types
    -> Next.js
```

## Transport naming conventions

V2 intentionally drops the Python/FastAPI wire-format legacy.

### JSON and query fields

Use **camelCase**:

```json
{
  "pandaId": "...",
  "birthDate": "2020-07-21",
  "currentPlace": null,
  "sourceIds": []
}
```

Do not continue V1 `snake_case` merely for compatibility.

Database columns may remain `snake_case`; persistence mapping is an infrastructure concern.

Do not install a magical global snake/camel transformer. DTOs declare the actual V2 wire names explicitly so generated OpenAPI exactly matches runtime behavior.

### Paths

Use lower-case resource paths with kebab-case segments where a multiword segment is needed:

```text
/api/v2/pandas
/api/v2/pandas/{pandaId}/life-history
/api/v2/me/seen-pandas
/api/v2/admin/review-cases
```

### Stable identifiers

Write/command routes use stable canonical IDs, normally UUIDs.

Read lookup routes may support a deliberate human-facing reference such as a Panda canonical slug, but the parameter must be named as a reference (`pandaRef`) rather than pretending every string is an ID.

Feature-specific Panda IDs remain forbidden by #310.

## JSON primitive conventions

- UUID -> JSON string with `format: uuid`.
- Instant/timestamp -> RFC 3339 UTC string with `format: date-time`.
- Calendar date -> `YYYY-MM-DD` string with `format: date`.
- Duration -> explicit unit in field name or an ISO-8601 duration contract; never ambiguous numbers.
- Decimal values requiring exactness -> decimal string when JavaScript number precision is unsafe.
- PostgreSQL `bigint` that may exceed JavaScript safe integer range -> decimal string.
- Binary payloads -> explicit file/content-type response rather than base64 inside ordinary JSON unless the specific contract requires it.

## Optional versus nullable

V2 treats these as different meanings.

- **optional/absent**: this property is not present for this representation or request operation;
- **nullable**: the property is part of the representation but its value is currently unknown/not applicable.

Do not use optional and null interchangeably just because Python previously allowed both.

For stable response DTOs, prefer a present nullable field when the concept belongs to the representation but knowledge is missing. This makes evidence-honest unknown states explicit.

For PATCH/command request DTOs, omission means "not requested to change". `null` may only mean "explicitly clear" where the domain allows that operation.

## Success response shape

Do **not** introduce a universal `{ data, meta }` response wrapper.

Return the resource/read model directly when one object is the contract:

```json
{
  "id": "...",
  "canonicalSlug": "he-hua",
  "names": []
}
```

Use explicit page/read models where metadata is actually part of the result:

```json
{
  "items": [],
  "nextCursor": null
}
```

Release identity, ETag, cache directives and request tracing that are HTTP metadata remain headers unless #317 determines a specific value is business response content.

This keeps transport shapes shallow and avoids forcing every module through one generic envelope.

## Error contract

V2 replaces FastAPI's incidental `{ "detail": ... }` error shape with **RFC 9457 Problem Details** using:

```text
Content-Type: application/problem+json
```

Canonical shape:

```json
{
  "type": "urn:zhipanda:problem:request-validation-failed",
  "title": "Request validation failed",
  "status": 400,
  "detail": "The request contains invalid fields.",
  "instance": "/api/v2/pandas",
  "code": "request.validationFailed",
  "requestId": "...",
  "errors": [
    {
      "path": "body.birthDate",
      "code": "invalidDate",
      "message": "Must be an ISO calendar date."
    }
  ]
}
```

Rules:

1. `type`, `title`, `status` and safe `detail` follow Problem Details semantics.
2. `code` is a stable machine-readable PandaAtlas extension.
3. `requestId` links the client error to observability.
4. `errors` is optional and reserved for bounded field/item diagnostics.
5. No stack trace, SQL, token, secret, private storage path or internal exception message crosses this boundary.
6. UI copy should normally localize from stable codes instead of presenting arbitrary backend exception text as product copy.

The exhaustive error-code taxonomy is #319; this ticket fixes the **wire format**.

## HTTP status conventions

V2 uses HTTP semantics consistently rather than inheriting FastAPI defaults.

Baseline:

- `200` successful read or command returning a result;
- `201` resource/workflow creation when a new durable resource is created;
- `202` accepted only when work is genuinely asynchronous and not yet complete;
- `204` successful operation with intentionally no response body;
- `400` malformed/invalid request DTO, query or parameter;
- `401` missing/invalid authentication;
- `403` authenticated but not authorized/recent-auth insufficient where safe to reveal;
- `404` resource missing or intentionally hidden protected resource;
- `409` business state/idempotency conflict not represented as an HTTP precondition;
- `412` failed `If-Match` / representation precondition;
- `413` request/upload too large where applicable;
- `415` unsupported media type;
- `429` enforced rate limit;
- `503` required dependency/runtime capability unavailable.

Do not retain FastAPI-specific `422` as the standard DTO validation response merely for compatibility; Nest V2 standardizes request validation failures on `400`.

## Concurrency and idempotency at the HTTP layer

### Optimistic representation concurrency

When a mutable resource exposes an ETag, modifying commands use:

```text
ETag: "..."
If-Match: "..."
```

A stale precondition returns `412 Problem Details`.

Do not duplicate the same representation version in both `If-Match` and a request-body `expected_version` unless the domain has a genuinely different business version concept.

### Command idempotency

Commands that must be safely retried use the standard transport header:

```text
Idempotency-Key: <opaque caller-generated key>
```

Do not put generic transport idempotency keys into every JSON command body as V1 often does.

The owning application command persists/validates replay semantics; the header is only the transport location.

## API versioning

Use Nest URI versioning:

```text
/api/v2/...
```

Conceptually:

```ts
app.setGlobalPrefix('api');
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '2',
});
```

Exact bootstrap placement follows #311/#320.

### Version-neutral routes

Only infrastructure routes may be version-neutral, for example:

```text
/health
/ready
```

Business routes are versioned.

### Why URI versioning

URI versioning is selected over header/media-type versioning because it is:

- explicit in logs, links and incident traces;
- simple for Next.js server calls and generated clients;
- easy to route during FastAPI/Nest cutover;
- easy to cache/CDN by URL;
- directly supported by NestJS.

## Compatibility policy

### FastAPI V1 compatibility

NestJS V2 provides **no `/api/v1` compatibility implementation**.

During migration, FastAPI V1 and NestJS V2 may coexist as separate runtimes according to #321, but Nest does not contain alias controllers, legacy DTOs, snake_case adapters or fallback route handling solely to imitate V1.

### Compatibility inside V2

Once `/api/v2` is published, keep its contract coherent:

Safe/additive examples include:

- adding a new endpoint;
- adding a truly optional request field with a server default;
- adding a response field when consumers are not contractually required to reject unknown fields.

Treat as breaking by default:

- deleting or renaming a path, parameter or field;
- changing camelCase names;
- changing field type or format;
- making optional input required;
- changing nullability semantics;
- changing successful status meaning;
- changing pagination/cursor semantics;
- narrowing accepted input values;
- adding/removing values from a **closed** response enum where clients may exhaustively handle it;
- changing authorization/resource-disclosure semantics in a way visible to clients.

A deliberate breaking contract becomes `/api/v3`; it does not grow a V2 compatibility shim.

If two major API versions overlap temporarily, deprecation/sunset signaling may be added as part of #321.

## Operation IDs

Every operation has an explicit globally unique, stable `operationId`.

Use lowerCamel names based on business capability and action, for example:

```text
pandaList
pandaGetProfile
engagementAddFavorite
contributionSubmit
reviewAssignCase
publicationPublishRelease
privacyCreateExport
```

Do not let controller class/method renames silently change operation IDs.

Operation IDs are contract identifiers for documentation, change review and possible future generators even though `openapi-fetch` primarily types calls by HTTP method + path.

## OpenAPI tags

Tags align to the business-module map from #310, not FastAPI router files or UI pages.

Examples:

```text
Panda
Lineage
Places
LifeHistory
Contribution
Review
Moderation
Curation
Publication
Engagement
Updates
Notification
Privacy
Audit
```

Admin is an authorization/surface concern, not a substitute tag for the owning domain.

## Generated TypeScript client

### Selected approach

Use:

```text
openapi-typescript -> generated schema types
openapi-fetch      -> tiny typed fetch runtime
```

Avoid a generated class-per-controller SDK unless later evidence demonstrates a need.

Why:

- no hand-written URL/parameter/response typings;
- native Fetch works in modern Node, browser and Next.js;
- small runtime footprint;
- the generated schema remains close to OpenAPI rather than adding another object model;
- custom `fetch` and middleware can handle server/browser auth plumbing later decided by #314;
- current OpenAPI TypeScript documentation includes Next.js usage.

### Client factory

The generated package should expose a small adapter similar conceptually to:

```ts
import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

export function createApiClient(options: ApiClientOptions) {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
  });
}
```

Authentication, correlation headers and request tracing may be attached through explicit middleware/client factory options after #314/#319.

### Feature wrappers are allowed

A frontend feature may expose ergonomic local functions such as:

```text
contributionApi.createDraft(...)
contributionApi.submit(...)
```

but those wrappers must obtain request/response types from the generated contract and may not redeclare the transport interfaces.

A feature wrapper can map generated transport objects into UI ViewModels. That mapping is healthy and intentional.

## Transport types versus UI ViewModels

This distinction is mandatory.

Generated transport types own facts such as:

```text
PandaProfileResponse
SubmissionResponse
InboxItemResponse
ProblemDetails
```

Frontend-owned ViewModels own presentation such as:

```text
TrustedProfilePageViewModel
AtlasSearchViewModel
EditorialHomeViewModel
LineageCompareViewModel
```

Do not generate or share UI ViewModels from OpenAPI.

The frontend is allowed to transform transport data substantially; it is not allowed to retype the wire contract manually.

## Next.js boundary

This ticket does not decide whether every browser request calls NestJS directly.

That depends on the auth/security model in #314.

The fixed rule is:

- any Next.js server code or BFF/proxy adapter that calls NestJS uses the generated Nest API client/types;
- if browser code later calls Nest directly, it uses the same generated contract package;
- if browser code calls a Next same-origin route, that Next route is an adapter and must not create a second independent copy of Nest transport types.

The generated client targets the **NestJS V2 API contract**, not arbitrary Next.js internal route shapes.

## Contract generation process

The Nest application must be able to generate its OpenAPI document without listening on a network socket and without contacting PostgreSQL/R2/remote services.

That is consistent with #311's rule that constructors/module bootstrap do not perform required remote work.

Conceptual command:

```text
npm run api:openapi:generate
```

Process:

1. construct the Nest application in contract-generation mode;
2. apply the same global prefix, versioning, validation metadata and Swagger plugin metadata as production;
3. call `SwaggerModule.createDocument`;
4. set OpenAPI `3.1.0`;
5. canonicalize ordering/format deterministically;
6. write `contracts/http/openapi.v2.json`;
7. validate it as OpenAPI;
8. generate TypeScript transport types from that artifact.

No production HTTP listener is required.

## Contract CI gates

The final exact scripts belong to #319/#320, but V2 requires these invariants:

### OpenAPI drift gate

Regenerate the document from Nest HTTP code and fail if it differs from the checked contract.

This means a DTO/controller change cannot silently alter transport behavior without a contract diff in the PR.

### OpenAPI validity gate

Validate the generated OpenAPI 3.1 document with an independent standards-aware validator/tool, not only `@nestjs/swagger`'s own TypeScript types.

### Generated client drift gate

Generate the TypeScript client/types from the checked OpenAPI artifact and fail on stale generated output/build artifacts according to #320's package strategy.

### Breaking-change gate

Once V2 becomes an accepted release contract, CI/release review compares the proposed OpenAPI document with the current accepted V2 baseline and flags breaking changes according to the compatibility policy above.

The exact diff tool is #319/#320; do not hand-roll hundreds of route/schema assertions like V1 unless a domain-specific invariant genuinely cannot be expressed in OpenAPI.

## Contract tests

Do not port V1's OpenAPI tests file-by-file.

Use three layers:

1. **generation/validation tests** — the generated document is valid and deterministic;
2. **HTTP application tests** — representative endpoint behavior actually matches the documented status/body/header contract;
3. **consumer compile tests** — generated client calls/type fixtures fail compilation when transport contracts drift.

Add focused assertions only for high-risk protocol details such as:

- a sensitive endpoint being documented as private/authenticated;
- an upload declaring multipart;
- a command requiring `If-Match` or `Idempotency-Key`;
- public-release headers required by #317;
- user/operator response schemas remaining distinct for privacy/security.

## OpenAPI publication and Swagger UI

The checked OpenAPI file is a build/repository artifact; production correctness does not require serving Swagger UI.

Recommended runtime policy:

- local development: Swagger UI may be enabled;
- staging/preview: Swagger UI may be enabled behind appropriate access policy;
- production: no Swagger UI by default;
- production raw OpenAPI exposure is optional and should exist only if a real consumer need is identified.

Do not bundle a public interactive documentation surface merely because `@nestjs/swagger` supports one.

## Legacy artifacts to retire

Once V2 takes authority and migration sequencing permits deletion, retire transport-duplicate V1 artifacts rather than maintain them in parallel:

```text
services/api/openapi/panda-atlas-v1.yaml
services/api/openapi/*-v1.yaml
services/api/scripts/check_openapi_contract.py
services/api/scripts/build_archive_governance_openapi.py
V1 OpenAPI fragment contract tests
apps/web transport-only hand-written API types
FastAPI-specific proxy type casts
```

`contracts/public-api-v1.json` must not be reproduced as a V2 transport field checklist. If #317 requires a separate immutable **release artifact schema** for data publication, that schema has a different responsibility and remains language-neutral; it must not duplicate the HTTP DTO schema merely to police field names.

## Rejected alternatives

### Hand-authored OpenAPI first

Rejected as the primary source because runtime validation/controller behavior would still live in Nest code, producing two authoring locations and recreating V1 drift.

### Shared TypeScript DTO package between Nest and Next

Rejected because it couples framework DTO classes/decorators to consumers and is not language-neutral.

### Zod/OpenAPI as a second HTTP schema system

Rejected for the baseline because #311 already selected idiomatic Nest ValidationPipe/class-validator DTOs. Adding Zod adapters would create another schema representation without a demonstrated gap.

### OpenAPI Generator large SDK

Rejected for the baseline because PandaAtlas currently needs a small first-party typed Fetch seam rather than generated model/client classes and template configuration.

### Orval/Hey API as the default

Both are capable tools, but PandaAtlas does not currently need generated React Query hooks, generated service functions or a richer client DSL. `openapi-typescript + openapi-fetch` has a smaller interface and keeps Next.js data-fetching policy in the frontend rather than in generated code.

This can be revisited only if a concrete requirement demonstrates missing leverage.

### Keeping snake_case for compatibility

Rejected. V2 is not constrained by FastAPI/Pydantic wire names. TypeScript/Nest/Next use camelCase transport properties; DB/Python schemas remain independently mapped where needed.

## External references checked

- NestJS OpenAPI introduction: https://docs.nestjs.com/openapi/introduction
- NestJS Swagger CLI plugin: https://docs.nestjs.com/openapi/cli-plugin
- NestJS versioning: https://docs.nestjs.com/techniques/versioning
- Nest Swagger current DocumentBuilder/OpenAPI implementation: https://github.com/nestjs/swagger
- OpenAPI TypeScript introduction/CLI: https://openapi-ts.dev/introduction and https://openapi-ts.dev/cli
- openapi-fetch: https://openapi-ts.dev/openapi-fetch/
- openapi-fetch Next.js examples: https://openapi-ts.dev/openapi-fetch/examples
- RFC 9457 Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457

## Decisions deferred to other Wayfinder tickets

- Bearer token verification, browser/server token propagation, guards and capability decorators: #314.
- Domain/integration event HTTP exposure, if any: #315.
- Python cross-runtime schemas: #316.
- Public release/read-model headers, cache semantics and immutable publication contracts: #317.
- Production docs/health exposure and Vercel routing details: #318.
- Exact error taxonomy, telemetry fields, contract-diff tool and release gates: #319.
- Exact package location, generated-file commit policy, Nest compiler/SWC integration and npm scripts: #320.
- V1/V2 coexistence duration, routing cutover and retirement date: #321.

## Acceptance for #313

The HTTP/OpenAPI/client strategy is resolved when later planning can assume all of the following without reopening the decision:

- the only hand-authored HTTP contract is the NestJS HTTP boundary;
- `@nestjs/swagger` generates one OpenAPI 3.1.0 V2 document;
- the generated checked contract is conceptually `contracts/http/openapi.v2.json` and is never hand-edited;
- V2 does not maintain hand-authored per-module OpenAPI YAML fragments;
- concrete Nest DTO classes plus class-validator own runtime request validation;
- response DTOs/presenters prevent database/domain objects from accidentally becoming wire contracts;
- Nest DTO classes are not imported by Next.js;
- V2 transport JSON/query fields use camelCase and paths use consistent lower-case/kebab-case segments;
- business HTTP routes start at `/api/v2`; Nest does not implement FastAPI `/api/v1` compatibility aliases;
- version-neutral routes are infrastructure-only;
- success responses are direct resource/read models, not a universal data envelope;
- errors use RFC 9457 `application/problem+json` with stable PandaAtlas extensions;
- ETag/If-Match and Idempotency-Key carry HTTP concurrency/replay metadata where applicable;
- every operation has an explicit stable operationId;
- `openapi-typescript + openapi-fetch` is the TypeScript client baseline;
- frontend transport types come from generated OpenAPI, while frontend ViewModels remain frontend-owned;
- OpenAPI generation, validity, generated-client drift and breaking-change detection become CI gates;
- V1 manual OpenAPI/checklist/frontend transport duplicates are retirement targets rather than compatibility constraints.
