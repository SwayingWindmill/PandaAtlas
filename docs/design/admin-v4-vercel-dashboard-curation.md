# Admin V4 — Curation workflow in a shadcn / Vercel Dashboard visual language (#493)

## Owner brief and scope

Owner's explicit final aim: **beautiful and practical, in shadcn/ui and Vercel Dashboard style**, with **no invented general UI components** where an appropriate maintained registry primitive exists. This phase deliberately covers one complete task path: **Curation queue → sourced fact review → independent approval confirmation**, including empty, error, read-only and full-detail variants. It does not claim to redesign all Admin routes or to finish issue #479.

## Source-first decision

- [shadcn dashboard-01](https://ui.shadcn.com/blocks?category=dashboard) validates the consistent sidebar, simple content columns, semantic DataTable, plain content regions and unified toolbar vocabulary. This is a compositional reference, not a package to install wholesale.
- [Vercel Geist Typography](https://vercel.com/geist/typography) informs restrained heading sizes, high-legibility monochrome labels and numerals. This change does **not** copy proprietary dashboard internals or assume the complete Vercel Geist component library is installed.
- Existing official shadcn **Resizable, Collapsible, ScrollArea, Badge, Button, NativeSelect, Textarea, AlertDialog, Empty and Skeleton**, plus shadcn Table/TanStack v8-backed DataTable, already satisfy actual interaction requirements. ReUI, Kibo UI and Dice UI would duplicate the existing server-controlled list and query state, or introduce needless library styles for the same task.
- No new custom visual component, wrapper, grid engine, animation or dependency. All relevant edits are domain composition and semantic Tailwind utility styling over mature components.

## What changed on screen

1. The paired queue/detail rounded **cards** became one flat, lightly bordered, resizable work surface. Queue uses a subtle neutral tint to separate selection from content, not a second floating card/shadow.
2. The right-hand evidence detail uses a white background, typographic hierarchy, border separators and one compact header, with approval actions in a quiet lower section. This removes nested cards while retaining review provenance and the independent approval boundary.
3. Both fact changes and owner-domain changes are line-separated **lists**, not cards within cards. Warning copy about absent current archive values is retained because it prevents a false interpretation of the change.
4. Queue row selection uses a neutral focus/selection treatment; selected state continues to expose `aria-pressed`, filter/page state remains URL-driven, and the existing keyboard-controlled divider is intact.
5. The layout was intentionally not replaced by a dashboard of fake metrics or decorative charts: the primary task is checking sourced changes and making an authorized decision.

## Verifiable outcomes

- Prior visual baseline: `.release-gate/admin-v4-483/curation-detail-1440.png` and `curation-confirm-1440.png`.
- Real 1440×900 Chromium screenshots using explicitly synthetic records: `.release-gate/admin-v4-493/curation-populated-1440.png`, `curation-confirm-1440.png`, `curation-readonly-1440.png`, `curation-empty-1440.png`, `curation-error-1440.png`. The screenshots are local release-gate artifacts, not commit contents. Baseline and current fixtures differ, so visual comparison is structural, not a pixel diff.
- Real pane geometry in populated case: left x=294 width=427.4px, right x=725.4 width=668.6px. No overlap, keyboard resizing remains covered by the permanent suite.
- Populated scenario and permanent read-only scenario use Axe WCAG A/AA checks. Read-only users can expand sourced facts but cannot validate or approve. Existing typed form and confirmation still prevent self-approval.
- Full Admin suite, TypeScript, ESLint and design checks must be run before the PR is marked ready; leave #479 open and Draft PR stacked on #492 until owner acceptance.

## Unresolved design debt

This change does not strip valuable table/fieldset/collapsible nesting merely to improve an AST metric. The Review, Moderation, Publication and Staff Role pages still have differing density and need a subsequent cross-route typography/spacing and empty/error pass; no unsupported data should be invented to emulate Vercel analytics screens. No mobile scope was added.
