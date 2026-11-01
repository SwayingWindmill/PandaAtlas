# Liquid Glass P1 skill review (2026-11-01, PR #769)

A pre-merge review of the Liquid Glass P1 fixes, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design, emil-design-eng). Base: `e2ce6f6e` (main, after #768). Fixes land in the same branch.

**Surfaces:** panda detail `/pandas/[slug]`, institution detail `/institutions/[slug]`, article `/learn/articles/[slug]`, 找熊猫 `/find`, every `Page` screen (bottom clearance), and the offline notice. Code changed in:
- `apps/mobile/src/components/hero-header.tsx` (new): `useHeroScroll` (scroll offset on the UI thread, React told only when the hero is crossed) and `HeroHeader` (transparent system bar with `Stack.Toolbar` where Liquid Glass is available; floating buttons elsewhere).
- `apps/mobile/src/components/stretchy-hero.tsx`: `HeroToolbar` and `goBack` removed.
- `apps/mobile/src/components/glass-button.tsx`: the `GlassView` branch removed; it is now only the fallback disc.
- `apps/mobile/src/app/pandas/[slug]/index.tsx`, `apps/mobile/src/app/institutions/[slug].tsx`: use `HeroHeader`.
- `apps/mobile/src/app/learn/articles/[slug].tsx`: no mid-scroll swap to a solid bar on iOS 26; per-frame JS `onScroll` removed.
- `apps/mobile/src/app/(tabs)/find/index.tsx`: the `FlatList` is the root scroll view.
- `apps/mobile/src/lib/bottom-clearance.ts` (new), `apps/mobile/src/components/page.tsx`: `pb-28` replaced.
- `apps/mobile/src/components/offline-banner.tsx`: moved above the tab bar.
- `apps/mobile/scripts/tab-icons.mjs`, `apps/mobile/assets/toolbar-icons/`: Lucide `share` and `chevron-left` as template PNGs.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, before (main) and after. Profiles: `base` 390×844 light and dark, `dt200` (200% text), `w320`. Pages: 今天, 找熊猫 (top and scrolled), 宝力, 史密森国家动物园, the 竹子 article (top and scrolled), 认识大熊猫, 设置. `lint`, `typecheck`, `test` (186) and `design:tokens:check` pass. The web export has no native bar, so the web pages are meant to look the same as before, and they do. The iOS 26 bar, the tab bar minimizing and the toolbar buttons were not seen on a device: no iOS simulator on the review box.

Screenshots: `/workspace/lg-shots/pr-a/` (local to the review box, not committed): `before/`, `normal/`, `dark/`, `dt200/`, `w320/`, named `<page>-<profile>-<scheme>[-s1].png` (`-s1` is after one scroll).

## impeccable

- Refinement, not redesign: the hero, the content column, all copy and every article and identification text are unchanged. What changed is who draws the chrome: the system bar instead of the app.
- **Fixed:** two buttons over the hero were the app's own glass discs drawn above a hidden system bar. On iOS 26 they now are the system's bar buttons, so they match every other screen's back button and the system's scroll-edge effect.
- The offline notice no longer sits where the title and back button are; it is a small capsule above the tab bar.

## review-animations

- No new animation. The bar title appears without a transition when the page title passes under the bar (UIKit sets the title text directly). Open: a fade, as App Store does, would need a custom title view; not worth it here.
- **Fixed:** the article read `contentOffset` in JS on every scroll event. All three pages now read it in a Reanimated scroll handler on the UI thread, and React re-renders only at the two crossings.
- The stretchy hero's parallax and Reduce Motion handling are untouched.

## break-ui

- **Long names:** a long panda or institution name in the bar is truncated by the system bar; the full name is the page's own title right under the hero.
- **No back stack:** a detail page opened from a link has no system back button, so `HeroHeader` adds a 返回 bar button that goes to 今天 (`router.canGoBack()`), as `HeroToolbar` did.
- **Loading and failed:** the loading skeleton and the failure card get the same bar (no title), so back works before the data arrives.
- **dt200 / w320:** the hero title and stats wrap as before; 找熊猫's chips and carousel are unchanged; the only x-scrollers are the existing carousels (same counts before and after).
- **Offline:** the notice does not take touches (`pointerEvents="none"`), so it never blocks a row under it.

## make-interfaces-feel-better

- Toolbar glyphs are Lucide `share` and `chevron-left` at 22pt, stroke 2, rendered as template images so the system tints them like any bar button, and match the tab glyphs' family.
- Hit areas: the bar buttons are system-sized (44pt); the fallback discs stay 44pt.
- Bottom air is one token (`spacing.page`, 40) on every platform, instead of `pb-28` stacked on top of the system's own tab-bar inset on iOS.

## apple-design

- **Fixed:** the system bar is transparent over the photo (`headerTransparent`), not hidden; on iOS 26 the system draws back and share in Liquid Glass and adds the scroll-edge effect once content passes under the bar.
- **Fixed:** the bar title follows the scroll: it appears only after the page's own title has gone under the bar, the way Music and App Store detail pages do.
- **Fixed:** 找熊猫's list is the screen's root scroll view, which is what lets iOS 26 minimize the tab bar on scroll and track the bar's edge effect.
- **Fixed (found in review):** a transparent bar before iOS 26 has no material, so a dark chevron would sit straight on the photo. The system bar is used only where `isLiquidGlassAvailable()`; earlier iOS keeps the floating discs, and the article keeps its paper bar after the title on earlier iOS.

## emil-design-eng

| Before | After | Why |
| --- | --- | --- |
| App-drawn glass discs over a hidden bar | System bar items (iOS 26) | One back button language across the app; the system handles glass, contrast and edge effects |
| Article swaps to a solid bar mid-scroll | Bar stays transparent; the system edge effect keeps the title legible | No flash of a different bar while reading |
| JS `setState` checked on every scroll event | UI-thread handler, React told at the crossing only | No JS work per frame while scrolling |
| `pb-28` (112pt) under every list | 40pt plus what the platform does not already add | The last row stops at a consistent distance above the tab bar |

## Open

- Verify on an iPhone with iOS 26 (Expo Go): detail bar buttons, title after the hero, 找熊猫 tab bar minimizing, article bar while reading, offline notice above the tab bar.
- Android: the bottom clearance assumes NativeTabs lays a tab's content out above its bar; not checked on a device.
- The offline notice uses a fixed tab-bar allowance (64pt) because the native tab bar's height cannot be read from the root layout.
- 今天's `pb-28` and large title change in the next PR (system large title).
