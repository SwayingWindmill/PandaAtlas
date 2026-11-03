# PR K2 skill review: 名字的显示层修正 (2026-10-31)

A short pre-merge review of PR K2, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `1d6f313` (main, after #761).

**Surfaces:** every screen that shows a panda name goes through `displayName` in `apps/mobile/src/lib/panda.ts`: 今天, 图鉴, 找熊猫, panda page, 时间线, 家族, 地图, 合集, 去过, 熊猫日历, 纠错, 设置, 我的. 每日一猫 uses the new `displayChineseName` for its answer list. Checked at runtime on 图鉴, 找熊猫, the panda page and 家族 for 幸浜 (`kouhin-shirahama`) and 娅光 (`ya-guang-chengdu-lineage`).
- Code: `apps/mobile/src/lib/panda.ts` (`displayChineseName`, `displayName`), `apps/mobile/src/features/daily-panda/daily-panda.ts`, tests in `apps/mobile/src/lib/panda.test.ts`.
- Data: none. The rules and the full list are in `docs/data/2026-10-31-name-cleanup-proposal.md`.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, signed in (aal2), 390×844 light. The mock's 图鉴 list was given four of the affected pandas (湖春, 娅光, 圆仔, 幸浜) so they show in one screen. Every one of the 925 public pandas was run through the old and new `displayName` to list what changes.

Screenshots: `/workspace/pr-k2-shots/before/normal/` and `/after/normal/` (local to the review box, not committed).

**Questions skipped:** none. The owner chose the rules: keep 浜, fix the display now, leave the data and releases alone, no names for pandas without a Chinese name.

## Result

| Category | Pandas | Before | After |
|---|---|---|---|
| A 罗马字 / 汉字 | 29 (4 in 台北) | `Kouhin / 幸浜`, `Yuan Zai / 圓仔` | `幸浜`, `圆仔` |
| A, digits | 1 | `九九 / 99` | `九九` |
| C cut at a bracket | 6 | `娅光 (Ya Ya` | `娅光` |
| B no Han in the zh name | 8 | `Happy` | `Happy` (now the English name; same text) |
| D no Chinese name | 33 | English | English |

36 pandas show a different name; nothing else changes.

## impeccable

- **Consistency (Nielsen 4):** a Chinese screen now shows Chinese names. The mixed `Kouhin / 幸浜` and the open bracket in `娅光 (Ya Ya` were the only titles in the app that broke the pattern.
- **Recognition (Nielsen 6):** the English name is not lost: search still matches every name value, and 每日一猫 keeps the English name as the alternate.
- **Native audit:** only title length changes. 幸浜的家族 and 娅光的家族 now fit on one line at 390pt; before, `娅光 (Ya Ya的家族` read as broken text.

## review-animations

No motion changed. Shorter titles do not change the stretchy hero or the collapsing bar.

## break-ui

- **Part 1, data:** names with no Han (B), digits (九九 / 99), traditional with a simplified alias (團團 → 团团), a Han part that is not an alias (湖春, kept as written), and clean names (阿杰, unchanged). All have tests with the real API names.
- **Part 2, never invent:** the output is always one of the panda's names or the Han part of one; a test checks this. When a traditional name has no unique same-length simplified alias, it stays as written.
- **Part 3, lookups:** `chineseName` still returns the raw value, so search terms, share text built from slugs and anything that needs the source name are unchanged.

## make-interfaces-feel-better

Titles are shorter and balanced: no stray bracket, no slash. The 图鉴 list now reads as one script per row, so the No. badges and dates line up visually with the names.

## apple-design

VoiceOver reads the name the screen shows, so it now says 幸浜 rather than "Kouhin slash 幸浜". Dynamic Type has less to wrap.

## Caveats

- 浜 is kept because the owner chose it; some readers on the mainland may expect 滨.
- Yuihin (`yuihin-shirahama`) shows 結浜, the Han part of its primary, though 结浜 is also one of its aliases. The rule only replaces a Han part that is not already an alias.
- 九九 / 99 was not in the first proposal (only Latin letters were searched); it follows rule A.
- The data still holds the mixed names. The curation fix waits for release approval.
