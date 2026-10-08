# PandaAtlas IAM platform comparison (2026-10-08)

- **Status:** Research; recommendation proposed, not an accepted architecture decision.
- **Scope:** Worker and staff identity/access control for PandaAtlas. Public contributor/fan authentication and domain authorization must not regress.
- **Evidence:** Checked repository's governing runtime and NestJS implementation alongside upstream vendor docs on 2026-10-08.
- **Decision question:** Replace Supabase Auth/PostgreSQL role authority with Casdoor, Logto, or Keycloak, or close the missing IAM management lifecycle on the existing foundation?

## 1. Product requirements, not vendor features

PandaAtlas is a single public, global giant-panda archive and continuously updated evidence-backed operating platform. It is **not currently a B2B multi-tenant SaaS identity product**.

The identity system must serve two distinct groups:

1. **Public fans/contributors:** account login, submissions, personal features, privacy lifecycle, notifications, and abuse controls.
2. **Staff operators:** research/source verification, review, moderation, canonical archive curation, sensitive publication and rollback, restricted audit, and narrowly scoped service/job identities.

Success means an operator can take a sourced panda-life event from intake through independent review and publication **with auditable actor, evidence, authority and reversal**, not merely see a user list in a generic IAM console.

Non-negotiable platform and product constraints:

- Managed-only production. `docs/deployment/runtime-status.md` supersedes historical Vercel ADR text: current Web and NestJS API run on **Cloudflare Workers**; identity is **Supabase Auth**; canonical data and application authorization live in **Supabase PostgreSQL**.
- No additional permanent self-managed VM/container host by default.
- Keep Supabase `auth.users.id` -> `identity.accounts.account_id` identity continuity, with strict NestJS authority and immediate PostgreSQL-based revocation checks.
- Preserve role **separation of duties**: administrator does **not** implicitly receive review, moderation, sensitive publication, privacy or audit-export powers.
- Public user authentication must keep working while staff IAM changes. All operator-facing administration should be Chinese-first in the Kiranism-style dashboard.
- Do not grant staff capabilities based on claimed email, JWT custom roles, client-side navigation or an untrusted OIDC mapping.

## 2. Existing technical assets and actual missing product pieces

| Area | Evidence in repository | Assessment |
|---|---|---|
| AuthN | `apps/web/features/auth/email-otp-login.tsx`, Supabase Auth, server cookie/session helpers | Running |
| Server-side AuthZ | `services/api/src/modules/identity/http/application-access.guard.ts`; `@RequireCapabilities` | Running; checks DB snapshot per request, with AAL/recent-auth/live-session policy |
| Roles, capabilities | `infra/supabase/migrations/0010_identity_accounts_roles_and_capabilities.sql` and later migrations; private `identity` schema | Existing; append-only assignments/revocations |
| Identity account provision | `POST /api/v2/me/account` in `me.controller.ts` | Authenticated self-provision as **member** only |
| Staff privilege management | No V2 HTTP role grant/revoke commands exposed by current Identity controller | Missing |
| First admin access | No V2 supported trusted first-admin bootstrap command | Missing and blocks real local administrator access |
| Staff console | `apps/web/features/admin/shell` Chinese UI; review/moderation/publication/audit surfaces | Exists; no complete staff directory/invite/role-assignment experience |
| Credential delivery | Local email OTP captured in Mailpit; production mail configuration separate | Existing; not an IAM authorization substitute |

The user-selected local email account exists in Supabase Auth but has **no PandaAtlas identity account or role assignment** at the time of this research; don't confuse successful OTP with staff authorization. Historical emails-as-admin bootstrap were explicitly retired in V2.

## 3. Candidates and verified upstream evidence

