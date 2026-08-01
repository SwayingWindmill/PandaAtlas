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

A request completes only when every context is `completed` or `not_applicable`. Context and request projections use optimistic versions, while transition facts remain append-only.

## Authorization and sensitive reads

User request creation and status reads require authentication within the configured recent-auth window. Privacy Operator reads and commands require the explicit `privacy.operate` capability and recent authentication. Administrator does not inherit that capability.

User-facing response models exclude account IDs, operator IDs, internal notes, failure codes, and sensitive execution detail. User status reads and Privacy Operator queue/detail reads are private, no-store, noindex, bounded to 100 records, and append read-audit facts. Reusing a correlation ID does not suppress a separate sensitive-read fact. Privacy request creation, verification, and context changes append privacy audit facts and integration Outbox events in the same database transaction. Privacy Operators may inspect their own request status but cannot verify or process their own requests.

## Retention and holds

Migration `0027_privacy_requests_retention_holds.sql` establishes executable policy records rather than prose-only retention:

- encrypted export artifacts: at most one day;
- Community Intake drafts: 90 days;
- private notification bodies: 90 days;
- rolling backup/deletion-tombstone boundary: exactly 35 days.

A hold is scoped to one account and one context. It records basis, creator, review due time, and explicit release facts. A held context does not prevent unrelated contexts from continuing. Hold events are append-only.

Deletion tombstones are keyed by account and context. Restore tooling must reapply them throughout the 35-day rolling backup boundary so a restore cannot silently reopen deleted private data.

## Feature and rollback boundary

`PRIVACY_OPERATIONS_ENABLED=false` hides all user and operator Privacy Operations HTTP routes before authentication or database access. Disabling the feature does not reverse `deleting` or `deleted` account states, remove requests, discard events, release holds, or delete tombstones. Database rollback is forward-fix only because privacy and Identity lifecycle facts are append-only.

## First-slice status

The first vertical slice delivers request creation and reads, immediate deletion access blocking, operator verification, retryable per-context projections, retention/hold/tombstone storage, audit, and Outbox contracts.

Encrypted export generation and delivery, automatic calls into each context's deletion/anonymization command, hold create/release commands, tombstone replay jobs, metrics, alerts, and the Privacy Operator Web workbench remain follow-up work within Issue #198.
