# 场馆动态 skill review (2026-11-04)

A pre-merge review of the 场馆动态 (venue news) feature, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `main` (`46189c49`).

**Surfaces:** new `/venue-news`; a 场馆动态 section on `/institutions/[slug]`; a 场馆动态 entry row on `/institutions`.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, profiles `normal`, `dark`, `dt200`, `w320`. Empty state shot with the real (empty) catalog; filled layout shot with a local, uncommitted fixture of four 【版式样例】 rows pointing at example.org. `lint`, `typecheck`, `test` (200), `design:tokens:check`, API eslint and vitest (8 new) pass. Not seen on an iOS device.

Screenshots: `/workspace/feature-shots/venue-news/{normal,dark,dt200,w320}/` (local to the review box, not committed).

## impeccable

- One row per notice: the official headline verbatim, then publisher · date and host · 更新于 date. No summaries, no kind icons, no editorial copy.
- Page label is one line (机构名 or 官方公告); empty state is just 暂无动态.

## review-animations

- No custom animation; the page uses the shared `PAGE_ENTER`, which honours Reduce Motion.

## break-ui

- **dt200:** headline wraps without truncation in the stacked layout; detail lines wrap. The shared `ListCell` label column is narrow at dt200 (pre-existing, also in #804).
- **w320:** no horizontal overflow; first detail line no longer breaks mid-date (detail split into two lines).
- **Empty / failed / loading:** section hidden when empty on the institution page; list page shows 暂无动态, LoadFailed and a skeleton.

## make-interfaces-feel-better

- **Fixed:** the detail used to wrap as `10月29\n日更新`; it is now two deliberate lines.
- Year is shown only when it is not the current year. Updated-at shown in China time.

## apple-design

- Reference: Apple Developer News and the Apple News list: grouped inset list, headline first, quiet footnote metadata, tap opens the source.
- Rows open the official page; accessibility hint 打开 <host> 的原文. Typography is token variants only (`Text variant`), so a later font change applies cleanly.
