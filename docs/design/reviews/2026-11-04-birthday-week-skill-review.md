# Birthday week and birthday card skill review (2026-11-04)

A pre-merge review of the 生日周 / 生日卡 feature, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `main` (46189c49).

**Surfaces:** new `/birthdays`; 今天 (opt-in reminder card, 生日周 link on the birthdays card); 设置 (生日周提醒 switch); `/pandas/[slug]/share?birthday=N` (生日卡 variant).

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, clock pinned to 2026-08-20 (+09:00), profiles normal, dark, dt200, w320. `lint`, `typecheck`, `test` (203) and `design:tokens:check` pass. The a11y dump found no unnamed controls, no targets under 44pt and no horizontal overflow. Not seen on an iOS device.

Screenshots: `/workspace/feature-shots/birthday-week/` (local to the review box, not committed).

## impeccable

- Reuses grouped lists, `PandaThumb` and the existing share card; the only new mark is the tinted Lucide `Cake` glyph on the card headline.
- No editorial copy: rows show name, age and date only. Official birthday events come from `features/birthdays/events.ts`, a curated list that is empty in this PR; each entry must carry an official `url`, `source`, `date` and `checkedOn`, and only `https` links render.

## review-animations

- Only the shared `PAGE_ENTER`; it follows Reduce Motion. No new motion.

## break-ui

- **Fixed:** each panda had a second 做生日卡 row, which doubled the list. The row now opens the 生日卡 directly (hint 打开它的生日卡), and the card has 看资料 to reach the profile.
- **Fixed:** a trailing 生日卡 meta squeezed the label column to 2 characters at dt200; removed.
- **dt200:** the detail line still wraps inside `ListCell`'s label column next to a 44pt thumb. This is the shared cell's layout and is left for a separate change.
- **w320, dark:** no overflow; the dates cross New Year and 2-29 falls back to 2-28 (unit tests).
- **Empty / loading / failed:** each has its own state; the failed state offers 重试.

## make-interfaces-feel-better

- The `?birthday=` param is validated (`^[1-9]\d?$`); anything else gives the normal share card.
- The reminder is **off by default**, stays on the device, and the footer says it does not push.

## apple-design

- Day sections read `今天 · 8月20日 周四`, like Calendar's list; the card's a11y label is "X N 岁生日卡".
