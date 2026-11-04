# Typography ① 系统精调 skill review (2026-11-04)

A pre-merge review of the type change approved for PR #804's redesign (方案① 系统精调): system faces only, SF Pro Rounded for figures. Run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `main` (46189c49).

**What changed:** `primitive.fontFamily.rounded` (iOS `ui-rounded`, Android `sans-serif`, web `ui-rounded, -apple-system, … sans-serif`) generated into `global.css` as `--font-rounded` with `@variant ios` / `@variant android` overrides; weight `heavy` (800); text styles `stat` (22/28) and `figure` (34/41), both rounded; `font-rounded` on day marks (打卡, 熊猫日历), milestone chips, map cluster counts, 到访 day numbers and week-card counts. DESIGN.md: UI font, Figures, The Rounded Figure Rule, v2.13.

**How it was checked:** `lint`, `typecheck`, `test` (197) and `design:tokens:check` pass. An iOS export (`expo export --platform ios`) bundles the `__uniwind-platform-ios` override. Expo web dev build against the local proxy, Playwright + Chrome, profiles normal, dark, dt200, w320, on 设计系统, 今天, 图鉴, 熊猫日历, 里程碑 and a panda page. Linux Chrome has no `ui-rounded` and no PingFang, so the plain shots show the fallback face; a second set aliases `ui-rounded` to the SF Pro Rounded files on the review box to preview the iOS look. Not seen on an iOS device.

Screenshots: `/workspace/feature-shots/typography/` (local to the review box, not committed; Apple font files are not redistributed).

## impeccable

- One family switch, no bundled font, no new dependency. The rounded face is used only where a number is the point; meta lines with dates stay in the text face, so the screen does not turn soft.
- Weight steps are unchanged (400/600/700); 800 exists only for a card's hero number.

## review-animations

- No motion change. Tabular figures keep counts from shifting when they update.

## break-ui

- **Fallback:** Android and non-Apple browsers fall back to the text face; the stack ends in `system-ui, sans-serif`, so nothing renders in a serif or a missing glyph.
- **Chinese in a rounded run:** 岁 / 天 / 只 fall back to PingFang (Noto Sans CJK on the box); line heights are unchanged, so nothing clips at dt200.
- **dt200, w320, dark:** no overflow and no new small targets. The 熊猫日历 day cells report 20–38pt width at dt200/w320; that is the existing 7-column grid (48pt tall), not this change.

## make-interfaces-feel-better

- Tabular figures stay on every rounded figure (`stat`, `figure` and the `font-rounded tabular-nums` spots).
- Tracking stays 0 by design: SF applies optical tracking per size, and CJK is never letter-spaced. The proposal's "+0.4 on display" is not applied for that reason.
- Follow-up, not in this PR: `-webkit-font-smoothing: antialiased` on the web root.

## apple-design

- Rounded figures next to SF Pro text is a system pattern (SF Pro Rounded is the system font's rounded design, reached through `ui-rounded`), not a brand font.
- PingFang SC stops at Semibold, so Bold Chinese draws at 600 on iOS; DESIGN.md says so instead of asking for weights the face does not have.

## References

- React Native `fontFamily` system families: https://reactnative.dev/docs/text-style-props, https://github.com/facebook/react-native/pull/47544
- WWDC22, the San Francisco family: https://developer.apple.com/videos/play/wwdc2022/110381/
- System font deep dive (stacks, licensing): https://fullystacked.net/system-font-deep-dive/
- Uniwind platform theme variables: https://docs.uniwind.dev/api/platform-select
