# Screens: the v4 mockups

What each app screen holds, top to bottom, as approved in the v4 mockups (2026-11-04, palette C 熊猫). [DESIGN.md](../../DESIGN.md) is the visual system: tokens, components, glyphs and rules that hold on every screen. This file is the surface layer: which blocks a screen has, in what order, what data feeds each block, and when a block is hidden. When the two disagree on how something looks, DESIGN.md wins; when they disagree on what a screen contains, this file wins, and the conflict is listed under [Open decisions](#open-decisions).

The mockups are in [`mockups/v4/`](mockups/v4/), and [`00-overview.webp`](mockups/v4/00-overview.webp) shows them all on one sheet. Build a screen from its own image, then compare a real screenshot with the image side by side in light and dark mode before you open the PR.

## How to read a mockup

- **示例 means invented.** A block or number marked 示例 shows a layout, not data. It never ships with made-up values (The Sample Rule in DESIGN.md). When there is real data, the block shows it. When there is not, the block is hidden, or shows the screen's empty state if the block is the reason the screen exists.
- **A missing feature hides its block.** A block whose feature or page does not exist yet is left out. Do not put a placeholder, a disabled row or 即将上线 in its place. List what you left out in the PR's comparison.
- **Names, dates and photos in a mockup are examples.** Real screens read them from the API.

## Tab bar

There are five tabs: 今天, 发现, 找熊猫, 图鉴 and 我的. The bar is the system bar described in DESIGN.md › Navigation. The glyphs follow the mockups: calendar for 今天, compass for 发现, search, book for 图鉴, and the person for 我的. 发现 came after v4; its plan and canvas are the 发现页 design artifact (2026-11-10).

## 探索（原今天） — `/(tabs)/(today)` (v4.1 overhaul)

1. **Header.** Chinese date eyebrow (`M 月 D 日　周X`) over `探索` in `display`, paired on the right with a compact `熊猫日历` capsule (`Calendar` icon, opens `/calendar`, `accessibilityLabel="熊猫日历，查看日历"`). No duplicate `/me` avatar and no stacked standalone birthday banners.
2. **Hero.** Top `WeekHero` when a public anniversary/birthday falls within 7 days, paired with a sibling top-right `全部记忆` floating capsule (`bg-glass-fallback`, opens `/on-this-day`); otherwise `FeaturedPandaCard`.
3. **明星熊猫 / 你关注的 N 只.** Horizontal 56pt circular quick-jump strip (`StarOrFollowedStrip`), consolidated on the right with a single contextual birthday link (`近期 N 只过生日` → `/birthdays` when reminder is on and followed pandas have birthdays this week, else `本月 N 只过生日` → `/calendar` when > 0).
4. **此刻谁醒着.** Horizontal live venue clock cards (`LiveClockSection`) with right link `全部直播与作息` → `/live`. Each card embeds a compact `VenueActivityBar`, local clock + status dot, overlapping resident faces with single-line names, and a `看直播` capsule when available.
5. **每日一玩.** Side-by-side `每日一猫` (real daily status + 4 clue-progress dots → `/daily`) and `猜熊猫` (real recognized count + 2 tilted mini tiles → `/guess`), headed by `全部 4 项` (`accessibilityLabel="趣味挑战"`, opens `/play`).
6. **精选专题.** Filterable 2-column cover photo grid (`CuratedGallerySection`) with conditional `归国与专题` header action and non-dead-end topic shortcut cards (`双胞胎怎么分` → `/look-alikes`, `海外与归国` → `/returning`) shown only when backing data exists.
7. **听熊猫.** Compact interactive audio player (`SoundStripSection`) showing human scene labels (`高频轻鸣实录`, `竹竿啃食原声`, etc.) rather than license strings, linking to `/sounds`.
8. **认识大熊猫.** Apple News-style left-text / right-thumbnail (`44×44`) rows for the lead article and face guide (`LearningAndPlaySection`), linking to `/learn`.
9. **场馆动态 & 关注的最新动态.** `TodayVenueNews` and `FollowedChanges` render only when real notices or followed updates exist; zero cold-start placeholder boxes when signed out or empty.

Status: shipped in Batch 1 (v4.1).

## 此刻直播与作息 — `/live` (new in v4.1)

1. **Global Day/Night Pulse & Summary.** Top card (`buildLiveHallModel`, `buildRegionalPulses`) displaying real-time local clocks and daytime/nighttime state across `东亚`, `欧洲` and `北美`, above a 3-column summary (`正在活跃 N 馆 | 可看直播 N 馆 | 午休或闭园 N 馆`).
2. **Filter chips.** Single-select ink chips: `全部`, `有直播`, `正在活跃`, `海外`, showing live counts when > 0. Zero-resident no-cam venues are excluded automatically.
3. **日间开放与活跃.** Photo-anchored cards (`72×72` lead resident tile, status dot, local clock, resident list, full `VenueActivityBar`, `进馆看熊猫` link and `看直播` capsule).
4. **夜间休整.** Compact grouped rows (`40pt` round resident face, local clock, next opening time, optional `官方频道` link). Quiet timezone disclaimer at the foot.

Status: shipped in Batch 1 (v4.1).

## 找熊猫 — `02-find`

1. The large title 找熊猫.
2. A search field with the placeholder 名字、拼音或场馆.
3. Filter chips (`Chip`), single select: 全部, 在中国, 在海外, 双胞胎, 归国. A chip shows only when its filter has a real query behind it.
4. **熊猫地图.** A card with a still thumbnail of China: the land, faint city names and a bare house glyph per place, a 海外 N 个场馆 capsule in the corner, and 熊猫地图 with the totals after bare glyphs under it. The whole card opens `/map`. Shown while browsing.
5. **查关系.** One grouped row with a leading glyph, to `/relationship`. Shown while browsing. 比一比 moved to 发现 as published comparisons; the venues live on the map.
6. **大家常看.** One inset group of panda rows: a 44pt round photo, the name with a sex glyph, the current place as a subheadline, and a chevron. The signal is follows: the published pandas that the most fans began following in the last 30 days, counting only pandas with at least five such fans (`GET /api/v2/popular-pandas`, no counts published). The block shows the top five and only while 全部 is selected with no search. It is hidden when no panda reaches the floor. The full list follows directly under it as 全部熊猫, so the block has no 全部 link.

Status: built. The map card replaced the three glyphs and the venue tiles (mockup: 找熊猫 · 地图卡片). 大家常看 stays hidden until five fans follow one panda within 30 days. The chips are 在中国, 在海外, 双胞胎 (pandas in a sourced twin pair), 归国 (pandas the overseas catalog marks returned), then each area in China; each shows only when it keeps a panda.

## 熊猫地图 — `/map`

Mockups: 地图 · 现在 and 地图 · 点开场馆 on the 发现、找熊猫与地图 canvas. References: Apple Maps for the markers and the control column, Protomaps for the base colors.

1. The map fills the screen: the Natural Earth land outline on `mapWater`, land in `mapLand`, drawn by us (no tiles). One finger drags it, two pinch it, a mouse wheel zooms it on the web. It opens on the places in China.
2. **Markers.** A bare house glyph haloed in the land color, the name and the resident count beside it, haloed the same way. Places closer than 44pt on screen merge into one marker named N 个地方, and a tap zooms to them. Where two labels would overlap, the smaller place keeps only its glyph. A name near the right edge hangs to the left of its glyph. City names (重庆, 西安 …) show faintly once the map is zoomed to China.
3. **Controls.** A back button top left. Top right, the 场馆 / 野生区 switch (two pills, each a switch; either layer can be off), and under it one capsule holding 海外 (fits every place) and 回到中国, split by a hairline.
4. **Wild areas.** The five ranges of the Giant Panda National Park (秦岭, 岷山, 邛崃山, 大相岭, 小相岭), each drawn as `mapWild` circles, one per local population, whose area equals its habitat, with the range's name and a bare trees glyph in `mapWildInk`. They are schematic, not real borders, and the sheet says so. Counts and habitat come from Table 1 of the park's master plan (4th national survey): 1,340 wild pandas in the park. 凉山 is outside the park and not drawn.
5. **Timeline.** In the sheet: a play button, the year (现在 or YYYY 年) and one line under it, then a histogram of records per year (hatched where a year has none) with a scrubber; drag it or use the adjustable control. Play steps one year every 0.7 s from the first year; the camera stays put. A past year draws each place as a ring sized by who lived there at the year's end, the year's moves as tapered flows, and the year big over the map; the sheet lists the year's events in the `Timeline` component, oldest first (出生, 出国, 回国, 迁移, 亮相, 取名). A death is a quiet grey row with no glyph or color. 现在 returns to today.
6. **Sheet.** Up to half the screen; drag the grabber (or tap it) to fold it to its header and back. With nothing chosen: 熊猫地图, 中国西南 and a hint, the timeline, three tiles (场馆, 住在场馆, 野生栖息地: a glyph, the number, the label), the schematic note, then every place grouped 中国 and 海外 as rows (places without coordinates included; a row of one opens its page). A chosen place: a bare house glyph, its name, country and count, a close button; an action row of 路线 (the phone's map app; 高德 on the web), 关注 (signed out, it goes to sign-in; followed, it reads 已关注 on the selected ground) and 场馆页 (or 地点页); then 住在这里 with the pandas as photo tiles. A chosen wild area: its name and provinces, an action row with 栖息地页, tiles for 野生大熊猫, 栖息地 km² and 附近场馆, its populations with their counties and counts, and a link to the source.

Status: built, matching the mockups. 关注 needs migration `0091_venue_follows` and the API deployed.

## 发现 (after v4)

What to read and play when the fan is not looking for one panda. The three tabs split by intent: 今天 pushes what is timely, 找熊猫 looks up a panda, a venue or a relation, and 发现 holds the articles, 专题, the calendar and the games. Every block is led by photographs from our own media host, each naming the panda pictured. A block with nothing real to show is left out.

1. The large title 发现.
2. **本期.** The featured `StoryCard`, turning over each day among the published articles whose hero panda has a reviewed cover (shown through that cover, not the article's hotlinked original) and the 专题 with content.
3. **熊猫日历.** A card that opens `/calendar`, with the next three birthdays as photo tiles. 那年今天 and 生日周 are read by date from the calendar, so they need no block of their own here.
4. **专题.** 4:5 photo cards for the 专题 with content that are not leading: 归国熊猫 (overseas-status items), 双胞胎, 场馆动态 (venue-news items).
5. **比一比.** Pairs the team publishes (`data/curation/comparisons`, `GET /api/v2/comparisons`); fans do not pick them. A rail of cards: the two covers side by side split by a white hairline with 比 on a white disc, the names at the bottom corners, the title and the dek under the photo. A card opens `/compare` with the pair; 全部 opens `/comparisons` when there is more than one. Hidden until an entry is published.
6. **玩一玩.** Four square photo cards, always there: 每日一猫, 猜熊猫, 认脸挑战, 月度挑战.
7. **文章.** The first three published articles that are not leading, as 科普's feed rows, with 全部 to `/learn`.

Status: built. Phase 2 adds status to the blocks (玩一玩 progress) from the loaders the pages already use.

## 图鉴 — `03-book`

1. The large title 图鉴.
2. **Progress card.** A `ProgressRing` and 点亮 N / total: pandas met (见过 or 认出, once each) over the published catalog count from the API (The Life List Rule). Hidden signed out; at zero it shows 0 / total.
3. **Stat tiles.** Three tiles: 见过 N 只 (`Eye`), 认出 N 只 (`ScanFace`, per The Life List Rule; `BadgeCheck` means an official source) and 去过 N 处 (`MapPin`). Each opens its own list.
4. A `Segmented` control with 全部, 见过 and 认出.
5. **Grid.** Four columns of square photo tiles with the name under each. Pandas not yet met are a `card` tile with a tertiary `Eye` and 未见过. Show at most one row of unmet tiles, not the whole catalog.
6. **各个基地.** One inset group, with a row per base that has a panda the user has met: `MapPin`, the name, met / living there now (2 / 2), and a chevron.

Signed out and empty states stay as described in DESIGN.md › The Life List Rule.

Status: built in the second batch.

## 我的 — `04-me`

1. The large title 我的.
2. **Profile row.** A large monogram avatar, the name, and a tint pencil glyph that opens 改名字.
3. **Stat tiles.** 关注 N 只, 打卡 N 天 and 去过 N 处. 打卡 is 累计来过 from The Daily Check-in Rule: a total, never a streak.
4. **年度回顾 banner.** A photo card with the year and 年度回顾. It needs #805 and shows only once the year has data.
5. **First group.** 关注的熊猫, 我的合集, 去过的地点 and 里程碑, each with a count and a chevron. 里程碑 shows only while the milestones switch is on.
6. **Second group.** 通知, 我的纠错 with a count, and 设置.

Signed out, the profile row becomes 登录 and the stat tiles and the first group are hidden.

Status: built in the second batch; the 年度回顾 banner came with #805. 关注的熊猫 opens `/following` and 我的纠错 opens `/contributions`.

## 设置 — `05-settings`

1. A pushed screen with the inline title 设置.
2. **Account row.** The monogram and the name, with a chevron to the account.
3. **外观.** One row whose value is 跟随系统 / 浅色 / 深色. It opens a picker list (`/appearance`), not a segmented control.
4. **提醒.** One group of `SwitchRow`s: 生日提醒, 那年今天, 里程碑 and 场馆动态. A switch shows only when it does something. 生日提醒 needs #804 and 场馆动态 needs #807.
5. **Pages.** One group: 数据来源, 隐私, 用户协议, 反馈 and 关于吱熊猫. A row shows only when its page exists.
6. The data version, as a centered footnote.
7. 退出登录, in its own group.

Status: built, without 反馈 and 关于 (no pages yet). 场馆动态 turns the 今天 card on and off; it is kept on this device.

## 熊猫详情 — `06-panda`, `06-panda-dark`, `06b-panda-family`, `06c-panda-photos` (superseded by v3.7 single-scroll canvas in #931)

1. **Hero / No-photo identity header (`The Plate Rule`).** With a cover photo, a stretchy full-bleed photograph (`HERO = 292`, `OVERLAP = 52`, `HeroFade`) with bare back, share and `•••` glyphs sits above the display name, optional right-aligned `认养名`, English name and sex glyph. With no published photo, a top `highlight-soft` gradient fading from `y = 0` into the page ground frames a horizontal `60×60` `tile`-radius typographic initial monogram (`nameInitial`, no icon inside) beside the name block. A deterministic 1-sentence factual lead bio follows when verified fields support one.
2. **关注 and 见过.** `关注` is the filled ink capsule with `Heart` (grey `secondary` once followed); `见过` is the neutral `card` capsule with `Eye` and date once marked. Both hide when deceased.
3. **Unified 3-column metric strip (`The Stat Block Rule`).** Borderless hairline-separated 3 columns: `生日 | 现居 | 谱系号` when living, or `生日 | 离世 | 谱系号` when deceased. `生日` folds birth year and current age into its subtitle; linked `现居` opens `/institutions/[slug]`; recorded `谱系号` opens `/learn/terms/studbook`. Unrecorded cells show a quiet muted dash `—`, never bright blue.
4. **Live venue & photo peek.** `PandaVenueLive` shows the local venue clock, one activity band and `看直播` link. When 2 or more photos exist, a horizontal **照片** peek strip links directly (`全部 N 张` and `照片 N` tiles) into `/pandas/[slug]/photos` instead of an inline `Segmented` tab bar.
5. **Mid/lower editorial sections (in scroll order).**
   - **小档案:** horizontal carousel of whitelisted `local.*` facts (enclosure, twin rank, birth size/weight, birth time, first-year or 100-day weight; never repeats studbook; lead card uses `highlight-soft`); omitted when none exist.
   - **认出{名字}:** mapped Chinese appearance feature pills and feeding/care notes when verified data exists, followed by `PandaFaceGuideCard` when a guide exists.
   - **成长阶段:** 4-segment track (`幼崽 / 亚成体 / 成年 / 老年`) with birthday countdown for living pandas with a birth year, placed mid-scroll away from the venue activity bar.
   - **去过的地方 / 经历:** dual-stop route card or residency/timeline summary with a `时间线` link to `/pandas/[slug]/timeline`, shown when route, stays, or events exist.
   - **家人:** canonical lineage merged with deduplicated `local.*` relatives (`<= 2` compact 2-column horizontal cards; `>= 3` horizontal `92pt` portrait cards) with a `家族树` link to `/pandas/[slug]/family`, shown when at least one relative is known.
   - **快捷互动三格:** compact 3-button `control`-radius strip (`名片卡` `/pandas/[slug]/share`, `查关系` `/relationship?from=`, `比一比` `/compare?a=`), shown on every profile.
   - **同年生, 那年今天 / 纪念, 场馆动态:** up to 4 living same-year peers (`同年生`), dated memories (`Memories`), and matching official venue announcements (`PandaVenueNewsCard`), each shown when present.
   - **科普延伸阅读:** once the learning catalog loads, one matched article card (`RecommendedArticleCard`, falling back to the catalog's first article when no specific tag matches).
6. **Quiet footer.** Hairline-separated collapsible **资料来源** (`N 处`, collapsed by default), low-key correction prompt (`信息有遗漏？　帮我们补充` → `/pandas/[slug]/correct`), and optional cover photo credit footnote.

Status: shipped in #814 (tabbed layout), redesigned to the v3.7 single-scroll profile in #931.

## Feature screens

Each of these is built in its own PR. Each PR moves to palette C and the new components first, then builds the screen to its image.

| Screen | Image | PR |
|---|---|---|
| 场馆 · 参观攻略 | `07-venue-guide` | #811 (观猫时机, 拍照点位) |
| 场馆动态 | `07b-venue-news` | #807 |
| 生日周 | `08-birthday-week` | #804 |
| 生日卡 | `09-birthday-card` | #804 |
| 年度回顾 | `10-year-review` | #805 |
| 月度挑战 | `11-monthly-challenge` | #806 |
| 双胞胎 | `12-twins` | #808 |
| 双胞胎对比 | `13-twins-compare` | #808 (built on `CompareTable`) |
| 那年今天 | `14-on-this-day` | built in the second batch |
| 归国熊猫 | `15-overseas-return` | #812 |

A venue's page (`/institutions/[slug]`, redesigned in Batch 1 v4.1) uses a single-scroll canvas without middle `Segmented` tabs (`?tab=guide` remains harmlessly accepted). Below the stretchy hero (`INSTITUTION_HERO_HEIGHT = 276`) sit the factual intro, the dual primary/secondary action capsules (`关注场馆` and `去过打卡`), a borderless hairline-separated 3-column metric strip (`现在住这里 | 在这里出生 | 门票概况`), the inline `VenueLiveCard` (local clock, activity bar, `看直播`), and the compact `VenueQuickTools` strip (`导航过去 / 官方直播 / 查看官网`). Next sits `住在这里` (optional `你在本馆已见过 N / M 只` progress bar, `全部 / 未见过 / 我关注` filter tabs, search for `>= 4` residents, and an initial 6-item preview expanding via `看全部熊猫`), followed by the 6-layer `参观攻略`, `FacilityVisits`, `VenueNewsSection`, expandable `以前住过`, and a quiet source footer.

A wild range's page (`/wild/[id]`) opens from the map sheet's 栖息地页. It shows a sketch of the populations (circles sized by habitat, lettered), tiles for 野生大熊猫, 栖息地 km² and 占国家公园, the populations by count with a bar each, the venues within reach of the range's centre (the map's 附近场馆 rule), the other ranges and the source.

The enriched `参观攻略` (`institution-guide.tsx`, `venue-guide-extras.ts`) structures pre-trip decisions into 6 modular layers: (1) 2×2 pre-trip Bento (`开放时间 / 门票预约 / 最佳观猫 / 建议时长`), (2) full-day activity band (`DayBand`, falling back to `VENUE_CLOCK_SPECS` when facility hours lack viewing bands), (3) curated 01–04 route timeline with resident avatar hints when configured for major flagship venues (collapsed gracefully when unconfigured), (4) horizontal photo-spot cards from `photoSpots`, (5) an SVG schematic location map card + address one-tap navigation + transit summary, and (6) practical tips + official website entry. Missing blocks hide without placeholders.

场馆动态 (`07b-venue-news`) is one timeline card (`NewsTimeline`), newest first, the newest dot tinted. Each row has the date (2026.11.06), the venue, the notice's own headline, a countdown (2 天后) on one still to come, or else the photo of the first panda it names, and it opens the original. Ink chips narrow it: 全部, 关注的 (the venues where the followed pandas live, shown when one has a notice), then each venue with a notice. The hosts follow as official `SourceBadge`s. The mockup's bell waits for a news reminder. A venue's page shows its three newest notices on the same card, with 全部动态 when there are more.

生日周 (`08-birthday-week`) has 接下来 7 天 over the title, a strip of the seven days (weekday over date, today on an ink tile, a dot under each day with a birthday), then one group per day (今天 · 11月4日 周三) of 44pt round photos with the age at the right; a row opens the 生日卡. 生日提醒 sits at the foot as a switch, and also in 设置's 提醒 group. The mockup's bell is left out: the reminder lives on 今天, not in a push. 官方生日活动 shows only when an institution's own announcement is curated in `events.ts`.

生日卡 (`09-birthday-card`) has 封面, 奖章 and 海报 in a `Segmented` above the card, the card itself on a 360×480 artboard in palette C (ink ground, white type, sky accent, a silver medal), then 分享 and 分享链接 as glyph actions and 看看{名字} as the filled button. 存到相册 and 复制链接 wait for the media-library and clipboard modules; the page dots wait for a swipeable card.

年度回顾 (`10-year-review`) is the fan's own year, from their records only: the year over the title; a hero with the first panda they met that year (今年第一只, the day at the right); 见过, 打卡 and 去过 as stat tiles; 每月打卡 as twelve bars with the busiest month in `graphic`; the 图鉴点亮 ring card shared with 图鉴 (`LitCard`); 第一次, the year's first 认出, 见过, 去过 and 打卡 on a `Timeline`; and 分享回顾, which saves the top of the page as an image. The mockup's 看得最多 41 次 needs per-year counts the records do not keep, so the hero names the first panda instead. On 我的 the banner (the year's first panda behind 2026 年度回顾) shows once the year holds a record. An earlier build reviewed the public record (births, moves) instead; it was replaced to follow the mockup.

月度挑战 (`11-monthly-challenge`) has 月度挑战 over 十一月挑战, then a card with a large `ProgressRing` (done over total) and the days left; 任务 as a stepper of discs on a rail, an ink check once done (the disc is the checkbox) and the number until then, each row opening the page that does it; and 往期, a trophy per earlier month joined, ink when complete. Joining is opt-in and kept on this device: before joining the page offers 参加十一月挑战, and 退出本月挑战 sits at the foot. Tasks are ticked by hand. The mockup's tasks that name a panda or read a record (认出晓晓和蕾蕾, 打卡 7 天) wait for a month's theme to be written.

双胞胎 (`12-twins`) lists pairs as cards: the two covers side by side (the first character on the placeholder when one has none), the names joined by a quiet &, the birthday (2021.06.23 出生) for twins or the written note for a pair, and a chevron to 比一比. A `Segmented` switches 双胞胎 and 像的熊猫 when both exist. Twins come only from sourced lineage (same mother, same exact birth date). The mockup's birthplace waits for a birthplace field. 找熊猫 opens it from a 双胞胎 explore card; the 双胞胎 filter chip is still to come. 对比 (`13-twins-compare`) is the existing 比一比 page on `CompareTable`; its 同框 photo waits for photos tagged with both pandas.

归国熊猫 (`15-overseas-return`) has country chips (全部, then each country with an entry), then 即将归国 (检疫中, 归国途中, 已宣布归国 with its expected date), each year's returns newest first, and 旅居海外. Pandas that came home together on one day from one institution share a row: two overlapping faces, the names, a `Plane` with "上野 → 中国", and the day (01.28) at the right. The catalog records where they left, not the base they went to, so the arrow ends at 中国 until it does. The announcements follow as official `SourceBadge`s. 找熊猫 opens it from the first explore card; the 归国 filter chip is still to come.

The 那年今天 page (`14-on-this-day`) has a back chevron, the date line and the large title, then a `Segmented` control with 本周 and 本月, the week hero, the memories of the range, and the 那年今天 switch. The memories are one timeline card as in the mockup (`MemoryTimeline`), with 少显示 and 关闭 on a long press and as accessibility actions, and the sources as badges under the card. The hero is the page variant of the week hero: no tag, the day it happened, what happened, and N 周年 at the right.

## Open decisions

Decided: 图鉴 follows its mockup (2026-11-04), with the ring against the whole catalog and the 全部 / 见过 / 认出 views; DESIGN.md › The Life List Rule says so. The tab glyphs follow the mockup (2026-11-05). 大家常看 counts follows in the last 30 days, with at least 5 followers (2026-11-05).

None are open now. When a mockup and a written rule disagree, the rule holds until the owner decides, and the disagreement is listed here.