| Candidate | What it actually replaces/adds | Advantages | Friction for **this** architecture |
|---|---|---|---|
| **Current Supabase Auth + NestJS Identity + PostgreSQL** | Reuse AuthN; build missing bounded admin management surfaces | Zero new IdP, same stable subject UUID, existing 95 capabilities/13 roles and audited DB grant model, excellent Cloudflare/managed fit; free built-in TOTP MFA and Auth admin invitation API | Must build controlled first-admin/bootstrap, staff invitation/provisioning reconciliation, role grants/revocations, user suspension, and Chinese UX |
| **Casdoor** ([repo](https://github.com/casdoor/casdoor)) | Complete third-party identity provider with admin console, user/organization management, SSO and MFA | Apache-2.0; Chinese localization; OIDC, OAuth, SAML, LDAP, SCIM; bundled admin UI; import/bootstrap configuration | New always-on Go identity service + persistence if self-hosted; OIDC integration, account mapping, credential lifecycle migration; still need PandaAtlas domain permissions and audit in NestJS. Hosting contradicts managed-only unless paid managed offering approved |
| **Logto OSS** ([repo](https://github.com/logto-io/logto)) | Complete third-party IdP with console, RBAC, APIs, and managed-tenant alternative | Modern TypeScript/OIDC ecosystem; polished sign-in console; organizations and roles; MPL-2.0 | Always-on Node + Postgres deployment if self-hosted; Logto docs explicitly limit OSS **console** collaborator invitation, multiple console tenants and console MFA (end-user product features are distinct). Existing data-bound authorization remains separate |
| **Logto Cloud** ([pricing](https://logto.io/pricing)) | Managed Logto IdP replacing/bridging AuthN | No self-hosted runtime; established management UI and account lifecycle | New subscription, additional IdP/SSO integration; Cloud free plan lacks RBAC add-on. Published Pro starts at **$24/month**, RBAC **+$32/month**, MFA **+$48/month** (as of 2026-10-08; further costs/quotas apply); still doesn't replace panda domain policy |
| **Keycloak** ([repo](https://github.com/keycloak/keycloak)) | Enterprise IAM service with realms, user federation, MFA, OIDC/SAML, admin APIs | Apache-2.0; very mature admin provisioning and recovery procedures | Java/Quarkus permanent service, operational ownership, realm/client complexity disproportionate to a single staff organization. Managed hosting adds a provider/cost |

**Sources (first-party):**

- Supabase user invitations and trust boundary: https://supabase.com/docs/guides/auth/users
- Supabase TOTP MFA and AAL2: https://supabase.com/docs/guides/auth/auth-mfa/totp
- Supabase custom OAuth/OIDC providers: https://supabase.com/docs/guides/auth/custom-oauth-providers
- Supabase external JWT trust is a *different* integration from federating login through Supabase: https://supabase.com/docs/guides/auth/third-party/overview
- Casdoor source/console/protocols: https://github.com/casdoor/casdoor
- Casdoor deployment and initialization: https://casdoor.org/docs/category/deployment/ and https://casdoor.org/docs/deployment/data-initialization/
- Logto source: https://github.com/logto-io/logto
- Logto OSS console limits: https://docs.logto.io/introduction/set-up-logto-oss
- Logto pricing (verify before any purchase): https://logto.io/pricing
- Logto Cloud pricing breakdown: https://docs.logto.io/logto-cloud/billing-and-pricing
- Keycloak bootstrap/recovery: https://www.keycloak.org/server/bootstrap-admin-recovery

## 4. Evaluation against PandaAtlas's end state

| Requirement | Current foundation + targeted IAM | Casdoor | Logto OSS / Cloud | Keycloak |
|---|---|---|---|---|
| Verified first staff account | **Implement missing local/staging/prod operator ceremony** | Built-in admin + provisioning | Built-in tenant admin / console | Built-in bootstrap |
| Chinese operator IAM console | Add to existing PandaAtlas Chinese Kiranism shell | Vendor console; localized | Vendor console; localization, edition distinctions | Vendor console; must evaluate localization |
| Public fan/member identity continuity | **No migration** | Requires federation/migration strategy | Requires federation/migration strategy | Requires federation/migration strategy |
| Worker-only/managed production | **Fits** | Self-host does not fit; hosted option must be proven | OSS does not fit; **Cloud fits** | Self-host does not fit; managed option needed |
| Role grant/revoke self-service | **Implement NestJS commands on existing DB contract** | Vendor IAM roles, extra mapping to existing DB | Vendor RBAC, extra mapping to existing DB | Vendor roles, extra mapping to existing DB |
| Evidence, ownership and approval invariants | **NestJS domain and DB remain authority** | Still need NestJS/DB | Still need NestJS/DB | Still need NestJS/DB |
| Immediate revocation | Existing per-request DB authorization snapshot; complete revocation command/audit | Verify federation/session and DB synchronization | Verify federation/session and DB synchronization | Verify federation/session and DB synchronization |
| New service and recurring bill | **None required** beyond existing services | Additional host/runtime or paid managed IdP | Additional host (OSS) or subscriptions (Cloud) | Additional host or managed subscription |

These are **project-fit judgments**, not vendor quality rankings. The attractive prebuilt console does not replace PandaAtlas's own evidence governance, release separation-of-duties, row/object scope, or audit.

## 5. Integration choices if a full IAM product becomes necessary later

### Option A: External OIDC provider federated *through* Supabase Auth

```text
Casdoor / Logto / Keycloak login
  -> Supabase Auth custom OIDC provider
  -> Supabase-authenticated session, existing auth.users UUID
  -> Next.js BFF -> NestJS guard -> PostgreSQL Identity capability snapshot
```

Prefer this route for a future staff SSO need, because existing account subjects, DB foreign keys and NestJS JWT verifier are preserved *if* account linking is securely and explicitly designed/tested. OIDC integration is **not a role synchronization mechanism**; PandaAtlas authorization remains PostgreSQL-owned.

### Option B: Make the external IdP the direct token issuer

This changes JWT issuer/JWKS/session semantics, the existing `auth.users` foreign-key boundary, Supabase Auth browser cookies and role resolution. Supabase can also accept some third-party provider JWTs for its APIs, but this is a separate feature with specific issuer/signature requirements and does not automatically migrate application account identity. **Not justified by current product demand.**

## 6. Recommendation and guardrails

**Recommend: preserve Supabase Auth and the authoritative NestJS/PostgreSQL capability model.** Borrow mature identity admin patterns (invitation/recovery, scoped roles, searchable user directory, audit, MFA) from the leading vendors; do **not** copy in a second authorization authority. Casdoor is the strongest open-source *complete-console* reference; Logto Cloud is the strongest managed replacement to reconsider when actual multi-tenant or external enterprise SSO demand materializes. Keycloak is an enterprise benchmark, not the immediate delivery target.

This is a conditional recommendation, not a forever ban on external IAM. Revisit if PandaAtlas gains multiple independent staff organizations needing centralized federation, external directories/SCIM, mandated SSO policies, or if support/operational cost shows internal staff lifecycle management is expensive.

## 7. Suggested delivery slices (not yet authorized/implemented)

1. **P0 — First administrator ceremony and local acceptance:** explicit operator-only one-time bootstrap, verified Supabase UUID (not email trust), auditable idempotent role assignment, safe recovery policy, local-only full-workspace *development* operator; refuse implicit production superuser, no self-grant/backdoor. Demonstrate browser OTP -> `GET /api/v2/me` -> admin shell capability navigation.
2. **P1 — IAM service:** dedicated NestJS staff account read/invite/provision, role assignment/revoke, effective permission display, suspend/reinstate operations; transactional audit/outbox, fail closed; no self-grant; existing DB roles as single source of truth. Invite/verify through Supabase Auth Admin API server-side only.
3. **P2 — Chinese IAM console:** Kiranism-based staff list/detail, role/capability matrix, invite and suspend workflows, reason/confirmation dialogs, grant history, read-only security evidence. New capabilities must be least-privilege and server enforced.
4. **P3 — Sensitive governance:** TOTP AAL2 and recent reauthentication for privileged grants and sensitive operations; enforce independent reviewers/approvers, conflicts of interest and object/venue scope in domain services, not a generic role checkbox.

**Acceptance scenarios** (must be demonstrable using real sessions, a disposable local DB, and browser checks):

1. Fresh install, zero staff: no admin access until an explicitly authorized bootstrap; duplicate invocation is harmless and audited.
2. Existing verified user becomes first staff admin via approved bootstrap; ordinary members never inherit admin by email.
3. Admin invites a reviewer, reviewer finishes login and sees only Review capabilities; API directly denies Publication/role-management actions.
4. Staff privilege is revoked, then the **next real protected request** rejects it even with an existing JWT; a hidden nav item is not considered authorization.
5. No self-assign, no conflicting actor approval, no privilege elevation by forged JWT claims, no unrestricted service role token in Web.
6. Sensitive role grants/sensitive publication require the configured recent auth/AAL2 and audit entries.
7. Deactivated staff cannot perform API commands; account restore follows explicit operator authorization.
8. Existing public fan account and panda source/review/release audit flows remain intact.

## 8. Scope of this research

- No vendor instance was deployed and no SSO end-to-end login proof was run. This is **source/documentation and existing-repository comparison**, not a benchmark.
- No production credential, account role or deployment configuration was changed.
- Do not create an ADR claiming vendor adoption until the owner accepts the recommendation. Do not block the urgent P0 first-admin repair on an speculative IAM migration.
