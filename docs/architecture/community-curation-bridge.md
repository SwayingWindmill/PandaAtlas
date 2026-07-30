# Community-to-Curation Bridge

Issue #192 connects accepted community assertions to the Curation and Archive publication pipeline without allowing community review state to become an Archive approval fact.

## Boundary

The bridge is an anti-corruption layer between `review_moderation`, `community_intake`, Curation Change Sets, Archive Release events, Public Projection results, and contributor-visible status. The new `community_curation` schema is private and has no PostgREST exposure.

## Bridge creation

`POST /api/v1/admin/community-curation/review-cases/{review_case_id}/bridge` creates one Curation Change Set from the latest accepted decision on the active ReviewCase revision.

The PostgreSQL command requires:

- the ReviewCase is `incorporation_recommended`;
- the actor is the assigned reviewer and the accepted decision author;
- optimistic ReviewCase version matches;
- selected assertion keys are present on the active revision;
- idempotency replay is resolved before version and policy checks.

The command preserves the submission, revision, ReviewCase, decision, selected assertion keys, non-recommended assertion keys, source IDs, attachment IDs, contributor account, target, base Archive version, risk level, actor roles, reason, and correlation ID.

The created Change Set is `single-accountable-approver-v1`, `not_validated`, `draft`, and `origin_context='community_intake'`, so #191 validation and self-publication rules still apply. The contributor status becomes only `incorporation_in_progress`.

## Release and projection

`POST /api/v1/admin/community-curation/releases/{release_id}/observed` idempotently records the `archive.release.published` result for the bridged Change Set.

`POST /api/v1/admin/community-curation/bridges/{bridge_id}/releases/{release_id}/projection-result` records Public Projection results. Failed projection events remain visible but do not mark contributor incorporation complete. Projected events set `incorporated_full` or `incorporated_partial` and create one incorporation notification intent/inbox item for account-backed contributors.

## Recovery and metrics

`GET /api/v1/admin/community-curation/bridge-metrics` exposes accepted decisions, bridged decisions, release-observed bridges, projected bridges, failed projection bridges, stuck bridges, and broken release links.

The bridge does not perform Curation validation, publication, correction, rollback, or immutable-history certification. Those remain owned by #191, #194, #195, and #196.
