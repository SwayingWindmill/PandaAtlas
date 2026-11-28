# Find pandas

找熊猫 lists every published panda (default 2-column 4:5 portrait `画廊` cards for covered pandas with coverless rows below, switchable to `列表` via `radio "画廊模式"` / `radio "列表模式"`). A fan searches by name, place, pinyin initials (`ml` finds 萌兰, `hh` finds 和花), or normalized studbook (`#1237` / `1237`), with unified `匹配场馆` cards above `匹配大熊猫` when searching. Multi-dimensional chips narrow results (`在世` / `有照片` / `双胞胎` / `归国` combine via AND; `在中国` / `在海外` / regional areas combine via OR; `button "全部"` or `重置` clears filters). Idle browsing shows 最近看过, 最近搜索, and visual `FindTools` (`查关系` -> `/relationship`, `认脸图鉴` -> `/learn`). A search with no hit offers 大家常看.

## Sub-features

- `find-initials` matches pinyin initials by prefix from the Latin names ("He Hua" gives `hh`). Only a panda with no Latin name uses its slug; a one-word name such as "Qizai" gives none, so `qq` does not find 七仔. Name hits rank above initials hits.
- `find-studbook` parses `studbook_number` / `international_studbook_number` as `#<id>` and matches `#<id>` or `<id>`.
- `find-multi-filter` intersects attribute chips (`在世`, `有照片`, `双胞胎`, `归国`) with the union of selected location chips (`在中国`, `在海外`, domestic areas).
- `find-aggregate-venues` shows `heading /^匹配场馆/` (`link` → `/institutions/[slug]` with live status dot) above `匹配大熊猫` while searching.
- `find-gallery-toggle` switches `radio "画廊模式"` (default) and `radio "列表模式"` while preserving `button /^<panda.name>/`.
- `find-highlight` tints the matched characters of a name, studbook or place, or the whole name when only the initials or a Latin name matched. The browsing list has none.
- `find-recent-views` is a shelf of up to 10 covers, newest first, recorded when a panda's page opens.
- `find-recent-searches` is up to 8 chips, newest first, recorded when a result is opened from a non-empty search. Tapping one fills the search.
- `find-no-results` shows 没有找到「q」相关的大熊猫, a hint to try initials or reset filters, then 大家常看 (popular, else the well-known list).

## How to get to it (user POV)

- The 找熊猫 tab, or the route `/find`. Type into `textbox "搜索熊猫"` or select filter chips.

## Driving it with e2e

Covered by `tests/profile.e2e.ts` (area chips, `匹配场馆` aggregate search, `画廊模式` / `列表模式` toggle) and `tests/worst-case.e2e.ts`. Live look with the production preview (`node apps/mobile/scripts/preview-production.mjs`, then `http://localhost:8796`):

- Preconditions: the browser is at 390 wide.
- **Initials & studbook.** Open `/find`, tap `textbox "搜索熊猫"`, type `ml` (萌兰) or `#1237`.
- **View toggle & venue hits.** Search a venue/run term: `heading /^匹配场馆/` renders above `匹配大熊猫`; `radio "列表模式"` and `radio "画廊模式"` keep `button /^<panda.name>/` clickable.
- **Recent blocks.** Open one result, then `/find` again. `最近看过` shows the cover and `最近搜索` shows the query. `button "清空最近看过"` and `button "清空最近搜索"` empty each block and hide it.
- **No results.** Type `zzqx`. The page shows 没有找到「zzqx」相关的大熊猫 and the 大家常看 rows.
- **Device storage.** The web build keeps the lists in `localStorage` under `recentPandaViews` and `recentPandaSearches`.

## Gotchas

- Another session may hold ports 8796 and 8797. Run a temporary copy of the preview script on other ports; do not end the other process.
- iOS uses the system search bar, so a chip fills it through its ref `setText`. The web build does not exercise that path.
- Production's popular list is empty until a panda reaches the follow floor, so 大家常看 shows the well-known list.
