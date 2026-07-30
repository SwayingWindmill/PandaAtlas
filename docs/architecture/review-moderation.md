# Review & Moderation

Review & Moderation owns `ReviewCase`, assignment, triage, source verification, requests for information, append-only decisions, Curation recommendations, SLA state, and reviewer-sensitive audit. Community Intake continues to own `Submission`, immutable revisions, contributor-visible status, SubmittedSource records, and private attachment metadata.

## State and concurrency

A submission may have at most one non-closed ReviewCase. Reopening never mutates or deletes the closed case or its decision; it creates a new ReviewCase linked through `reopened_from_review_case_id`. Every mutable ReviewCase command carries `expected_version` and an idempotency key. Idempotent replay is resolved before optimistic-concurrency validation.

The queue states are `new`, `triage`, `assigned`, `waiting`, `decision_ready`, `incorporation_recommended`, and `closed`. `sla_overdue` is a derived queue view, not a stored business state. First response is due after three weekdays by default; the feature setting may change the count while preserving the same weekend-skipping rule.

## Authorization and conflicts

FastAPI checks one explicit capability for every command. Reviewer and Moderator receive the ReviewCase capabilities; Administrator and service accounts receive none implicitly. A contributor cannot intake, claim, verify, decide, recommend, or reopen their own submission. The database independently rejects self-assignment and self-decision.

The bounded React-admin workbench may use only the dedicated ReviewCase APIs. Generic React-admin CRUD remains disabled, and the browser never writes business tables.

## Evidence and decisions

Only the active immutable SubmissionRevision is reviewable. SubmittedSource verification is append-only and records normalized locator evidence separately from the contributor's original source. Attachment bodies remain private; the workbench receives metadata and may use the existing short-lived, audited Community Intake access command only when the attachment state is `clean`.

An `accepted` decision requires:

- an explicit active revision;
- every SubmittedSource in that revision to have a latest `verified` result;
- every bound non-deleted attachment to be `clean`;
- a contributor-visible explanation; and
- at least one selected assertion.

Decisions distinguish `accepted`, `not_accepted`, `duplicate`, `out_of_scope`, and `abuse`. Internal reasons remain in Review & Moderation. Contributor-visible projections contain only the safe explanation and per-assertion dispositions. A later recommendation copies only the selected assertion keys into append-only Curation recommendation records; it does not create a Change Set or publish Archive facts.

## Contracts

`services/api/openapi/review-moderation-v1.yaml` owns the bounded reviewer command shapes. The canonical `panda-atlas-v1.yaml` contract registers each Review & Moderation operation through explicit Path Item references so release tooling and downstream clients discover the routes without duplicating their schemas.

## SLA, audit, and rollback

`review_moderation.review_case_queue` exposes queue age and overdue state. `review_moderation.sla_alerts` is the stable alert source for the three-business-day first-response objective. Intake, triage, assignment, requests, verification, decisions, recommendations, reopen, and denials write audit evidence. Information-request internal notes are stored separately and never copied into contributor status.

`REVIEW_MODERATION_ENABLED=false` is the rollback switch. Disabling it stops ReviewCase reads and commands without disabling contribution intake, deleting revisions, removing evidence, or changing contributor-visible state. Migration `0019` is additive and forward-fix only.
