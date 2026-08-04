# ZhiPanda V1 operational readiness runbook

This runbook is the operator index for Issue #200. It extends the repository's existing default, extended, map-close, and Windows Release Gates. It does not authorize an independent release path, production mutation, or bypass of immutable Release governance.

The machine-readable source of truth is `contracts/zhipanda-v1-operational-readiness.v1.json`. The contract is validated by `scripts/release/check-zhipanda-v1-operational-readiness.mjs` and by the existing `scripts/release/tests/*.test.mjs` Release Gate test glob.

## Common incident decision flow

1. Identify the affected SLO, environment, first known bad release or event, and whether public or private data is at risk.
2. For security, privacy, authorization, provenance, audit-integrity, or public-release inconsistency, classify the incident as P1 and stop the affected command or delivery surface immediately.
3. Preserve PostgreSQL authoritative state, immutable Releases, Outbox and queue rows, private evidence, audit facts, deletion tombstones, and generated recovery evidence. Do not repair an incident by rewriting append-only history.
4. Prefer stop or drain, then rollback a read or delivery surface, then replay or rebuild from authoritative state. Use a forward fix when rollback could reopen a deleted or suspended account, release a Hold, discard a tombstone, or weaken audit.
5. Record the operator, start time, correlation identifiers, affected version or release, dashboard snapshots, commands run, evidence paths, and decision owner.
6. Close the incident only after the relevant SLO is healthy, duplicate and stale-state checks pass, and the chosen rollback or forward-fix boundary has been verified.

## auth-and-session

**Owner:** Identity and Engagement.

**P1 triggers:** eligible authentication success below the contract threshold; successful access by a suspended, deleting, or deleted account; issuer, audience, expiry, or JWKS validation bypass; recent-auth enforcement bypass.

**Stop boundary:** set `IDENTITY_AUTH_ENABLED=false` for new authenticated product journeys when the failure is systemic. This must not delete account IDs, role assignments, revocations, audit evidence, or pending privacy state.

**Diagnosis:** inspect authentication failures by reason without logging OTPs, tokens, cookies, authorization headers, or ordinary full email addresses. Confirm Supabase issuer and JWKS reachability, clock skew, account state, role revocations, and local account loading.

**Recovery:** restore validated configuration, prove inactive-account denial, then re-enable authentication. Run the identity and engagement recovery drill before a final-candidate decision:

```text
npm run drill:identity-engagement-recovery
```

## follow-and-passport

**Owner:** Identity and Engagement.

**P2 triggers:** Follow command error rate above threshold, duplicate active relationships, expired Pending Follow completion, or Passport divergence from authoritative events.

**Stop boundary:** set `ENGAGEMENT_ENABLED=false`. Existing Follows, consent decisions, Passport history, and idempotency receipts remain intact.

**Recovery:** repair the command or projection, replay only through idempotent handlers, and rebuild Passport from authoritative events when needed. Verify that legacy Saved Panda state is not recreated and email consent remains independent from Follow.

## activity-and-feed

**Owner:** Public Activity.

**P1 triggers:** unpublished content appears, correction or retraction ordering breaks, oldest eligible unprojected event exceeds the contract threshold, or public and personalized views disagree about the current release.

**Stop boundary:** stop the Activity projector and, when needed, set `ACTIVITY_ENABLED=false` or `FEED_ENABLED=false`. Preserve the authoritative Outbox, Follow state, and existing public Activity facts.

**Recovery:** repair the consumer, replay events idempotently, and rebuild the projection from published authoritative events. Confirm chronological ordering, published-only visibility, correction and retraction behavior, cursor stability, and no recommendation fallback.

## notification-inbox-and-email

**Owner:** Notification Orchestration.

**P1 triggers:** mandatory security intent loss, unaudited sensitive delivery, signed-webhook bypass, cross-account Inbox visibility, or duplicate logical notification after replay.

**P2 triggers:** native Inbox lag, provider terminal-state latency, bounce or complaint processing delay, or optional email delivery degradation.

**Stop boundary:** disable application email first with `NOTIFICATION_EMAIL_ENABLED=false`; keep native Inbox active when safe. Use `NOTIFICATION_ENABLED=false` only when intent or Inbox correctness is at risk. Preserve intents, channel decisions, read state, retractions, attempts, and dead-letter evidence.

**Recovery:** verify preference snapshots and mandatory-message rules, replay idempotently, and run:

```text
npm run drill:notification-staging
```

Confirm duplicate and out-of-order webhook handling before email is re-enabled.

## queue-and-dlq

**Owner:** Release Engineering and each context worker owner.

**P1 triggers:** oldest ready message above threshold, unexpected DLQ growth, visibility-timeout churn, replay creating duplicate business results, or queue restore losing acknowledged authoritative events.

**Stop boundary:** stop consumers, not the authoritative PostgreSQL Outbox. Do not delete ready, leased, archived, or dead-letter rows to make a dashboard green.

**Recovery sequence:**

1. Capture queue depth, oldest age, retry distribution, dead-letter identifiers, and corresponding Outbox event IDs.
2. Repair the worker or dependency.
3. Replay one bounded sample and verify idempotency receipts and business-state uniqueness.
4. Resume in small batches while monitoring age and duplicate metrics.
5. Record an explicit disposition for every dead-letter item.

