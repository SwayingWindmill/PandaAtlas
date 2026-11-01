# Large title and search bar skill review (2026-11-01, PR #770)

A pre-merge review of PR #770, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design, emil-design-eng). Base: `feat/liquid-glass-p1-fixes` (#769).

**Surfaces:** 今天 `/` and 找熊猫 `/find`. Code changed in:
- `apps/mobile/src/app/(tabs)/(today)/index.tsx`: the system bar is shown, so iOS draws 今天 as the large title; content insets `automatic`; the title stays in the column on web only; `pb-28` replaced with `useBottomClearance()`.
- `apps/mobile/src/app/(tabs)/find/index.tsx`: `Stack.SearchBar` on iOS; the in-page `SearchField` (and its skeleton) on Android and web only.
- `DESIGN.md`: tab root and 找熊猫 descriptions.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, before (#769) and after, profiles `base` light and dark, `dt200`, `w320`. `lint`, `typecheck`, `test` (186) and `design:tokens:check` pass. The web has no system bar, so both pages are meant to look as before on web, and they do. The iOS large title and search bar were not seen on a device: no iOS simulator on the review box.

Screenshots: `/workspace/lg-shots/pr-b/` (local to the review box, not committed): `before/`, `normal/`, `dark/`, `dt200/`, `w320/`, `montage.png`.

## impeccable

- Refinement, not redesign: same cards, same order, same copy. 今天 was the one tab root that drew its own title; it now matches 找熊猫, 图鉴 and 我的.
- The date stays the screen's one 笋金 mark, as the first line under the large title.

## review-animations

- No custom animation. The large title's collapse into the bar and the search bar's cancel transition are the system's, and follow Reduce Motion by themselves.

## break-ui

- **dt200:** the system large title and search bar scale with Dynamic Type; the date line wraps in the column. Web at 200% is unchanged.
- **w320:** chips and carousels unchanged; x-scroller counts are the same as before.
- **Loading / failed 找熊猫:** the search bar is mounted in both branches, so it does not jump in when the list arrives; the skeleton no longer draws a field that iOS does not have.
- **Cancel:** clears the query and returns to browsing.

## make-interfaces-feel-better

- **Fixed:** 今天 no longer hand-computes `insets.top + 12` with insets `never`; the system places the content under the bar, which also lets the bar's edge effect track the scroll.
- Bottom air is the shared `useBottomClearance()` (40pt above the tab bar), like every other `Page`.

## apple-design

- **Fixed:** 今天 uses the system large title, which collapses into the Liquid Glass bar on scroll, as Apple News Today does.
- **Fixed:** 找熊猫 searches from the system search bar under the large title, so the field, cancel button and keyboard behaviour are UIKit's. `placement="stacked"` keeps it under the title rather than in the bottom toolbar; this stays a normal tab (no `role="search"` tab), so the tab structure is unchanged.
- `hideWhenScrolling={false}`: search is this tab's main action, so the field stays reachable while browsing the list, as in Music's Search tab.

## emil-design-eng

| Before | After | Why |
| --- | --- | --- |
| 今天 drew its own 34pt title with the bar hidden | System large title | Collapses into the bar like every other tab root |
| `pb-28` plus the system tab-bar inset | `useBottomClearance()` | One consistent distance above the tab bar |
| App-drawn search field on iOS | `Stack.SearchBar` | System field, cancel and Liquid Glass material |
