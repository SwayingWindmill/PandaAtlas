# NestJS V2 identity, authorization, and request security model

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #314 `Define the NestJS identity, authorization, and request security model`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

How should NestJS V2 verify Supabase identities, load authoritative account and capability state, express guards and decorators, enforce recent-auth and deny-by-default rules, propagate actor/request/correlation context, protect administrative commands, and preserve the current security invariants without carrying forward FastAPI-specific mechanisms?

## Decision summary

PandaAtlas V2 uses **Supabase Auth only as the authentication authority** and keeps **PandaAtlas authorization in PostgreSQL's private `identity` schema**.

The request path is:

```text
Supabase user session
      |
      | Authorization: Bearer <short-lived access token>
      v
NestJS SupabaseAuthGuard
      |
      | local asymmetric JWT verification via jose + JWKS
      v
VerifiedPrincipal
      |
      v
ApplicationAccessGuard
      |
      | one authoritative PostgreSQL authorization read
      v
AuthorizationSnapshot
      |
      +-- account state
      +-- effective roles
      +-- effective capabilities
      +-- capability security policy
      |
      v
controller -> application command/query
```

Core rule:

> A valid Supabase JWT proves **who the caller is**. It never decides **what PandaAtlas allows the caller to do**.

Roles/capabilities are never trusted from JWT custom claims, email addresses, client headers, Next.js UI state, or a legacy admin token.

## Security invariants retained from V1

The V1 implementation already contains several sound invariants that carry forward as behavior, not implementation:

- Supabase user tokens are verified before an actor is accepted.
- The stable Supabase subject UUID is the application account identity.
- Account state is authoritative in PostgreSQL.
- Roles and capabilities are explicit PostgreSQL state.
- Expired/revoked role assignments do not grant authority.
- Sensitive operations can require recent authentication.
- Role-management commands cannot grant authority to the acting account itself.
- Authorization/security decisions can be correlated to an audit trail.
- Browser `anon`/`authenticated` database roles receive no direct access to the private Identity schema.

V2 preserves these properties while removing FastAPI dependencies, legacy bearer-token bypasses, email bootstrap, implicit writes on every request, and account-global recent-auth state.

## Authentication technology

Use **`jose` 6.x** directly in the Nest platform/auth adapter.

Current version checked during this research: `6.2.10`.

Use:

```ts
createRemoteJWKSet(...)
jwtVerify(...)
```

Do not introduce Passport solely for one Supabase bearer-token strategy. Nest Guards already provide the correct seam and `jose` provides the cryptographic/JWT behavior. Adding `@nestjs/passport` plus a custom strategy would add indirection without additional capability.

## Supabase signing-key requirement

### Production V2 requires asymmetric signing keys

PandaAtlas V2 production requires Supabase Auth to use the modern **asymmetric signing-key system**.

Accepted algorithms:

- `ES256` — preferred;
- `RS256` — accepted.

Rejected for V2 production:

- legacy JWT secret authentication;
- `HS256` shared-secret user-token verification;
- a fallback that calls Auth for every request merely to preserve a legacy project configuration.

Supabase currently recommends asymmetric signing keys and exposes them through the project JWKS endpoint. ES256 is its preferred choice for performance and compact signatures.

If the target Supabase project is still on the legacy/shared-secret path, moving it to an asymmetric signing key is a **deployment prerequisite**, not a Nest compatibility feature. #318 must verify this prerequisite against the real managed environment.

## JWT verification

Create one singleton verifier per warm Nest runtime instance.

Conceptually:

```ts
const jwks = createRemoteJWKSet(
  new URL(`${issuer}/.well-known/jwks.json`),
  {
    cacheMaxAge: 10 * 60 * 1000,
    timeoutDuration: 5_000,
  },
);

const { payload } = await jwtVerify(token, jwks, {
  issuer,
  audience: 'authenticated',
  algorithms: ['ES256', 'RS256'],
  clockTolerance: 30,
});
```

The exact code may differ; these are the required semantics.

### Claims that define the authenticated principal

After cryptographic verification, validate:

- `sub` is a UUID and is the only stable account identity;
- `aud` includes/is `authenticated`;
- `role` is `authenticated`;
- `is_anonymous` is `false`;
- `session_id` is a non-empty UUID/string valid for Supabase session correlation;
- `aal` is `aal1` or `aal2`;
- `exp` and `iat` are valid;
- `nbf`, when present, is respected;
- the signing algorithm is asymmetric and allowlisted.

