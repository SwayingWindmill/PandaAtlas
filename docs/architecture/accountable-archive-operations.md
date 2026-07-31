# Accountable Archive Operations

Issue #194 extends the single-accountable-approver publication model from ordinary publication into correction, rollback, retraction, merge/split, and emergency public-risk reduction.

## Invariants

- Published Releases are immutable. An operation always creates a new `publication_batches` row and a new append-only `archive_operation_records` row.
- The authoritative Archive pointer advances transactionally. The public pointer does not advance until Public Projection successfully consumes the operation event.
- Idempotency replay is resolved before locking the Archive pointer or evaluating optimistic concurrency.
- Ordinary latest-release rollback and ordinary targeted correction are available only to explicitly capable Archive Editors.
- Sensitive correction, complex rollback, merge/split, and emergency takedown require Senior capabilities and recent authentication.
- Administrator and service accounts receive no operation capability through implicit role inheritance.
- Emergency takedown may only reduce public exposure. It cannot introduce or replace Archive facts.
- Every emergency takedown records a follow-up deadline one day after the command and must be linked to a formal accountable Change Set.

## Release semantics

`public.execute_accountable_archive_operation` creates a complete immutable Release:

- rollback copies the target Release snapshot and records `rollback_target_id`;
- correction, retraction, merge/split, and emergency takedown inherit the current Archive snapshot and add an operation overlay;
- the operation overlay contains explicit subjects, source/destination identities, effect payload, impact preview, actor/role/capability snapshots, reason, and correlation ID;
- one `archive.operation.<operation_type>` Outbox event is written in the same transaction;
- `archive_release_pointer` advances immediately, while `public_release_pointer` remains unchanged.

The Public Projection consumer owns public application of the overlay. A projection failure therefore leaves the prior public version active without erasing the successful authoritative Release.

## Merge and split impact boundary

The command requires a structured impact preview covering:

- active Follow relationships;
- Activity items;
- slug aliases and public redirects;
- lineage/relationship edges;
- residency records;
- media assets;
- evidence sources;
- affected canonical public URLs and warnings.

The effect payload carries the selected identity mapping and alias redirects. The operation ledger preserves this preview for workbench review and the final #196 migration/recovery gate.

## Correction and notification events

Targeted correction, retraction, and emergency takedown operation events are marked notification-eligible in the Outbox payload. Activity and Notification projectors remain responsible for producing public-safe `activity.item.corrected` or `activity.item.retracted` results and deduplicated station/email intents after Public Projection.

## Emergency follow-up

`public.complete_emergency_takedown_followup` accepts only a `single-accountable-approver-v1` Change Set in `ready` or `published` state. Completion evidence is append-only and retains the operation, Change Set, actor, reason, correlation ID, and completion timestamp.

`archive_operation_metrics` exposes operation counts, pending projection count, and overdue emergency follow-up count for #195 workbenches and #196 release certification.

## Rollback switches

- `ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED=false` stops all new accountable publication and operation commands.
- Disabling operation commands does not delete Releases, operation evidence, audit records, or Outbox events.
- Application rollback must keep migration `0022` readable and must not move either Release pointer backward outside an explicit new rollback Release.
