# Privacy Operations

Issue #198 introduces a private, PostgreSQL-authoritative workflow for account access/export requests, irreversible deletion coordination, executable retention rules, narrow holds, and deletion tombstones.

## Ownership boundary

The `privacy` schema owns request state, per-context execution state, retention policy records, legal/security holds, deletion tombstones, and privacy-specific audit facts. FastAPI is the only business write path. Browser clients and Supabase `anon` or `authenticated` roles receive no direct grants on the schema.

Identity continues to own the account lifecycle. Engagement, Community Intake, Notification, Archive provenance, and backup recovery continue to own their data. Privacy Operations coordinates those contexts rather than copying their domain rules.

## Request lifecycle

A recently authenticated account can create one open request of each kind:

- `access_export`: collect the account profile, Follow/preferences/Passport state, submissions, and user-visible notifications without exposing other accounts, staff notes, or security internals.
- `account_deletion`: immediately change the Identity account projection from `active` to `deleting`, append the Identity state event, and emit the account-state integration event before the request transaction commits.

Request states are `requested -> verified -> processing -> completed`. `failed` is terminal for the request projection until a later explicit recovery command is added. Every transition is recorded in the append-only `privacy.request_events` table.

Deletion has no grace period. The `deleting` Identity state blocks ordinary authenticated routes immediately. A recently authenticated deleting account may still read only its privacy-request status.

## Retryable context projection

Each request creates a fixed set of owned context projections. Access/export uses:

- `identity_profile`
- `engagement`
- `community_intake`
- `notification`

Deletion uses:

- `identity_access`
- `engagement`
- `community_intake`
- `notification`
- `archive_provenance`
- `backup_tombstone`

Context states are `pending`, `processing`, `completed`, `failed`, `held`, and `not_applicable`. Entering `processing` increments the attempt count. A failed context may re-enter `processing`; completed and not-applicable contexts are terminal. Internal failure codes are visible only to Privacy Operators and never cross the user response boundary.

A request completes only when every context is `completed` or `not_applicable`. Context and request projections use optimistic versions, while transition facts remain append-only. Access/export contexts cannot be marked complete through the generic context command; only successful encrypted artifact generation can complete them. Deletion's `engagement`, `community_intake`, and `notification` contexts must complete through the private-deletion executor, while `archive_provenance` and `identity_access` must complete through final account deletion.

## Encrypted export boundary

Migration `0028_privacy_export_artifacts.sql` stores only application-layer AES-256-GCM ciphertext, a random 96-bit nonce, integrity metadata, key/schema versions, and expiry facts. The encryption root secret is configured outside PostgreSQL, and HKDF derives a distinct artifact key bound to the artifact ID. Additional authenticated data binds the ciphertext to the artifact, request, account, schema, and key version. Plaintext and key material are never stored.

The export builder uses fixed user-visible allowlists. It includes the account profile, Follow and preference state, Passport entries, owned submissions and contributor-visible status, attachment metadata without private object paths, and native Inbox content. It does not read authentication/session internals, staff workflow fields, delivery snapshots, storage object keys, scan internals, or another account's rows.

A Privacy Operator with recent authentication generates the artifact. The command is versioned, idempotent, conflict-of-interest checked, audited, and completes all four export contexts atomically with the request. A user with recent authentication can read artifact metadata and request an HMAC-signed download reference. The signed payload carries only artifact/request IDs plus a keyed account-subject hash, never the account UUID. References last at most 15 minutes and never beyond the artifact expiry; the configured default is five minutes. Each grant, denied account-mismatch attempt, and successful download appends a separate audit fact. Download rechecks ownership, artifact state, expiry, ciphertext SHA-256, AES-GCM authentication, and plaintext byte size before returning a private no-store JSON attachment.

Artifacts expire no later than 24 hours after generation. Expired artifacts cannot receive new references or be downloaded. `key_version` and `schema_version` support forward key rotation and export-schema evolution without accepting unknown versions.

## Archive and Identity finalization

Migration `0029_privacy_archive_identity_finalization.sql` adds one-way privacy fields to community-derived Change Sets, Entity Revisions, and assertion bridges. Final deletion preserves the published fact, immutable revision identity, staff actor fields, and public provenance structure, but removes the contributor account UUID and replaces the former contributor subject hash across retained submissions and Archive provenance with one new random tombstone-scoped hash. Database triggers permit only this narrow privacy transformation and reject every later attempt to restore the account UUID or change the anonymization facts.

Final deletion requires the three private contexts to be completed first. In one PostgreSQL transaction it snapshots and revokes active roles, records a separate staff-role snapshot, anonymizes Archive provenance, revokes Auth refresh credentials, replaces the Auth and Identity email with a non-contactable tombstone address, clears authentication material, marks Auth and Identity deleted, appends the `deleting -> deleted` state event, completes `archive_provenance` and `identity_access`, and emits privacy audit and Outbox facts. The original email and every value derived from it are discarded; no reversible identifier or contact route is stored.