### Claims not used as authorization truth

Never authorize from:

- `email`;
- `phone`;
- `app_metadata`;
- `user_metadata`;
- a custom JWT `roles` or `capabilities` field;
- Supabase's `role` beyond confirming this is an authenticated user token.

An email may be retained as contact/profile metadata, but it is not an identity key and is not a privilege source.

### JWKS caching and rotation

Use `jose`'s remote JWKS cache with a maximum age no longer than Supabase's documented 10-minute edge-cache window.

Do not create a longer application cache for convenience.

Operational rotation must respect Supabase's documented propagation window. Deployment/security runbooks should include the ability to refresh/restart application instances during key rotation incidents, but V2 does not place an Auth API call in every request path.

## Authentication failure taxonomy

Authentication failures are transport failures mapped by the global error layer from #313/#319:

- missing bearer token -> `401` Problem Details + `WWW-Authenticate: Bearer`;
- malformed/expired/bad-signature/wrong-issuer/wrong-audience/anonymous token -> `401`;
- temporary inability to retrieve a required JWKS because the verifier has no usable cached key -> `503`, not `401`;
- valid token but no PandaAtlas account -> authenticated-but-unprovisioned policy result, not invalid authentication.

Do not leak whether a specific user, email, role, or admin account exists in token-error details.

## No refresh tokens in NestJS

NestJS accepts only Supabase **access tokens**.

NestJS does not:

- receive refresh tokens;
- refresh sessions;
- set Supabase session cookies;
- own login/OAuth callback flows;
- exchange passwords/OTP credentials;
- mint PandaAtlas user JWTs.

Supabase Auth plus the web client owns session creation/refresh. Nest is a resource server.

## Global deny-by-default guard model

Use two ordered global Nest Guards registered through `APP_GUARD`.

### Guard 1: `SupabaseAuthGuard`

Responsibilities:

1. inspect route metadata;
2. if explicitly `@Public()`, bypass authentication;
3. otherwise require one Bearer access token;
4. verify the token locally;
5. create `VerifiedPrincipal`;
6. enrich RequestContext with `actorId`, `sessionId`, `aal`, and auth timestamps;
7. make the verified principal available to later guards/controllers.

No database writes happen here.

### Guard 2: `ApplicationAccessGuard`

Responsibilities for non-public routes:

1. load one authoritative Identity authorization snapshot for the principal;
2. require a provisioned account unless the endpoint explicitly allows provisioning;
3. reject non-active account state;
4. resolve required capabilities from route/controller metadata;
5. enforce capability policy including recent-auth/AAL/session checks;
6. attach the final `ActorContext`/authorization snapshot to request context;
7. emit/record required authorization audit facts according to the audit policy.

This combines account-state/capability/security-policy evaluation so multiple global guards do not independently query Identity.

### Public means explicit

The application is authenticated by default.

Every anonymous business endpoint must be marked explicitly:

```ts
@Public()
@Get(...)
```

This follows Nest's recommended global-auth-guard pattern and prevents a newly created route from accidentally becoming public.

Infrastructure routes such as health/readiness may also be explicitly public.

No broad controller/package is considered public because of its folder name.

## Authorization decorators

Use strongly typed Nest metadata decorators created with `Reflector.createDecorator` or an equivalent typed helper.

Required baseline:

```ts
@Public()
@RequireCapabilities(['publication.publish'])
@RequireRecentAuth()       // optional tightening only
@RequireAal('aal2')        // optional tightening only
```

A composed decorator may add Swagger bearer/security metadata, but security behavior belongs to the Guards.

### Capability decorator semantics

`@RequireCapabilities([...])` means **all listed capabilities are required** unless a specifically named future decorator introduces OR semantics.

Do not make ambiguous helpers such as `@Authorized('admin')` or accept arbitrary role names at controllers.

Controllers authorize by **capability**, not by role.

Roles are an Identity administration convenience for assigning capability sets.

## Capability security policy

The current `identity.capabilities.sensitive` flag is a useful start but V2 should make security policy explicit.

A capability record should conceptually provide:

```text
capabilityKey
sensitive
requiresRecentAuth
minimumAal
requiresLiveSession
```

The exact migration columns may differ, but these policy dimensions belong to the authoritative capability definition rather than repeated controller booleans.

### Policy defaults

