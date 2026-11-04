# 归国熊猫 / 海外大熊猫状态 — five-skill review (2026-11-04)

Screens: `/returning` (filled, empty), entry row on `/institutions`. Shots: normal, dark, Dynamic Type 200%, 320 pt.

| Skill | Findings | Action |
| --- | --- | --- |
| impeccable | One job per screen: where each panda is and when it comes home. No prose; every row is facts plus its source host and 更新于. Expected return keeps the announcement's precision (年 / 年月 / 年月日), never invented. | Kept. Empty state is a single line "暂无记录". |
| review-animations | Only `PAGE_ENTER` on load, same as other list pages; no per-row motion. Reduced Motion inherits the shared preset. | No change. |
| break-ui | 320 pt: detail line 1 wrapped and was clipped by ListCell's 2-line detail cap. 200%: three summary tiles wrapped labels into 2–3 lines. Long names/places, unknown slugs (fallback to slug), missing expectedReturn, empty list all checked. | Added `detailLines` to ListCell (default 2, unchanged elsewhere); page uses 4. Tiles stack with `useStacked()`. |
| make-interfaces-feel-better | Panda row is the whole tap target (opens panda). Sources are their own 来源 section so opening an announcement is explicit, not a hidden gesture. Tabular `stat` numerals. | Removed an earlier long-press-to-source idea. |
| apple-design | Large title + one-line subtitle, grouped inset sections ordered nearest-to-home first, Fitness-style summary tiles, Lucide `Plane` on the single category row only. Dark mode uses card/secondary tokens. | Kept. |

Accessibility: each row reads "名字，阶段，地点 · 时间，来源 · 更新于"; source rows have role link + "打开原文" hint; tiles read "label value".

References: Apple Fitness summary tiles; Apple Health "Medications" grouped by state; Flighty status grouping (en route / landed).
