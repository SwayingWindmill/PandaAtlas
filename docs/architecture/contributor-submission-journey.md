# Contributor submission journey

Issue: #188. Parent map: #174. Persistence foundation: #187.

## Ownership

Community Intake owns the contributor-facing command model and projection for authenticated corrections and sourced information about an existing stable Panda target. It owns private drafts, immutable formal revisions, contributor-visible status history, per-assertion outcomes, attachment scan state, account-scoped journey analytics, and public-safe Integration Outbox facts.

It does not own ReviewCase decisions, staff deliberation, Trusted Archive Sources, Change Sets, publication, or the public Panda projection. Issue #189 may consume explicit Intake outputs but must not rewrite contributor revisions or expose review internals.

## Commands and concurrency

The contributor command surface is:

- create a private draft;
- save an incomplete draft;
- reserve and upload private evidence;
- submit a formal revision;
- respond to an `action_required` status with another immutable revision;
- withdraw before incorporation begins.

Every mutating command accepts an idempotency key. Commands that target an existing submission also require a resource-scoped `If-Match` ETag and an `expected_version`. Exact idempotency replay is resolved before stale-version rejection, so a retried successful request returns its original result even when its old ETag is no longer current. A reused key with different content is rejected.

Draft assertions are deliberately permissive. A draft may omit a field path, proposed value, explanation, or evidence. Formal submission is strict: each assertion requires a field path, a proposed value, at least ten characters of explanation, and at least one included source locator or private attachment. The contributor must explicitly confirm the formal payload.

## Contributor status projection

The append-only contributor status vocabulary is:

`draft`, `submitted`, `action_required`, `duplicate`, `out_of_scope`, `not_accepted`, `accepted`, `incorporation_in_progress`, `incorporated_full`, `incorporated_partial`, `withdrawn`, `expired`, `target_merged`, and `target_unpublished`.

`community_intake.contributor_status_events` stores only contributor-visible explanations, requested fields, stable redirect targets, revision references, hashed actors, correlation IDs, and idempotency keys. Internal reviewer identity, notes, scoring, assignment, or decision tables are not part of the contributor response. `community_intake.contributor_assertion_results` records explicit selected, rejected, incorporated, not incorporated, pending, or superseded outcomes per assertion and revision.

Only identities with `community_intake.status.project` may project status. The capability is assigned to Reviewer and Moderator roles without expanding the global Administrator capability set. A reviewer cannot project their own submission, and anonymized submissions cannot receive new contributor notifications.

Migration `0017` backfills existing #187 submissions from their prior state and appends an initial status event, so upgrades do not present submitted, withdrawn, expired, or closed records as drafts.

## Evidence and privacy boundary

Browsers never receive the Supabase service-role key, bucket name, or object key. The localized Web journey posts to a server-only Next proxy, which verifies the Supabase session and forwards the bearer token to FastAPI. Multipart bytes then pass through FastAPI to the private `community-intake-private` bucket. Responses expose stable attachment IDs and scan state only.

Private pages and proxy responses are `no-store`, `noindex`, and `nofollow`. The API response model is constructed from an explicit contributor-visible field whitelist; account IDs, subject hashes, staff actors, source context, audit details, and internal review state are excluded.

## Notification behavior

Formal submission returns an inline confirmation and emits an Outbox fact with `notify_contributor=false`; opening or submitting the form does not create a duplicate Inbox item.

Later contributor status changes emit `community.submission.contributor_status_changed` with the owning account ID, stable submission ID, contributor status, active revision number, and `/me/submissions/{submission_id}` link. Notification Orchestration classifies ordinary review updates as `submission_status` and incorporation states as `incorporation`, creating a persistent station Inbox item subject to the account's existing notification policy.

## Web journey

Feature switch: `NEXT_PUBLIC_COMMUNITY_INTAKE_ENABLED` controls navigation and localized routes, while `COMMUNITY_INTAKE_ENABLED` gates FastAPI before database access.

The Web surfaces are:

- `/{locale}/contribute` for private draft creation;
- `/{locale}/me/submissions` for account-scoped status and analytics;
- `/{locale}/me/submissions/{submission_id}` for draft editing, formal submission, requested-information response, withdrawal, evidence state, status history, immutable revisions, and per-assertion results.

Draft edits are debounced and synchronized to the server. The UI is bilingual, responsive at narrow widths, keyboard focus-visible, and does not create a public contributor profile, follower graph, ranking, or recommendation surface.

## Operations and rollback

FastAPI remains the sole business write path. The `community_intake` schema is absent from PostgREST exposure and denies browser-role schema usage. Contributor status, assertion result, and journey event tables are append-only.

Rollback disables both feature switches. It does not drop migration `0017`, delete revisions or evidence metadata, erase status history, or retract already-created Inbox records. Foundation preflight verifies migrations `0001–0017`, twelve Community Intake protection triggers, four exact Community Intake capabilities, the private bucket policy, and unchanged Administrator capabilities.