- ordinary member capability: active account, valid JWT;
- ordinary staff capability: active account, valid JWT, capability present;
- sensitive capability: recent auth required by default;
- high-impact capability: recent auth + `aal2` + live-session check.

A controller may **tighten** policy with `@RequireRecentAuth()` or `@RequireAal('aal2')`; it must not weaken the policy declared for a capability.

### High-impact examples

The V2 capability catalog should mark operations equivalent to these as high-impact:

- role assignment/revocation;
- account suspension/deletion/reactivation;
- privacy execution/export/deletion finalization;
- restricted audit export/maintenance;
- moderation sanction application/restoration with account impact;
- sensitive publication activation/withdrawal/rollback.

Exact renamed V2 capability keys follow the module vocabulary from #310; legacy `archive.*`, `community_*`, and other migration-era names are not preserved solely for compatibility.

## Recent-auth model

### Current V1 flaw to remove

V1 writes `last_authenticated_at` onto `identity.accounts` and calculates `recent_auth` from that account-global timestamp.

That is unsafe as a long-term step-up primitive because one recent authentication on Session A can make a different Session B appear recently authenticated.

V2 never uses an account-global `last_authenticated_at` value for sensitive authorization.

### V2 source of truth

Recent-auth is derived from the **current verified JWT's `amr` entries**.

Supabase documents `amr` entries as authentication methods plus timestamps.

Compute the current session authentication reference as the latest accepted interactive authentication entry, excluding at least:

- `token_refresh`;
- `anonymous`.

Unknown/untrusted methods do not silently count as recent interactive authentication.

### Never use JWT `iat` as recent-auth

A refreshed access token gets a recent `iat` without the user proving their identity again.

Therefore:

```text
recent token issue != recent authentication
```

`iat` is never the fallback step-up timestamp.

If no trustworthy AMR timestamp is present, `recentAuth = false`.

### Window

Keep the current 15-minute step-up window as the default PandaAtlas sensitive-command policy unless a later product/security requirement intentionally changes it.

The window is evaluated against the **current session AMR timestamp**, not a persisted account timestamp.

## AAL and MFA

Supabase's `aal` claim is accepted as the authentication-assurance signal after token verification.

- `aal1`: ordinary authenticated session;
- `aal2`: session has completed an additional authentication factor.

Do not treat AAL2 as a replacement for capabilities. It only strengthens authentication assurance.

High-impact staff capabilities should require `aal2` in addition to authorization and recent-auth.

The web UX for enrolling/challenging MFA is implementation work; this ticket fixes the backend policy seam so it cannot be bypassed by a UI that forgets to ask.

## Live-session validation for highest-impact commands

Supabase access tokens remain cryptographically valid until `exp` even after logout/session deletion. Supabase explicitly documents that applications needing stronger guarantees may correlate the JWT `session_id` with `auth.sessions` for the most sensitive operations.

PandaAtlas adopts this selectively:

- ordinary authenticated/public behavior relies on short-lived JWT validation;
- account suspension/role revocation remains immediately enforced by PandaAtlas PostgreSQL authorization state;
- capabilities marked `requiresLiveSession` additionally verify that the current `session_id` still exists as a live Supabase session before executing the command.

Do not query `auth.sessions` on every request.

This keeps ordinary requests fast while closing the logout/stolen-token window where it matters most.

The application DB role must receive only the minimum read privilege needed for this check if direct `auth.sessions` lookup is used. #318 validates the real managed-role feasibility.

## Authorization snapshot

For each protected request that requires a provisioned PandaAtlas account, Identity returns one immutable request-local snapshot conceptually containing:

```ts
interface AuthorizationSnapshot {
  accountId: string;
  state: 'active' | 'suspended' | 'deleting' | 'deleted';
  roles: readonly string[];
  capabilities: readonly CapabilityGrant[];
  evaluatedAt: string;
}
```

Each capability grant includes its effective security policy.

Rules:

1. query once per protected request;
2. store only in request-local context;
3. no cross-request authorization cache in the V2 baseline;
4. role revocation/account suspension therefore takes effect on the next protected request without waiting for JWT refresh;
5. a frontend capability snapshot is advisory UI data only; Nest always reloads authoritative state.

A later measured performance problem may justify a cache only if invalidation/revocation correctness is proven first.

## Roles are not permissions at HTTP boundaries

Controllers never use:

```ts
@Roles('administrator')
```

for business authorization.

Instead:

```ts
@RequireCapabilities(['identity.role.manage'])
```

