# Admin UX V3 — Publication resource impact inspection (#471)

## Purpose and source of truth

Part of parent #444, stacked after Draft #470. This is a bounded Impeccable Operate improvement, **not** whole-Admin Kiranism visual sign-off and not a production release.

Previously, Publication displayed counts of changed resources by kind, without identifying **which** records changed. The backend's existing `describeTransition` already compares resource membership hashes and returns `resourceKind`, `resourceId`, and `changeType`. Its inspection query discarded those IDs when creating summaries. This slice now returns a **typed, bounded page of the actual IDs** alongside the unchanged total/category summaries. Nothing is reverse-inferred from counts.

## Contract and interaction

- The existing GET release-inspection route accepts optional `changeLimit` (1–50, default 10) and `changeOffset` (zero or more, default zero). It returns `changeTotal`, `changeOffset`, and `changeItems` with resource kind, stable raw ID and one of `added`, `changed`, `removed`. IDs come from the current-to-candidate release membership comparison, not a fabricated front-end list. The same membership comparison powers the original aggregated counters; paging does not truncate totals.
- The Admin client shows the current and target version, overall change total, added/changed/removed totals, a clear non-destructive meaning of *removed*, a per-type summary, and the exact affected resource IDs. Resource rows have 10-per-page navigation that preserves the scroll position and the selected release. The top summary links directly to the detail heading. Re-selecting a version resets the detail page.
- **Semantics are explicit:** a membership digest change indicates a version snapshot change, **not a field-level change log**. An excluded resource is not necessarily deleted from the database. No source facts, panda names, detailed field labels, or inspectable resource links are invented where there is no supported data contract.
- If the selected release is current, or no current public version exists, the UI does not claim a meaningful comparison. If membership hashes show no change, the empty state says only that no membership change was detected, not that every field was separately verified.
- The existing version-action dialog repeats the actual total and breakdown before activation or rollback. It retains typed reasons, audit logging, capability gates, recent-AAL requirements and the existing confirmation/cancel behavior. Detail request failures can be retried without losing the selected version. Mutation data and auth contracts remain unchanged.
- The previous details panel was replaced by a single comparison hierarchy rather than more cards. Existing shadcn controls and native links/lists are reused; no new frontend dependencies.

## 1440px browser visual audit

The following images are **fresh 1440×900 Edge captures from this branch using explicit synthetic versions and resource IDs**. They are ignored local artifacts at `.release-gate/admin-ux-471/`; they are **not production data or representative real-domain content**.

| Evidence file | Direct visual observation / result |
| --- | --- |
| `publication-populated-1440.png` | The current version, candidate and 23-change overview appear in the first viewport. All 11 removals are prominently called out, with a clear “not deleted from database” qualification. The affected-ID list begins near the viewport bottom. |
| `publication-changes-1440.png` | After scrolling, explicit resource IDs, category and snapshot-change type are readable; no truncation or competing cards. The queue and sidebar remain stable. |
| `publication-paged-1440.png` | The second page shows IDs 11–20 of 23 and retains the user's scroll location after requery. A separate browser test confirms scrolling does not jump back to the page header. |
| `publication-confirm-1440.png` | Actual alert dialog shows candidate/current versions, total changed members, breakdown including 11 exclusions, semantic limitation, and user-entered reason. The destructive effect is understandable before confirmation. |
| `publication-empty-1440.png` | No-change state is factual and does not assert field-level data verification. |
| `publication-error-1440.png` | Error is visible in the right-hand inspection pane with a meaningful requery control. The release queue stays available. |

**Visual judgment:** major task-level usability improvements confirmed for desktop: impact visible up front, concrete identity is discoverable, removals are not conflated with deletions, paging does not lose context, and the confirmation names its effect. The use of the same restrained visual system as the other V3 slices is coherent; it still does **not** constitute visual parity with the Kiranism reference or final owner approval.

**Remaining constraints under #444:** the API cannot currently answer which *fields* changed or render a grounded human-readable name for every resource kind. For that, a separately contracted data-provenance diff API and genuine public-release fixtures are required. Also inspect release workloads at real production scale and audit long resource identifiers. Other Admin workspaces' full operator-state visual inspection (Moderation, Curation, MFA) is still open; screenshots of their loading/error shell are not evidence of real workflow acceptance.

## Verification

- Browser TDD: the pre-change UI failed the concrete-resource inspection test, then passed after server/frontend implementation.
- Backend unit: `services/api/test/publication-inspection.spec.ts` validates that the paginated change IDs preserve total and summary, and out-of-range pages do not invent records.
- Full Admin Playwright public browser seam includes concrete paging/scroll preservation, accessible impact readout and confirmation, error retry, and existing lifecycle/MFA/auth/URL behavior. Automated accessibility runs against the populated comparison state.
- OpenAPI JSON and API-client TypeScript declarations were regenerated using the repository's canonical generators. Backend/web typechecking, scoped ESLint, design policy, runtime boundary, Impeccable detection and full Admin browser suite were run locally (final counts recorded in PR).

No independent design reviewer or owner has accepted this whole-console slice yet.
