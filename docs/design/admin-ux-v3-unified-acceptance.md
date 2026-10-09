# PandaAtlas Admin — Unified UX V3 visual acceptance baseline

## Why this exists

The operator rejected the previous Draft slices on 2026-10-09: local copy, badges, and card refinements did not make the Admin pleasant or convincingly Kiranism-like. Passing Playwright and CI was incorrectly treated as a proxy for user-friendliness. The previous feature PRs remain independent and **not product-accepted**.

This branch is an **integrated desktop preview**, not a release proposal. It combines #443 (shell/overview), #448 (review/moderation), #449 (curation/publication), #451 (IAM policy/recovery), #452 (audit), and #453 (staff). Integration reconciles publication action confirmation with reauthentication recovery, and appeal read authorization with account-scoped selection. No branch is merged to `main` by building this preview.

## Visual authority

- Reference implementation: [Kiranism Next.js shadcn dashboard starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) and its [live demo](https://shadcn-dashboard.kiranism.dev/). Prefer its mature sidebar, page-container, toolbar, TanStack/nuqs data-table, form and detail patterns over decorative cards or new primitives.
- Constraints: PandaAtlas's Chinese operational terminology, actual NestJS/V2 contracts, Supabase IAM, existing Next/Vite stack, and understated green brand. **Do not import Clerk, sample data, fake KPIs, demo graphs or cosmetic controls.** Use shadcn CLI only when a missing interaction genuinely requires another component; registry libraries (ReUI / Kibo UI / Dice UI) are candidates, not design goals.
- Impeccable 4.5.1 mode: **Operate** — task completion, predictable density and hierarchy over visual novelty. Code and actual rendered screenshots are the incumbent evidence; current color and layout are not automatically product-approved.

## Concrete before/after: `/admin`

The old overview used two tall KPI-shaped cards with separate call-to-action footers and another large card containing workspace cards. The first 1440px screenshot was captured to `.release-gate/admin-ux-unified-v3/overview-1440.png` (synthetic Playwright fixtures).

V3's first correction uses a compact action list for **new/unassigned Review cases** and **validated Curation changes**, with real typed API totals and direct context-preserving links. When authorized, its adjacent latest-action area reads the actual audit endpoint and translates recognized event codes to plain language, without inventing actors. Other destinations are compact navigation rows. Removed the fake “workplace green health dot” and the account UUID in the global header/sidebar. Refined screenshot: `.release-gate/admin-ux-unified-v3/overview-v3-1440.png` (same 1440px fixture, local ignored artifact). These two files are review evidence, not production data.

The screenshot is a **bounded improvement**, not a claim that all pages have passed visual review. It confirms less card duplication and less vertical scanning on the overview, not comprehensive visual parity with the reference.

## Cross-screen acceptance contract — still open

| Surface | Operator's primary job | Required design proof before acceptance |
| --- | --- | --- |
| Global shell | Find where a job lives | Stable Kiranism-like sidebar and page toolbar, no raw account IDs or fictitious health indicators, readable active state, no redundant navigation |
| Workbench | Find next work | Actual pending cases and change sets, direct actions, meaningful empty/unavailable/loading states |
| Review / Moderation | Decide with evidence | Filterable queue, case title/context rather than UUID, sources, owner and safe next action visible without searching, role-scoped sanctions |
| Curation | Verify and independently approve | Human-readable facts and credible provenance, honest absent current values, clear separation between validation and independent approval |
| Publication | Check, stage, then activate | Current version, candidate diff, blockers and impact in one scan; safe confirmation for release/rollback; recovery for genuine step-up errors |
| Audit | Trace what happened | Action, object, time and actor only when actually available; technical IDs/digest secondary |
| Staff / Roles | Find a person and grant the correct job | Search/list-detail hierarchy, understandable capability labels, one clear safe action; read-only and manager views both usable |
| Capabilities / MFA | Understand and improve own access | Clear what can be done vs requires step-up, OTP enrollment/challenge/status/recovery without exposing secrets beyond setup |

Each candidate must include a real 1440px screenshot, an operator-path browser walkthrough with fixture data, keyboard and axe checks, factual empty/error states and manual comparison to the Kiranism reference. Code review, TypeScript and browser checks are **necessary but not sufficient**. The operator's negative screenshot feedback outweighs a former green screenshot audit.

## Technical validation, not design sign-off

The integrated branch passes the Web typecheck, targeted ESLint, Impeccable CLI detector, and 41/41 local Admin browser tests (including combined activation confirmation/recent-auth error, as well as appeal read-only permission). This is the minimum baseline to safely continue the design work. The combined backend migration must still be reviewed and promoted separately before any deployment.