Reasons:

- capability names state the actual operation authority;
- roles can evolve without changing route code;
- least-privilege roles can overlap;
- there is no accidental `administrator` wildcard.

An administrator role is just one bundle of capabilities. It has no implicit bypass.

## No wildcard or root bypass

Do not implement:

```text
role == administrator -> allow everything
capability == * -> allow everything
X-Admin -> allow
secret admin bearer token -> allow
```

Emergency/recovery authority is an operations concern using controlled privileged database/Supabase procedures, not a hidden HTTP bypass.

## Account provisioning

### Authentication guards are read-only

Do not preserve V1's pattern where every authenticated request executes an account UPSERT, role bootstrap and commit before authorization.

Authentication/access guards perform verification and reads only, apart from narrowly defined security-audit recording.

### Explicit self-provisioning command

Provide one authenticated-only, idempotent Identity command conceptually like:

```text
POST /api/v2/me/account
```

It may be called by the web login completion flow after Supabase authentication.

This command:

- trusts only the verified `sub` as account ID;
- creates the PandaAtlas account only if absent;
- grants the base `member` role according to the authoritative Identity workflow;
- may snapshot non-authoritative contact/profile metadata;
- never grants staff authority;
- never reactivates a suspended/deleting/deleted existing account;
- is safe to retry.

The route is authenticated but explicitly marked as allowing an unprovisioned application account.

All other protected application routes require a provisioned account.

## Email is not an authorization identity

V2 removes the runtime `IDENTITY_BOOTSTRAP_ADMIN_EMAILS` pattern.

Do not grant roles because a verified JWT contains an email matching configuration.

Reasons:

- account UUID is the stable identifier;
- email can change;
- email-based bootstrap couples privilege to mutable contact information;
- hidden first-request privilege grant is difficult to reason about and audit.

### Initial staff bootstrap

Initial staff authority is provisioned through an explicit controlled operations step against an exact Supabase user UUID, with reason and audit evidence.

After the initial administrator/role-manager exists, all ordinary role changes flow through the Identity module's authorized commands.

The runtime has no permanent email bootstrap backdoor.

## Account/profile metadata

`identity.accounts.account_id` remains the stable application identity and FK to `auth.users(id)`.

The V2 schema should not require `email` to be the account's identity-bearing attribute. Email/phone/contact information can be optional synchronized profile metadata or owned by an appropriate account-profile representation.

Authorization decisions never depend on it.

## Self-escalation and separation of duties

Preserve the existing no-self-assignment invariant:

- an actor with role-management authority cannot grant a role to their own account;
- privilege-changing commands use explicit subject account IDs separate from actor identity;
- the actor ID comes only from the verified JWT;
- the client cannot override actor identity with a header or body field.

Module-specific separation-of-duty rules remain application/domain policies, for example a reviewer/publisher restriction or a moderator acting on their own case.

Capability Guards enforce coarse-grained action authority; **resource-level/relationship rules stay in the owning application/domain module**.

## Actor identity

Remove every legacy actor override such as:

```text
X-Actor-Id
workflow actor header
ADMIN_API_TOKEN
legacy transition identity
```

For a user/staff HTTP request:

```text
actorAccountId = verified JWT sub
```

Always.

A target/subject account ID may come from the route/body, but actor and subject are never conflated.

## Request context integration

Build on the AsyncLocalStorage request context selected in #311.

### Earliest request context

Before authentication:

```text
requestId
correlationId
traceId
request start time
```

### After JWT verification

Enrich with:

```text
actorId
sessionId
aal
authenticatedAt from current AMR when available
tokenIssuedAt
```

### After authorization

Enrich with bounded security context such as:

```text
accountState
authorization evaluation metadata
```

Do not put the bearer token, refresh token, email address, entire JWT payload, or full capability list into ordinary logs/trace attributes.

Domain objects do not read ALS. Controllers/application use cases receive an explicit `ActorContext` when actor identity is part of the business command/query.

## Request and correlation IDs

Maintain separate concepts:

- `requestId`: generated by PandaAtlas for every request;
- `correlationId`: propagates a logical action across Web -> Nest -> events/workers.

Caller-provided `X-Correlation-Id` is accepted only if it matches the chosen strict identifier format; otherwise return `400` rather than echoing arbitrary attacker input into logs.

If absent, generate one.

Never accept `X-Actor-Id`.

The exact trace correlation with OpenTelemetry is #319.

