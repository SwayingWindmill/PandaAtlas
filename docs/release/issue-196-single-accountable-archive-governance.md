# Issue #196 — Single-accountable-approver Archive governance closure

This document defines the final evidence package for closing map #175. It does not certify completion by itself. Certification requires the authoritative map-close run, required environment-backed steps, and sealed artifacts to pass on the final PR head.

## Machine-readable evidence

The closure matrix is stored at:

`data/release-evidence/issue-196-single-accountable-archive-governance.json`

Validate it with:

```sh
node scripts/release/validate-archive-governance-evidence.mjs
```

The validator fails closed when a required category is missing, a blocker remains open, a scenario is not covered, a repository evidence reference is missing, or a scenario has neither an executable gate nor an immutable artifact location.

## Required categories

- `inventory-adr-cutover`
- `migration-rehearsal-integrity`
- `accountable-publication-transaction`
- `projection-activity-notification`
- `correction-rollback-identity-history`
- `admin-browser-accessibility-budget`
- `operations-recovery-cross-platform`

## Closure invariants

1. Historical four-eyes reviews, actors, reasons, Releases, and audit events remain immutable and readable.
2. No legacy waiting or approved record is silently reinterpreted as ready or auto-published.
3. Ordinary publication requires one explicit Archive Editor capability. Sensitive publication and sensitive operations require Senior capability and recent authentication.
4. Administrator and service accounts do not inherit publication or sensitive Archive capabilities.
5. Every publish, rollback, correction, retraction, merge, split, and emergency takedown creates a new immutable Release and never edits the Public Projection directly.
6. The Archive pointer may advance before Public Projection; the prior public version remains available until projection succeeds.
7. Cutover hold blocks new publication independently of application deployment and never deletes new data or moves a Release pointer backward.
8. Emergency takedown only reduces public exposure and records a formal follow-up Change Set deadline.
9. Browser tools remain bounded React-admin routes with generic CRUD disabled, private no-cache/noindex responses, and server-side authorization.
10. Map #175 closes only after all required Linux, Windows, Supabase, browser, accessibility, recovery, staging, and immutable evidence steps pass or are explicitly recorded as environment-blocked by the authoritative policy.

## Expected immutable artifacts

- `.release-gate/default.json`
- `.release-gate/map-close.json`
- `.release-gate/map-close-manifest.json`
- `.release-gate/map-close-manifest.sha256`
- `.release-gate/archive-governance-rehearsal.json`

The manifest SHA-256 is the final tamper-evident reference. Artifact paths and the final commit SHA must be recorded in #196 before #175 is closed.

## Rollback switches

- `ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED=false`
- `COMMUNITY_CURATION_BRIDGE_ENABLED=false`
- `REVIEW_MODERATION_ENABLED=false`
- `COMMUNITY_INTAKE_ENABLED=false`
- `ACTIVITY_ENABLED=false`
- `NOTIFICATION_ENABLED=false`

These switches stop new processing. They do not authorize deletion of single-accountable Releases, receipts, audit events, migration evidence, Activity history, or contributor incorporation history.
