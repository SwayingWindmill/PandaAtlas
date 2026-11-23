# Find pandas

找熊猫 lists every published panda. A fan finds one by name, place or pinyin initials (`ml` finds 萌兰, `hh` finds 和花). Browsing shows 最近看过 and 最近搜索 under the area chips, kept on the device. Matched characters are tinted in results. A search with no hit offers 大家常看. The first-run welcome offers well-known pandas first.

## Sub-features

- `find-initials` matches pinyin initials by prefix from the Latin names ("He Hua" gives `hh`). Only a panda with no Latin name uses its slug; a one-word name such as "Qizai" gives none, so `qq` does not find 七仔. Name hits rank above initials hits.
- `find-highlight` tints the matched characters of a name or place, or the whole name when only the initials or a Latin name matched. The browsing list has none.
- `find-recent-views` is a shelf of up to 10 covers, newest first, recorded when a panda's page opens.
- `find-recent-searches` is up to 8 chips, newest first, recorded when a result is opened from a non-empty search. Tapping one fills the search.
- `find-no-results` shows 没有找到「q」, a hint to try initials (with an area chip active: 「试试选「全部」，或换一个地区。」), then 大家常看 (popular, else the well-known list).
- `welcome-suggestions` is the first tiles of `/welcome`: popular pandas, then the well-known list, then the youngest living.

## How to get to it (user POV)

- The 找熊猫 tab, or the route `/find`. Type into the search field.
- The route `/welcome` on a fresh install.

## Driving it with e2e

No journey covers it yet. Live look with the production preview (`node apps/mobile/scripts/preview-production.mjs`, then `http://localhost:8796`):

- Preconditions: the browser is at 390 wide, and `/welcome` has been left with 先逛逛, or `/find` redirects there.
- **Initials.** Open `/find`, tap `textbox "搜索熊猫"`, type `ml`. 萌兰 is in the list with its whole name tinted. Type `hh`: 和花 is in the list.
- **Recent blocks.** Open one result, then `/find` again. `最近看过` shows the cover and `最近搜索` shows the query. `button "清空最近看过"` and `button "清空最近搜索"` empty each block and hide it.
- **No results.** Type `zzqx`. The page shows 没有找到「zzqx」 and the 大家常看 rows.
- **Device storage.** The web build keeps the lists in `localStorage` under `recentPandaViews` and `recentPandaSearches`.

## Gotchas

- Another session may hold ports 8796 and 8797. Run a temporary copy of the preview script on other ports; do not end the other process.
- iOS uses the system search bar, so a chip fills it through its ref `setText`. The web build does not exercise that path.
- Production's popular list is empty until a panda reaches the follow floor, so 大家常看 shows the well-known list.