## Current-actor controller interface

Expose a narrow parameter decorator/application interface such as:

```ts
@CurrentActor() actor: ActorContext
```

`ActorContext` should expose only data application commands need, conceptually:

```text
accountId
sessionId
aal
authenticatedAt
requestId
correlationId
```

Do not expose raw JWT claims or Nest/Fastify request objects to application/domain code.

## Browser and Next.js -> Nest boundary

### V2 removes the proxy-by-default architecture

Do not preserve today's collection of `fastapi-*-proxy.ts` and `/api/...` proxy routes merely because FastAPI lived behind Next.js.

The default V2 browser architecture is:

```text
Browser
  |
  | Supabase client maintains session
  | Authorization: Bearer <access token>
  v
NestJS /api/v2
```

The generated client from #313 owns the HTTP call shapes.

### Browser client factory

Provide one Web auth-aware client factory that:

1. gets the current Supabase access token through the central Supabase client/session abstraction;
2. attaches it as `Authorization: Bearer ...`;
3. never exposes token handling to feature modules;
4. retries only according to explicit request/idempotency policy;
5. does not send refresh tokens to Nest.

### Server-rendered/Next server calls

Next Server Components/Route Handlers that need Nest use the same generated API contract and a server client factory.

On the server:

- use Supabase `getClaims()` when the Next layer itself must trust identity claims;
- obtaining the raw current access token for forwarding may use the session storage abstraction, but Next does **not** treat unverified session contents as authorization truth;
- Nest re-verifies every bearer token and reloads PandaAtlas authorization.

### No permanent BFF security dependency

Next.js may host deliberate application adapters where SSR or upload UX requires them, but it is not a mandatory authorization proxy.

Nest does not trust a request merely because it originated from Next/Vercel.

There is no private header such as `X-Verified-User` that substitutes for a Supabase bearer token.

## CORS and CSRF model

Nest authentication uses the `Authorization` header, **not cookies**.

Therefore:

- Nest does not accept Supabase session cookies as authentication;
- Nest does not use `credentials: include` as the user-authentication mechanism;
- browser state-changing API calls are not authenticated by ambient cookies;
- conventional cross-site request forgery against the Nest API is not the primary threat because the attacker cannot make the browser automatically attach the Bearer credential.

CORS still uses a strict environment-specific allowlist of PandaAtlas web origins.

Do not use wildcard origin for authenticated routes.

Allow only required headers/methods, including as needed:

```text
Authorization
Content-Type
If-Match
Idempotency-Key
X-Correlation-Id
```

CORS is defense in depth/browser policy, not authorization.

If a future Next BFF endpoint authenticates via cookies and performs state changes, that Next endpoint owns its own same-origin/CSRF protections; that does not change Nest's Bearer-token contract.

## Administrative UI and commands

### Admin is a surface, not an authority

Consistent with #310:

- no admin module owns cross-domain permissions;
- no admin shell secret grants domain authority;
- admin pages query an authenticated Identity session/capability view for navigation only;
- each domain command independently requires its domain capability in Nest.

`admin.shell.access` should not survive as a security shortcut. If retained temporarily for navigation migration, it is UI discoverability only and must not confer business permissions.

### Sensitive command checklist

A high-impact administrative command must have, as applicable:

```text
valid Supabase JWT
+ active PandaAtlas account
+ required capability
+ recent current-session auth
+ required AAL (often aal2)
+ current Supabase session existence when policy requires
+ resource/domain policy
+ Idempotency-Key for retry-safe command
+ correlation/request context
+ durable command/security audit evidence
```

No element is substituted by a Next proxy, email, legacy API token, actor header, or UI visibility.

## Authorization auditing

Identity continues to own local append-only authorization facts. Unified Audit remains downstream as decided in #310.

Do not write an authorization audit row for every ordinary authenticated read.

Durable security/audit evidence is required for:

- role grants/revocations;
- account-state changes;
- sensitive capability allow/deny decisions;
- recent-auth/AAL/live-session denial on sensitive actions;
- security-relevant bootstrap/recovery operations.

Ordinary 401/403 traffic is also structured-logged/metricized, but does not require an append-only domain row per request unless #319 identifies a compliance requirement.

Sensitive command execution should fail closed if its required durable audit record cannot be persisted consistently with the command's security requirements. Exact transaction/outbox mechanics are finalized by #315/#319.

## Resource-level authorization

Capability checks are necessary but not sufficient for all endpoints.

