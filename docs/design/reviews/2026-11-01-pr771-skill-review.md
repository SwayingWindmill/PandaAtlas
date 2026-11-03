# EAS development build and native bar symbols skill review (2026-11-01, PR #771)

A pre-merge review of PR #771, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design, emil-design-eng). Base: `feat/liquid-glass-p1-fixes` (#769).

**Surfaces:** the tab bar (今天, 找熊猫, 图鉴, 我的) and the detail toolbar (back, share) from `HeroHeader`. Code changed in:
- `apps/mobile/src/lib/native-symbols.ts` (new): `NATIVE_SYMBOLS` is true outside Expo Go and the web; `nanoSymbol(name)` gives the iOS asset (`nano.<name>`) and Android drawable (`nano_<name>`).
- `apps/mobile/src/app/(tabs)/_layout.tsx`: `TabIcon` picks `xcasset` + `drawable` in a native build, the template PNG in Expo Go.
- `apps/mobile/src/components/hero-header.tsx`: `Stack.Toolbar.Icon xcasset` inside the back and share buttons in a native build; the PNG `icon` in Expo Go.
- `apps/mobile/scripts/tab-icons.mjs`, `assets/symbols/*.svg`: the same Lucide glyphs as SVGs for `react-native-nano-icons`.
- `apps/mobile/app.json`, `eas.json`, `package.json`, `.gitignore`; `DESIGN.md`, `USER_ACTIONS_REQUIRED.md`.

**How it was checked:** `lint`, `typecheck`, `test` (186) and `design:tokens:check` pass. `expo prebuild --no-install --clean` in a throwaway copy produced six `.symbolset`s in `Images.xcassets` and six VectorDrawables; the generated symbol sheets were rendered and look like the Lucide glyphs at ultralight, regular and black. Expo web screenshots (`base` light and dark, `dt200`, `w320`) are unchanged, as intended: the web never uses native symbols. The symbols in the iOS bars were not seen on a device: no Mac or iOS simulator on the review box.

Screenshots: `/workspace/lg-shots/pr-c/` (local to the review box, not committed): `normal/`, `dark/`, `dt200/`, `w320/`, `montage.png`, `nano-symbols-generated.png`.

## impeccable

- Same glyphs, same stroke (1.9 tabs, 2 toolbar), same order and labels; only the delivery changes from bitmaps to vector symbols.
- One source: the PNGs and SVGs come from one script and one Lucide version, so Expo Go and a native build cannot drift apart.

## review-animations

- No animation added. Symbols take part in the tab bar's own selection and minimize transitions, which follow Reduce Motion.

## break-ui

- **Expo Go:** no native assets there, so `NATIVE_SYMBOLS` is false and the PNGs stay; an `xcasset` that does not exist would draw an empty tab.
- **Web:** `_layout.web.tsx` and the floating discs are untouched.
- **dt200:** custom symbols scale with the bar's text style; PNGs stayed at 25pt. Web at 200% is unchanged.
- **Android toolbar:** `HeroHeader` uses the system toolbar only on iOS 26+ (`SYSTEM_BAR`), so the toolbar's `xcasset` never reaches Android, which needs an image source there.

## make-interfaces-feel-better

- **Fixed:** vector symbols stay sharp at every scale and size class instead of a 25pt bitmap scaled by the bar.
- Template rendering is kept, so the bar still tints at rest and when selected, in light and dark.

## apple-design

- **Fixed:** the tab and toolbar glyphs are real (custom) SF Symbols, so they align to the bar's text baseline and follow its symbol weight and scale, as system symbols do.
- The EAS `development` profile builds on the Xcode 27.1 image (`sdk-58`), so a development build shows the iOS 26/27 Liquid Glass bars that Expo Go cannot carry these symbols in.

## emil-design-eng

| Before | After | Why |
| --- | --- | --- |
| Template PNGs at 25pt in every build | Custom SF Symbols / VectorDrawables in native builds, PNGs in Expo Go | Symbols scale and weigh like system glyphs |
| No `eas.json` | `development`, `development-simulator`, `preview`, `production` on `sdk-58` | A dev build is one command once the EAS project exists |
| No record of the account steps | Exact steps in `USER_ACTIONS_REQUIRED.md` | `eas init` needs the owner's Expo login |
