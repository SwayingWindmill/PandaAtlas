# Admin UX/UI V2: Curation and Publication (#446)

This is a standalone UX slice based on `main`, intentionally not stacked on the unmerged #443 or #448. It changes only the existing operator screens and their established browser-test seam, with no API, permissions, IAM or domain-contract change.

## Curation: understand evidence before acting

- A change set presents its human-readable reason, target panda reference, origin, status and proposed facts ahead of internal account/case IDs; full identifiers remain available through a native disclosure.
- Known fields and values use accurate labels (`profile.sex = female` becomes `性别：雌性`). Unrecognized fields remain explicitly labeled as raw fields instead of receiving invented translations.
- The V2 detail endpoint provides the proposed value and source IDs but **not** the currently authoritative archive value. The screen explicitly warns that it cannot establish replacement/old-versus-new semantics. Source IDs are traceable in disclosures; they are not treated as verified source titles or clickable source URLs.
- Four-eyes remains server-enforced; the creator cannot approve their own change. Independent approval is explained and gated by an opaque, keyboard-accessible, CLI-installed shadcn Alert Dialog. Cancel does not send the approval API request. Approval still applies to the internal archive, not to the public release.

## Publication: current state, candidates, consequences

- The actual current public release returned by V2 appears before candidates and any mutating controls. Its published/suspended state is visible; if V2 doesn't provide a current release, the page does not manufacture one.
- Version selection shows actual V2 resource counts, differences, blockers and lifecycle history. Counts were made compact rather than presented as seven oversized dashboard cards. Technical release IDs are secondary to version names.
- Building is a rare secondary workflow behind a native disclosure. It creates a candidate and never implies automatic publication.
- Every available lifecycle command (seal/activate/rollback/suspend/restore) requires a meaningful reason and opens an opaque shadcn Alert Dialog containing the exact target version, current public version and reason. The API mutation is sent only after confirmation. Dangerous operations use a red confirmation treatment. No new generic operation runner or authorization logic was introduced.

## Design and validation boundary

- Existing Next/vinext, Tailwind, TanStack Table/Query and `nuqs` are retained. Card, Badge and Alert Dialog were installed via shadcn CLI, adapting the generated Radix imports to the project's existing `@radix-ui/react-slot` and scoped alert-dialog package rather than retaining the full Radix aggregate. Additional registries (ReUI / Kibo UI / Dice UI) were not required for these tasks; more controls would add setup and cognitive load without solving the known problems.
- Real 1440px Edge/Chrome-style Playwright captures are ignored local artifacts at `.release-gate/admin-ux-446/curation-after-1440.jpg`, `curation-confirm-1440.jpg`, `publication-after-1440.jpg` and `publication-confirm-1440.jpg`. They use browser fixtures, not production content, and perform no real approval/publication.
- Existing Curation / Publication browser seams cover reason, proposed-field rendering, source disclosure, self-approval prevention, cancel/confirm semantics, activation refresh, permission scope and URL filtering; the Curation confirmation is also axe-tested.
- The branch intentionally inherits `main`'s dark sidebar. The shared light Kiranism shell remains under Draft #443; do not mistake visual comparison of this independent PR for whole-Admin design sign-off. Remaining full cross-page visual acceptance is owned by #444.
