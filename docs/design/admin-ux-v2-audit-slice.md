# Admin UX/UI V2 — Audit evidence slice (#447)

This is the independently reviewable Audit portion of #447. The remaining Staff, Role Management, Capabilities and MFA surfaces stay in scope of the issue. This branch is based directly on `main` and is deliberately separate from Draft #443/#448/#449/#451.

## Task and design decisions

Audience: authorized internal PandaAtlas staff checking *what action occurred, which kind of object it affected and when*. This is an Impeccable **Operate** screen, not a marketing dashboard. It preserves the incumbent Admin visual system; sitewide Kiranism shell acceptance remains in #443/#444.

- Default scan order is occurrence time, a domain-safe event label, target object type and business domain. All values originate from the typed audit API. No artificial KPI, placeholder actor or inferred identity.
- Explicit mappings cover the actual routed V2 integration audit vocabulary currently known in the codebase (`publication.release.activated`, `publication.release.rolled_back`, `review.incorporation-recommended`). Unknown events display as unclassified rather than fabricated descriptions; exact codes remain under `技术追溯信息`.
- Inspection repeats only decision-relevant fields (event, object kind, actual occurrence time). Full event, aggregate and correlation IDs, source type, record time and SHA-256 remain available in a native keyboard-accessible disclosure. SHA-256 is labeled as a digest, **not** proof verified by the screen.
- The V2 AuditEvidenceDto has no actor field. The detail explicitly states that actor information is unavailable from this endpoint, rather than making it up or repurposing a correlation ID.
- Existing deep links are limited to well-known, supported public release and review objects. No new routes or permission changes. Limit parameter remains URL-bound to 25/50/100/200.
- No new UI library is needed: existing TanStack DataTable and shadcn Button plus native details/summary suffice. An attempted shadcn CLI badge installation stalled, so no dependency or unverified vendor source was added just for decoration.

## Verification

The first bounded pass used a 1440×900 desktop Playwright fixture with the actual Admin shell, collecting `E:\Code\PandaAtlas\.release-gate\admin-ux-447\audit-list-1440.jpg` and `audit-details-1440.jpg` (ignored local files, synthetic content only). Both were visually inspected: event identity leads, all technical data remains accessible, no clipping or nested-card pattern. Existing keyboard and axe assertions remain in `audit-evidence-collection.spec.ts`. The Impeccable v4.5.1 CLI detector returned no findings in `features/admin/audit` for this slice. See CI and PR for final verification status.