Queue restore evidence must include duplicate handling and the point-in-time recovery assumption.

## submission-review-and-scanning

**Owner:** Community Intake and Review and Moderation.

**P1 triggers:** quarantined or non-clean evidence becomes readable, object paths or signed references enter ordinary logs, self-review succeeds, or immutable revisions are overwritten.

**P2 triggers:** submission or review SLA breach, scanner backlog, orphan attachment growth, or repeated scan failure.

**Stop boundary:** set `COMMUNITY_INTAKE_ENABLED=false` for new submissions or stop attachment completion separately. Keep submitted revisions, sources, ReviewCases, quarantine objects, and audit facts.

**Recovery:** fail closed on preview and download, retry scanning through the approved adapter, clean orphaned objects only through retention rules, and verify source normalization plus full and partial incorporation boundaries. Run the PostgreSQL and attachment recovery drill:

```text
npm run drill:postgres-attachment-recovery
```

## archive-publication-and-projection

**Owner:** Trusted Archive, Public Projection, and Release Engineering.

**P1 triggers:** broken provenance chain, self-publication or unauthorized publication, mutable published history, Web and API release mismatch, projection timeout, or withdrawn data remaining public.

**Stop boundary:** stop publication commands. Keep the current immutable Release active unless a targeted withdrawal or pointer rollback is required. Never rewrite a historical Release.

**Recovery commands:**

```text
npm run drill:release-recovery
npm run staging:api:full
npm run staging:web:full
```

The first command is a clean-checkout deterministic drill. The staging commands require approved non-production credentials and must record the target environment, release identifiers, withdrawal evidence, rollback evidence, and stale-response checks.

## privacy-deletion-retention-and-holds

**Owner:** Privacy Operations.

**P1 triggers:** a confirmed deletion account can authenticate, immediate blocking is not atomic, context failure is hidden, anonymization is reversible, a Hold expands beyond its recorded scope, or a restore omits a required deletion tombstone.

**Stop boundary:** set `PRIVACY_OPERATIONS_ENABLED=false` for new requests. This must not reopen blocked accounts, release Holds, remove tombstones, restore contactability, or reverse completed anonymization.

**Recovery:** retry only failed contexts using current version checks. Non-held scope must continue deletion. Post-restore replay requires explicit operator intent, account scope, and evidence that the restored data falls within the rolling backup boundary.

The dedicated tombstone replay drill remains planned until Issue #198 is merged into the Issue #200 branch. The contract must not mark that drill available or claim evidence before then.

## audit-and-sensitive-reads

**Owner:** Audit and each source context.

**P1 triggers:** a designated sensitive command succeeds without required audit persistence, projection lag exceeds threshold, prohibited secrets or ordinary full email enter audit payloads, sensitive reads are unaudited, encrypted export retention fails, or an integrity digest mismatches.

**Stop boundary:** `UNIFIED_AUDIT_ENABLED=false` may hide the unified read surface only. It must not disable required source-context audit persistence. Commands designated fail-closed remain unavailable until durable audit writes recover.

**Recovery:** repair source persistence first, then replay projection idempotently, verify rejected-payload evidence, expire encrypted artifacts according to policy, generate a new integrity check, and record the mismatch disposition. The dedicated outage and integrity recovery drill remains planned until Issue #199 is merged into the Issue #200 branch.

## admin-access-and-security

**Owner:** Identity and Engagement plus each administration context.

**P1 triggers:** unauthorized command success, direct browser business-table write, service-role or secret leakage, private FastAPI path exposure through a generic proxy, capability inheritance outside the approved matrix, or missing recent-auth enforcement.

**Stop boundary:** set `ADMIN_SHELL_ENABLED=false`. Server-side FastAPI authorization remains deny-by-default, and background workers continue only when their own credentials and scopes are healthy.

**Recovery:** rotate exposed credentials when applicable, invalidate affected sessions, verify capability assignments and revocations, run public/private API boundary checks, inspect production bundles for secrets and admin dependencies, and re-enable one bounded workbench at a time.

## launch-decision-and-evidence

Issue #200 produces executable operational controls but does not make the final ZhiPanda V1 launch decision. Issue #201 owns the closed-loop staging and production-readiness decision after Issues #197, #198, #199, and #200 are integrated.

A final candidate must record:

- launch owner and go or no-go decision;
- source commit, merge commit, version, schema and migration set;
- default, extended, Linux map-close, and Windows map-close results;
- browser, mobile, WCAG 2.2 AA, performance, security, and privacy evidence;
- database, Storage, queue, email, scanner, public withdrawal, projection rebuild, tombstone replay, audit outage, and feature-flag rollback evidence;
- immutable evidence hashes and artifact locations;
- dashboards, alerts, incident owners, rollback switches, and post-launch monitoring window;
- unresolved exceptions with explicit owner, expiry, and decision impact.

The contract remains `in-progress` while any recovery drill is `planned`. It may be marked `complete` only after all planned drills have executable commands and repository evidence, and the existing Release Gate proves the contract from a clean checkout without modifying tracked files.