Examples of policies that remain inside application/domain code:

- `submission.ownerAccountId === actor.accountId`;
- reviewer cannot approve their own authored change where separation is required;
- actor cannot grant roles to self;
- moderator cannot decide their own appeal/case where policy forbids it;
- privacy subject/authorized operator rules;
- a private resource may intentionally return 404 rather than disclose its existence.

Do not encode these as giant route decorators or SQL hidden inside an authorization Guard.

## 403 versus hidden 404

Default semantics:

- valid authenticated account lacking a capability -> `403` Problem Details;
- missing resource -> `404`;
- selected privacy/security-sensitive resource lookups may intentionally hide forbidden existence as `404` when the owning domain explicitly requests that disclosure policy.

Do not globally turn every authorization failure into `404`, because that makes debugging/auditing ambiguous and loses useful semantics.

## Database access and RLS relationship

Nest uses the dedicated server-side PostgreSQL application role selected by #312.

Identity private schemas remain inaccessible to browser `anon`/`authenticated` roles.

RLS remains valuable for any data intentionally exposed through Supabase Data APIs, but PandaAtlas Nest authorization does not outsource its domain capability model to JWT RLS claims.

Do not duplicate the entire role/capability model into custom access-token claims just to make RLS drive Nest authorization. JWT authorization claims would be stale until token refresh and would weaken immediate revocation.

## Service keys are not user identity

Reject these as user authentication:

- Supabase publishable API key;
- Supabase secret/service key;
- legacy `anon`/`service_role` JWT used as a Bearer user credential;
- repository-local admin API token.

Machine/batch authentication, if a later Python/GitHub workflow genuinely needs to call Nest HTTP commands, requires a separate explicitly named machine-identity design. It must never impersonate a human by supplying a fake actor header. The need/interface is resolved with #315/#316/#318 rather than guessed here.

## Logging and secret handling

Never log:

- `Authorization` header;
- access token;
- refresh token;
- session cookies;
- Supabase secret key;
- raw JWT payload as a whole.

Safe structured security fields include bounded values such as:

```text
requestId
correlationId
actorId when authenticated
sessionId when operationally necessary and access-controlled
aal
requiredCapability
outcome
stable reason code
```

Sensitive PII such as email is excluded from ordinary request logs.

Exact redaction/telemetry rules are #319.

## Failure policy

### Fail closed

Protected operations fail closed when:

- JWT cannot be verified;
- Identity database authorization state cannot be read;
- account is non-active;
- required capability is missing;
- required recent-auth/AAL/live-session condition is not met;
- a required sensitive authorization audit cannot be persisted under its final policy.

### Public availability

A temporary Supabase JWKS/Auth outage should not break explicitly public routes that do not need authentication.

Public endpoints do not attempt optional token verification simply because an Authorization header happens to be present.

## Prohibited V2 patterns

```text
FastAPI Depends(require_capability(...))  -> copied decorator-by-decorator wrappers
ADMIN_API_TOKEN                           -> Nest admin secret
X-Actor-Id                                -> trusted actor override
bootstrap admin email                     -> implicit privileged role grant
JWT custom capability claims              -> application authorization truth
role == administrator                     -> wildcard permission
request-scoped providers everywhere       -> actor context transport
account-global last_authenticated_at       -> recent-auth truth
JWT iat                                    -> recent-auth truth
getUser/Auth network call on every request -> normal token verification
Supabase cookie                            -> direct Nest authentication
service_role key                           -> human actor
```

## Target module/platform shape

Conceptually:

```text
platform/auth/
  supabase-jwt-verifier.ts
  supabase-auth.guard.ts
  public.decorator.ts

modules/identity/
  domain/
    account.ts
    capability.ts
    authorization-policy.ts
  application/
    authorization-queries.ts
    account-provisioning.ts
    role-commands.ts
    account-state-commands.ts
  infrastructure/
    identity.repository.ts
    live-session.repository.ts
  http/
    identity.controller.ts
    current-actor.decorator.ts
    require-capabilities.decorator.ts
    require-recent-auth.decorator.ts
    require-aal.decorator.ts
    application-access.guard.ts
```

JWT cryptography is a platform adapter; PandaAtlas account/capability policy belongs to the Identity business module.

## Testing baseline

Detailed test architecture is #319, but this security model requires focused tests for at least:

### JWT verifier

