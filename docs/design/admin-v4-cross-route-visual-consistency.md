# Admin V4 — cross-route consistency, dashboard and audit (#501)

## Goal and governing direction

Owner's goal is a **beautiful, practical, shadcn/ui + Vercel Dashboard-inspired desktop Admin**. Prior slices refined Curation (#493), Review (#495), Moderation (#497), Staff (#499), and Publication (#491) separately. An actual 1440px cross-screen review found two remaining outliers: the Admin homepage used larger, more colorful ornamental metric cards and the Audit page still used two floating shadow cards rather than the same resizable master/detail treatment as the other workflows.

## Source-first decisions

Official shadcn Card, CardHeader, CardContent, CardDescription, Badge, Button, Separator, Table/DataTable, Resizable, Collapsible, Empty, Skeleton, and NativeSelect already satisfy the whole interaction. The [shadcn dashboard examples](https://ui.shadcn.com/blocks?category=dashboard) and [Vercel Geist typography guidance](https://vercel.com/geist/typography) are visual references, not a requirement to clone proprietary Vercel internals or install a second component system. ReUI/Dice UI/Kibo UI alternatives would add another table/resizer state model without reducing UI semantics. **No new UI component, CSS toolkit, dependency or backend endpoint** was written.

## Actual visible changes

1. **Overview** now uses the same 24px-level page title, horizontal header divider, compact neutral task cards and restrained action typography as the rest of Admin. Its numeric counters remain genuine server-backed totals, and retain meaningful loading/failure/no-permission states. No fabricated metrics or decorative diagrams were added.
2. The home page removes the uppercase micro-brand stripe and multicolor icon tiles that were visually louder than the task content. Task cards, recent-activity list and authorized destination list now share the same card radius, border and density. Links remain actual keyboard-focusable Next links with their original destinations.
3. **Audit** now uses one bordered, resizable queue/detail workbench with a lightly shaded list and white detail, consistent with the Review, Curation, Moderation and Staff surfaces. Selected audit rows use neutral contrast and preserve accessible pressed state; technical source fields remain intact.
4. Event context, time, technical provenance and the real publication/Review destinations are unchanged. The source trace is still a shadcn disclosure; it is no longer hidden inside another floating bordered card.
5. Changing the URL-backed audit limit clears an out-of-range selected event instead of leaving a stale selection in a reloaded collection. A missing/failed collection explains the left-hand retry workflow in the right-hand empty state rather than presenting a misleading ordinary empty panel. Permanent browser assertions cover both.
6. Existing permission-based sidebar groups (Overview, Operations, Governance) remain, as do staff-role and account-only routes. This slice does not conflate public publishing with content review or elevate governance above the actual operator work.

## Real browser review

Baseline screenshots: `.release-gate/admin-v4-479/overview-1440.png`, `.release-gate/admin-v4-485/audit-detail-1440.png`. Updated Chromium 1440x900 **synthetic fixture** captures, visually inspected and locally retained under ignored `.release-gate/admin-v4-501/`:

- `overview-populated-1440.png`: queue totals and linked current audit activity
- `audit-populated-1440.png`: long evidence queue and selected event
- `audit-expanded-1440.png`: full technical source fields and linked public release
- `audit-empty-1440.png`: factual empty collection state
- `audit-error-1440.png`: retry path and right-hand recovery explanation

The isolated screenshot test passed automated Axe WCAG 2/2.1 A/AA for both populated Overview and populated Audit; the screenshot-only test was deleted after capture. Audit pane measurements: left x=294, width=416.5px, right x=714.5, width=679.5px, no horizontal overlap. Previous screenshots used different synthetic content, so visual comparison is of spacing, typography, section geometry and severity, **not** a pixel regression claim.

## Regression contract and outstanding review

The permanent Admin Playwright test for Audit now explicitly checks both limit-change selected-detail reset and a failed list's right-side explanatory state. Existing tests enforce real queue totals, filtered task destinations, no invented values when APIs fail, and permission-scoped navigation.

Validation for this slice: **full Admin Playwright 58/58 passed**, Web TypeScript passed, scoped ESLint passed, frontend design policy and representative public-copy check passed, Impeccable detect completed without findings, and Git diff check passed. The actual browser screenshot fixture completed 1/1 with axe checks, then was removed. AST audit of all 16 Admin TSX modules still reports **zero directly authored native input/select/textarea/button/details controls**; component depth is not used as a proxy for visual quality.

### Stacked PR chain

Issue #479 remains open. GitHub confirms the stacked Admin UI chain currently starts at **Draft PR #454**, with its base set to `main`, and runs through every even-numbered Draft PR up to **#500**: **24 sequential Draft PRs**. The immediate design-series segment is `#488 → #490 → #492 → #494 → #496 → #498 → #500 → next PR for #501`. Every upstream base points to the preceding PR head, but that is a **topology check**, not a promise that the chain has been integrated into main. Individually mergeable PRs and passing changed-scope checks do **not** imply deployment or owner visual signoff; the newest cloud-artifact job was still pending when initially inspected. Do not squash/retarget an arbitrary middle PR to main and lose upstream context. A deliberate merge would start with #454, verify each transition's check runs and main divergence, and separately test privileged actions and owner approval before progressing up the chain.

The remaining work is final operator task-flow and screenshot signoff, browser error/read-only parity across all major routes, and a deliberate merge plan for the stacked branches. No deployment or main branch merge is part of this slice.
