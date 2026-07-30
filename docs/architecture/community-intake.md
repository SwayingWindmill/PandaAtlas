# Community Intake persistence and private evidence

Issue: #187. Parent map: #174.

## Ownership

The `community_intake` PostgreSQL schema owns authenticated contribution drafts, immutable formal revisions, contributor-submitted source records, private attachment metadata, malware-scan facts, sensitive-read audit, and retention/anonymization facts. It does not create Trusted Archive Sources, approve submissions, or publish public facts.

FastAPI is the sole business write path. The schema is absent from PostgREST API schemas and grants no `USAGE` to `anon` or `authenticated`. Supabase Storage contains bytes only in the non-public `community-intake-private` bucket; the database owns object identity and state.

## Commands and state

A contributor may create an incomplete `draft`, update it with optimistic concurrency, append a formal immutable `SubmissionRevision`, append later revisions, or withdraw. Idempotency replay is resolved before version checks. Formal submission requires at least one SubmittedSource or a completed private attachment.

SubmittedSource remains community-provided evidence. It is not a Trusted Archive Source until later verification and normalization.

Attachment flow:

`reserved/quarantined -> clean | infected | scan_failed -> quarantined retry`, with `deleted` terminal for retention or privacy operations. A PDF, JPEG, PNG, or WebP is limited to 10 MiB; a submission is limited to five files and 30 MiB total. Clean images require a metadata-stripped preview before staff access.

Opaque upload/download references contain only an attachment ID, action, expiry, and nonce. Storage bucket names, object keys, filenames, free text, and EXIF-derived data are excluded from Integration Outbox facts and ordinary responses. Every evidence access decision is recorded in `sensitive_read_events`; access is denied until clean and requires `community_intake.evidence.read`.

## Events

Public-safe Outbox facts:

- `community.submission.draft_created`
- `community.submission.submitted`
- `community.submission.revised`
- `community.submission.withdrawn`
- `community.submission.closed_unincorporated`
- `community.attachment.quarantined`
- `community.attachment.scan_recorded`
- `community.attachment.scan_retry_requested`
- `community.attachment.deletion_requested`

Payloads contain stable IDs and routing metadata only. Revision content, source locator/title, filename, object path, and attachment hashes remain private.

## Retention and deletion

Drafts expire after 90 days. The retention command clears draft content, scrubs and deletes its attachments, retries eligible `scan_failed` attachments after a delay, and deletes incomplete upload reservations older than 24 hours. The `close_unincorporated` hook is reserved for an authorized ReviewCase/integration caller: it closes a submitted contribution without changing immutable revisions, records the retention due date, and later scrubs private attachments while preserving Revision, SubmittedSource, audit, and provenance records.

Account deletion requires Identity state `deleting`. Community Intake attachment bodies and filenames are scrubbed, drafts are cleared, and submissions are detached from the account while immutable revisions, source provenance, hashed subject identifiers, and required audit remain. This runs inside the same transaction as the existing Engagement/Feed/Notification private-data command.

## Operations and rollback

Feature switch: `COMMUNITY_INTAKE_ENABLED=false` stops all HTTP commands while retaining schema, objects, audit, and Outbox facts. `community-intake:retention` runs expiry, scanner retry, and orphan cleanup. Scanner implementations conform to the `MalwareScanner` protocol and must not log bytes or object paths.

Application rollback disables the feature flag; it does not drop migration `0016`, delete the private bucket, or rewrite revisions. Storage/scanner unavailability is fail-closed: evidence remains quarantined and inaccessible.

## Metrics

The admin metrics endpoint reads PostgreSQL for draft/submitted counts, attachment counts by scan state, oldest quarantine age, and granted/denied sensitive reads. Foundation preflight verifies all owned relations, nine protection triggers, three capabilities, the private bucket policy, and browser-role denial.
