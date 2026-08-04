# Issue #197 — Scoped moderation and appeals

This document records the deployment, verification, alert, and rollback contract for scoped account moderation. It does not certify map completion; final certification remains the responsibility of the final-candidate map-close issue.

## Enablement order

1. Apply Supabase migration `0026_scoped_moderation_and_appeals.sql`.
2. Deploy FastAPI with `MODERATION_CONTROLS_ENABLED=false`.
3. Verify Identity authentication and the bounded Admin shell are healthy.
4. Confirm Moderator and Reviewer role assignments are explicit and Administrator/Archive Editor accounts have no moderation capability.
5. Enable `MODERATION_CONTROLS_ENABLED=true`.
6. Verify the user notice route, Admin workbench, metrics, and one non-production warning/restore rehearsal.

Recommended related switches:

```text
IDENTITY_AUTH_ENABLED=true
ADMIN_SHELL_ENABLED=true
REVIEW_MODERATION_ENABLED=true
MODERATION_CONTROLS_ENABLED=true
COMMUNITY_INTAKE_ENABLED=true
NOTIFICATION_ENABLED=true
```

Alert thresholds:

```text
MODERATION_REPEAT_ABUSE_ALERT_COUNT=3
MODERATION_SANCTION_AGE_ALERT_SECONDS=2592000
MODERATION_APPEAL_AGE_ALERT_SECONDS=432000
```

## Required verification

Run the deterministic contract and runtime tests:

```sh
uv run --directory services/api --frozen --extra dev pytest -q \
  tests/review_moderation/test_moderation_models.py \
  tests/api/test_moderation_endpoints.py \
  tests/contracts/test_moderation_storage_contract.py \
  tests/contracts/test_moderation_openapi_contract.py
```

Run the real PostgreSQL journey after a clean Supabase reset:

```sh
npm run infra:start
npx supabase db reset --workdir infra
RUN_REAL_DB_TESTS=1 \
DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres \
REAL_DB_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres \
uv run --directory services/api --frozen --extra dev pytest -q \
  tests/integration/test_scoped_moderation_real_db.py
```

The real-DB journey must demonstrate:

- sanction and Identity suspension commit atomically;
- a suspended account can read its user-visible notice and open an appeal;
- the appeal first-response deadline skips weekends and is five business days;
- overturn appends restoration, closes the appeal, and restores moderation-owned Identity state atomically;
- submission restriction is enforced by Community Intake;
- optional notifications are suppressed while mandatory notifications remain eligible;
- a newer same-scope sanction supersedes the prior projection without mutating history;
- append-only facts reject update/delete; and
- Outbox facts exist for sanction, Identity state, appeal, decision, and restoration.

## Operator procedure

Before applying a sanction, confirm the target account UUID, current moderation subject version, requested scope, duration, evidence, internal explanation, and user-visible explanation. Use the Reviewer 24-hour freeze only for immediate submission containment; it cannot suspend an account or restrict attachments or notifications.

For restoration, reload the subject immediately before submitting the command. Restore only the currently projected sanction ID and use the current `version`. Restoration does not reassign roles, re-enable email preferences, remove audit history, or delete the original sanction.

For an appeal, acknowledge the case before the five-business-day deadline. `overturned` requires the current moderation subject version because restoration occurs in the same transaction. Use `upheld` when the original sanction remains valid and `dismissed` only when the appeal is invalid or not reviewable.

## Alerts and recovery

The Admin metrics endpoint and `review_moderation.moderation_alerts` must be monitored for:

- `appeal_sla_overdue`;
- `expired_restriction_projected`;
- `inconsistent_account_state`;
- repeat-abuse threshold;
- oldest active-sanction age; and
- oldest open-appeal age.

A time-bounded restriction may become ineffective while its stored projection remains set. This is deliberate fail-closed behavior. Inspect the evidence and current version, then append a restoration. Do not update `moderation_subjects` or `identity.accounts` directly.

If Identity state and moderation projection disagree, stop new account-wide sanctions, keep `MODERATION_CONTROLS_ENABLED=true` for read/repair visibility, identify the latest sanction/restoration and Identity state event, then repair through a forward-fix command or migration. Never delete or rewrite audit, receipt, appeal, or sanction facts.

## Rollback

Set:

```text
MODERATION_CONTROLS_ENABLED=false
```

This stops new user notice/appeal reads and Admin moderation commands before database access. Existing product capability checks continue to honor the last committed Identity state and scope projection. If emergency restoration is required while the switch is disabled, temporarily re-enable the service for a versioned restoration command or ship a reviewed forward-fix; do not directly mutate append-only facts.

Database rollback is forward-fix only. Migration `0026` must not be reversed by dropping tables, enum values, capabilities, audit history, or Outbox facts.