The Identity account UUID remains as a deleted tombstone because Archive, audit, moderation, and publication history use restrictive foreign keys. This row cannot authenticate and exists only to preserve accountable historical references. Backup reapplication remains an independent context, so final Identity deletion does not falsely claim the request is complete before the rolling backup boundary is handled.

## Authorization and sensitive reads

User request creation and status reads require authentication within the configured recent-auth window. Privacy Operator reads and commands require the explicit `privacy.operate` capability and recent authentication. Administrator does not inherit that capability.

User-facing response models exclude account IDs, operator IDs, internal notes, failure codes, and sensitive execution detail. User status reads and Privacy Operator queue/detail reads are private, no-store, noindex, bounded to 100 records, and append read-audit facts. Reusing a correlation ID does not suppress a separate sensitive-read fact. Privacy request creation, verification, and context changes append privacy audit facts and integration Outbox events in the same database transaction. Privacy Operators may inspect their own request status but cannot verify or process their own requests.

## Retention and holds

Migration `0027_privacy_requests_retention_holds.sql` establishes executable policy records rather than prose-only retention, while `0028_privacy_export_artifacts.sql` enforces the artifact lifetime at the storage boundary:

- encrypted export artifacts: at most one day;
- Community Intake drafts: 90 days;
- private notification bodies: 90 days;
- rolling backup/deletion-tombstone boundary: exactly 35 days.

A hold is scoped to one account and one context. It records basis, creator, review due time, and explicit release facts. A held context does not prevent unrelated contexts from continuing. Hold events are append-only.

Deletion tombstones are keyed by account and context. Restore tooling must reapply them throughout the 35-day rolling backup boundary so a restore cannot silently reopen deleted private data. A replay is an account-level transaction rather than a metadata-only marker: restored private domains are deleted again, community and Archive provenance is re-anonymized with the original tombstone hash, restored roles and refresh credentials are revoked, and Identity returns through an audited `active/suspended -> deleting -> deleted` chain. Routine retention runs never perform this operation unless the explicit post-restore replay flag is present.

Migration `0030_privacy_maintenance_metrics.sql` records append-only maintenance runs and indexes the bounded operational queries. `run_privacy_maintenance.py` and the protected Admin maintenance command purge expired export ciphertext, execute Community Intake retention, purge expired Inbox bodies to minimal tombstones, and optionally reapply deletion tombstones after a restore. One PostgreSQL advisory lock prevents overlapping runs, and command input is idempotently hashed.

The protected metrics snapshot exposes counts and ages only. It covers open-request age, failed contexts, orphan attachments, overdue hold reviews, expired export payloads, tombstone replay, export access/downloads, and completed requests. Alert keys are deterministic and contain no account, request, email, or artifact identifiers. Every metrics read and maintenance run appends a Privacy audit fact.

The Privacy Operator Web workbench is capability-scoped to `privacy.operate`, loaded only inside the private dynamic Admin shell, and uses a server-authenticated allowlisted Next proxy. It exposes queue/detail reads and explicit commands for verification, retryable Context transitions, encrypted export, private deletion, final Archive/Identity deletion, narrow Hold create/release, routine retention, and confirmed post-restore replay. React-admin generic CRUD remains disabled, and the browser never receives export ciphertext, authentication material, tombstone email, or former contact data.

## Feature and rollback boundary

`PRIVACY_OPERATIONS_ENABLED=false` hides all user and operator Privacy Operations HTTP routes before authentication or database access. Disabling the feature does not reverse `deleting` or `deleted` account states, remove requests or encrypted artifacts, discard events, release holds, or delete tombstones. Database rollback is forward-fix only because privacy and Identity lifecycle facts are append-only. Export encryption and signing keys are independent production secrets; rotating a key requires a new version rather than rewriting existing audit facts.

## Delivery status

The delivered vertical slice includes request creation and reads, immediate deletion access blocking, operator verification, retryable per-context projections, encrypted and audited access exports with short-lived download references, narrow Hold create/release commands, automatic deletion tombstone creation, real post-restore account-level tombstone replay, executable retention purge, Archive provenance anonymization, final Identity/Auth tombstoning, operational metrics/alerts, the bounded Privacy Operator Web workbench, audit, and Outbox contracts. The private-deletion executor invokes the existing Engagement, Community Intake, and Notification cleanup in one PostgreSQL transaction; final deletion separately owns Archive/Identity completion. Generic commands cannot bypass the deletion executor, export generator, final deletion command, or explicit post-restore replay boundary.
