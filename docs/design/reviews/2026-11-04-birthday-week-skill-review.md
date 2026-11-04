# Birthday week and birthday card skill review (2026-11-04)

A pre-merge review of 生日周 / 生日卡 and the minimal 设置, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: #810 (typography tokens, `79d98dc`), which sits on `main`.

**Surfaces:** `/birthdays`; 今天 (opt-in reminder card); `/pandas/[slug]/share?birthday=N` (生日卡: 封面 A by default, 奖章 B and 海报 C via a segmented control; `&look=medal|poster` opens a style directly); 设置 (rewritten, minimal); new `/appearance`.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, clock pinned to 2026-08-20 (+09:00), profiles normal (390), dark, dt200 (font scale 2) and w320. `lint`, `typecheck`, `test` (34 files, 205 tests) and `design:tokens:check` pass. The a11y dump found no unnamed controls, no targets under 44pt and no horizontal overflow on any surface. Not seen on an iOS device. Linux has no SF Pro, so the screenshots use stand-in fonts; `sf-rounded-preview/` maps `ui-rounded` to SF Pro Rounded for a preview only.

Screenshots: `/workspace/feature-shots/birthday-week/{normal,dark,dt200,w320}/` and `sf-rounded-preview/` (local to the review box, not committed).

## impeccable

- One strong idea per card. A 回忆封面: the photo fills the card and the age is the hero (112pt `font-rounded` extrabold, tabular). B 奖章: an Activity-award ring around the photo with the age badge. C 园区海报: a park-poster countdown (还有 N 天) with the English ordinal tab, after the zoo countdown posts.
- Copy is minimal: 今天生日 / N 天后生日, the date, age, name (+ English name when it differs), birth line. No slogans.
- The photo credit is on every card (`照片 …`), so it travels with the shared image.
- Colours come from `primitive.palette` and the new `component.birthdayCard` tokens; no hex outside `tokens.ts`.
- 设置 drops from ten text-heavy rows to: account row, three 今天页 switches with one footer, 外观, 内容和照片来源, two legal rows, 退出登录.

## review-animations

- No new motion; the segmented control switches the card instantly and the page keeps the shared `PAGE_ENTER`, which follows Reduce Motion.

## break-ui

- **Fixed (dt200):** "8 岁生日" wrapped in the birthdays list next to the 44pt thumb. The detail is now just `N 岁` (the a11y label still says 生日).
- **Fixed (dt200):** the account row truncated the name to "竹…". At accessibility sizes the avatar now stacks above the name and email (`useStacked`), as the switch rows already do.
- **Cards at dt200 / w320:** the card is drawn on a 360×480 artboard and scaled to the width, so it never reflows; card text does not follow Dynamic Type because the card is an image. The whole card is one `role="img"` with a full label, so VoiceOver gets the content at any size.
- **Dates:** `nextBirthday` crosses New Year and maps 2-29 to 2-28 in common years (unit tests).
- `?birthday=` is validated (`^[1-9]\d?$`) and `look` falls back to 封面 for any unknown value.

## make-interfaces-feel-better

- Share actions are two full-width buttons: 分享图片 (primary) and 分享链接. The iOS share sheet already offers 存储图像, so there is no separate 存到相册.
- 外观 shows its current value in the row and opens a checkmark picker, like Settings' Display options; every mounted `useAppearance` stays in sync.
- The reminder stays **off by default**, on device only; the footer says so once.

## apple-design

- Account row at the top of 设置, like the Apple Account row; signed out it reads 登录 with one footnote.
- Grouped inset lists, glyph tiles, hairlines inset past the glyph, footers under groups (HIG lists and tables).
- The age uses SF Pro Rounded on iOS through the `font-rounded` token from #810.

## Deviations from the approved mockups

- Style switch is a native segmented control instead of thumbnails: smaller, labelled, and accessible.
- No 存到相册 or 复制链接: `expo-media-library` and `expo-clipboard` are not installed and AGENTS.md forbids new dependencies.
- Letter-spacing stays 0 (tracking deviation from the mockup) to match the #810 type scale.
- The separate 账号与数据 row is gone; the account row opens it. 恢复少显示 lives only on the 那年今天 page.