- valid ES256 token;
- valid RS256 token if supported by target project;
- wrong issuer;
- wrong audience;
- expired token;
- future `nbf`;
- anonymous token;
- `service_role`/wrong role token;
- HS256 rejection;
- JWKS key rotation/cache refresh behavior.

### Recent auth

- token refresh does not make auth recent;
- recent current-session AMR succeeds;
- old AMR fails;
- missing AMR fails sensitive recent-auth requirement;
- Session A recent auth cannot authorize Session B.

### Authorization

- suspended/deleting/deleted state denies despite valid JWT;
- role revocation takes effect on next request;
- capability missing denies;
- high-impact policy requires AAL2/live session;
- no wildcard administrator bypass;
- self-role assignment fails;
- caller-supplied actor IDs cannot override JWT sub.

### HTTP/browser seam

- public endpoint needs no auth/JWKS DB request;
- protected endpoint requires Bearer token;
- refresh token/cookie is not accepted by Nest as an auth mechanism;
- CORS allowlist is explicit;
- generated Web client centrally attaches access token.

## External references checked

- Supabase JWT signing keys: https://supabase.com/docs/guides/auth/signing-keys
- Supabase JWT verification/JWKS: https://supabase.com/docs/guides/auth/jwts
- Supabase JWT claims reference: https://supabase.com/docs/guides/auth/jwt-fields
- Supabase user sessions: https://supabase.com/docs/guides/auth/sessions
- Supabase MFA/AAL: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase JavaScript `getClaims`: https://supabase.com/docs/reference/javascript/auth-getclaims
- NestJS authentication/global guard: https://docs.nestjs.com/security/authentication
- NestJS authorization/Reflector: https://docs.nestjs.com/security/authorization
- NestJS execution context/typed metadata: https://docs.nestjs.com/fundamentals/execution-context
- `jose` remote JWKS options: https://github.com/panva/jose/blob/main/docs/jwks/remote/interfaces/RemoteJWKSetOptions.md

## Decisions deferred to other Wayfinder tickets

- durable domain/integration-event and authorization-audit outbox mechanics: #315;
- Python/GitHub Actions machine-auth need and cross-runtime command seam: #316;
- public read/cache behavior independent of authenticated private reads: #317;
- real Supabase asymmetric signing-key state, app DB role grants to `auth.sessions`, Vercel CORS origins and deployed auth smoke tests: #318;
- final error codes, security logging/redaction, metrics/tracing, rate limiting and CI security tests: #319;
- exact package/file layout and dependency rules: #320;
- V1 legacy admin token/proxy removal sequence: #321.

## Acceptance for #314

The identity/authorization/security model is resolved when later planning can assume all of the following without reopening the decision:

- Supabase Auth is authentication authority; PandaAtlas PostgreSQL is authorization authority.
- Production V2 requires asymmetric Supabase signing keys; HS256/legacy-secret compatibility is not implemented in Nest.
- `jose` local JWKS verification is the Nest token-verification baseline.
- verified `sub` is the only HTTP actor account identity.
- Next/client email, role claims, custom capability claims, admin tokens and actor headers never grant PandaAtlas authority.
- global authentication is deny-by-default with explicit `@Public()` routes.
- one application-access guard loads one request-local PostgreSQL authorization snapshot and enforces account/capability security policy.
- controllers declare capabilities, not roles; administrator has no wildcard bypass.
- sensitive capability policy centrally expresses recent-auth/AAL/live-session requirements and controller decorators may only tighten it.
- recent-auth is derived from the current JWT's trusted AMR timestamp, never account-global state or JWT `iat`.
- high-impact commands may require AAL2 and live `auth.sessions` validation.
- authorization state is read on every protected request in the baseline, so suspension/revocation is immediately effective at the PandaAtlas layer.
- authentication/access guards no longer mutate account state on every request.
- account provisioning is an explicit idempotent Identity command.
- email-based administrator bootstrap is removed from runtime architecture.
- browser/server callers send Supabase access tokens as Bearer credentials directly to Nest through the generated API-client seam; Nest does not authenticate with cookies or trust a Next proxy identity header.
- refresh tokens never enter Nest.
- CORS is strict and Nest's Bearer-token model does not rely on ambient cookies.
- resource-level ownership/separation policies remain in owning application/domain modules rather than being forced into generic Guards.
- legacy `ADMIN_API_TOKEN`, workflow actor headers, FastAPI dependency factories and compatibility identities are retirement targets, not V2 features.
