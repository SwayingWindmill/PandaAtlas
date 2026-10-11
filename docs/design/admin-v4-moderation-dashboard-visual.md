# Admin V4 — Moderation and appeals workbench (#497)

## Purpose and source-first fit

Owner-approved design direction for Admin V4: **beautiful and practical, shadcn/ui plus the restrained Vercel Dashboard visual language**, without authoring new generic UI primitives. The primary Moderation task is to inspect an appeal alongside the correct account's current restriction history, take an authorized action, and explain it. This pass builds on the single-workbench Review/Curation precedent from #495/#493.

The existing official shadcn Resizable, DataTable (TanStack v8), Collapsible, ScrollArea, NativeSelect, Button, Input, Textarea, Badge, Skeleton, Empty and AlertDialog are a closer fit than installing more packages from ReUI/Kibo UI/Dice UI. Vercel Geist typography and shadcn dashboard blocks inform modest heading hierarchy, white detail surfaces, quiet state and divider treatment. Extra grids, nested cards and free-floating dialogs would add presentation code without improving the task. No new bespoke UI component or dependency is introduced.

## Actual changes

- Queue, account summary, sanctions, appeal and actions now share **one** resizable outer surface, not a stack of rounded, bordered shadow cards. A softly tinted queue distinguishes navigation from white case detail; ordinary border separators mark meaningful changes in task context.
- The optional account-ID lookup is an inline disclosure, no separate floating card. Title, status filtering, row highlighting and button density match the preceding Curation and Review workbenches.
- Restriction history uses border-divided rows, not mini-cards. The four actual service-backed restriction flags retain their meaningful states. The user's statement remains readable as a simple quotation, not another inset card. Account/sanction/appeal identity and dates are preserved.
- Sanction application, restoration and appeal decision remain **separate privileged forms** within one continuous document, separated by subdued surfaces, rather than disguised as identical independent top-level pages. Existing anchor links, typed payloads, and confirmation snapshot remain; the high-risk red AlertDialog stays visually distinct.
- Changing appeal status or page clears the previous selected appeal, account, operation drafts, pending confirmation and success message before loading the new filtered queue. This prevents an unrelated sanction draft appearing under a different queue context. A permanent browser regression covers switching from `open` to `under_review`.
- Read-only appeal capability no longer leaves a disabled account detail query showing an indefinite loading skeleton; a short permissions message appears and the allowed appeal statement remains readable. Error queues with no selected account now explain the recovery path on the right instead of showing an unrelated generic empty state.

The structural audit has **12 maximum JSX levels both before and after**, and **172 elements after versus 174 before**. No attempt to extract one-use components just to game depth. The deeper interactive markup is intentional shadcn/semantic form and confirmation composition.

## Visual and behavior verification

Baseline: `.release-gate/admin-v4-487/moderation-populated-1440.png` and related local captures.

Updated screenshots at 1440×900 with explicitly **synthetic** case/account data are in ignored local `.release-gate/admin-v4-497/`:

- `moderation-populated-1440.png`: 18 cases, restriction flags, sanction history, current appeal, continuous right-hand hierarchy
- `moderation-confirm-1440.png`: snapshot of sensitive account sanction and official AlertDialog
- `moderation-readonly-1440.png`: appeal-only permission, no privileged action or frozen skeleton
- `moderation-empty-1440.png` and `moderation-error-1440.png`: no fake records, explicit retry

The five scenarios were captured in Chromium and manually visually inspected. Populated scenario passed axe WCAG 2/2.1 A/AA in the isolated screenshot test. Measured queue x=294 width=416.5px, account region x=714.5 width=679.5px, no overlap. Old and new synthetic fixtures differ; this is a structural visual review, not a pixel-diff test. The temporary capture test was removed after screenshots.

Existing Admin Playwright tests cover lifecycle actions, account switch draft clearing, role-based restrictions, API failure recovery, dangerous action confirmation and the shared shell. The new filter regression protects queue context; the appeal read-only and error semantics have explicit permanent assertions. No backend, Supabase, authorization contract or migration changes. Keep as Draft stacked on #496 pending owner desktop visual approval; #479 remains open.
