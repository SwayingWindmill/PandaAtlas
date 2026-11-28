# Screens: the v4 mockups

What each app screen holds, top to bottom, as approved in the v4 mockups (2026-11-04, palette C 熊猫). [DESIGN.md](../../DESIGN.md) is the visual system: tokens, components, glyphs and rules that hold on every screen. This file is the surface layer: which blocks a screen has, in what order, what data feeds each block, and when a block is hidden. When the two disagree on how something looks, DESIGN.md wins; when they disagree on what a screen contains, this file wins, and the conflict is listed under [Open decisions](#open-decisions).

The mockups are in [`mockups/v4/`](mockups/v4/), and [`00-overview.webp`](mockups/v4/00-overview.webp) shows them all on one sheet. Build a screen from its own image, then compare a real screenshot with the image side by side in light and dark mode before you open the PR.

## How to read a mockup

- **示例 means invented.** A block or number marked 示例 shows a layout, not data. It never ships with made-up values (The Sample Rule in DESIGN.md). When there is real data, the block shows it. When there is not, the block is hidden, or shows the screen's empty state if the block is the reason the screen exists.
- **A missing feature hides its block.** A block whose feature or page does not exist yet is left out. Do not put a placeholder, a disabled row or 即将上线 in its place. List what you left out in the PR's comparison.
- **Names, dates and photos in a mockup are examples.** Real screens read them from the API.

## Tab bar

There are four tabs: `探索` (`/(tabs)/(today)`), `找熊猫` (`/(tabs)/find`), `地图` (`/(tabs)/map`), and `我的` (`/(tabs)/me`). The bar is the system bar described in DESIGN.md › Navigation. The glyphs follow the shipped 4-tab layout: compass for `探索`, search for `找熊猫`, map for `地图`, and person for `我的`. Former `今天` and `发现` tab blocks were unified into `探索`, and `我的图鉴` (`/book`) is reached from `我的`.

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

## 找熊猫 — `/(tabs)/find` (v4.3 overhaul)

1. The large title `找熊猫` (`已收录 N 只` or `聚合搜索` counter).
2. A search field (`SearchField` / iOS `Stack.SearchBar`) with placeholder `名字、拼音、场馆或谱系号` matching names, pinyin initials, places, and normalized `#<id>` / `<id>` studbook numbers (`pandas.ts`).
3. Multi-dimensional combinable filter chips (`Chip` ink): `全部` (resets active filters) + quiet `重置` link when active, attribute chips (`在世`, `有照片`, `双胞胎`, `归国`, combined via AND intersection) and location chips (`在中国`, `在海外`, domestic regional areas, combined via OR union). Combined matches satisfy `(locations empty || any location) && all attributes`.
4. **Idle browsing blocks.** `最近看过`, `最近搜索`, and `FindTools` (`查关系` → `/relationship` with dual covered mini avatars joined by a `bg-primary` connector line; `认脸图鉴` → `/learn` with a `-4deg` `34×34` covered tile; bare icon fallbacks when unavailable).
5. **Unified aggregate search.** When query is non-empty, `匹配场馆` (`SectionHeader`) renders up to 3 matched venues (`MatchedVenueCard`, `role="link"` → `/institutions/[slug]`) with lead photo or bare `Landmark` icon, live local clock + status dot (`buildVenueLiveSnapshot`), and an expand toggle (`展开其余 N 处场馆`) above `匹配大熊猫`.
6. **Results gallery & list toggle.** Header (`匹配大熊猫` / `符合条件` / `全部熊猫　N 只`) pairs with `画廊` / `列表` toggle (`LayoutGrid` and `List` bare icons; default `"gallery"`). Gallery mode splits `hasFullBleedCover` pandas into 2-column (1-column under `useSingleColumn()`) 4:5 portrait `FindGalleryCard`s (conditional top-left frosted `#1237` studbook pill, conditional top-right `见过`/`关注` badge, bottom name + sex + `place　birthYear 年出生`), folding coverless rows (`PandaRow` with quiet `studbookNumber`) below under `更多大熊猫`. Progressive paging (`PAGE_SIZE = 24` + `显示更多`). Both `FindGalleryCard` and `PandaRow` keep `role="button"` and `accessibilityLabel` starting with `panda.name`.

Status: upgraded in Batch 2 (v4.3).

## 熊猫地图 — `/(tabs)/map` (v4.3 overhaul)

Mockups: 地图 · 现在 and 地图 · 点开场馆 on the 发现、找熊猫与地图 canvas, plus v4.3 visited passport and timeline upgrades. References: Apple Maps for the markers and the control column, Protomaps for the base colors.

1. The map fills the screen: the Natural Earth land outline on `mapWater`, land in `mapLand`, drawn by us (no tiles). One finger drags it, two pinch it, a mouse wheel zooms it on the web. It opens on the places in China.
2. **Filter bar & deep link.** Horizontal `tablist`: `全部 N`, `国内 N`, `海外 N`, `有直播`, conditional `我去过 N` (shown when visited > 0 or `filter === "visited"`), and `野生区`. Supports `/map?filter=visited` deep links (`useLocalSearchParams`).
3. **Markers.** A bare house glyph haloed in the land color, the name and the resident count beside it, haloed the same way. Visited venues highlight with a `primary` ring + lead resident `PandaThumb`; under `我去过` (`dimUnvisited`), visited markers carry tinted capsules and unvisited places soften into dimmed dots. Places closer than 44pt merge into `N 个地方`, and tapping zooms in.
4. **Controls.** Top right `ViewControls`: `Globe` (查看全球视野 / 回到中国西南), `Layers` (野生区图层 switch), and **`时间轴`** (`History` bare icon, `role="button"`, `accessibilityLabel="分布时间轴"`).
5. **Wild areas.** The five ranges of the Giant Panda National Park (秦岭, 岷山, 邛崃山, 大相岭, 小相岭), drawn as `mapWild` circles with `mapWildInk` labels (`1,340` wild pandas from Table 1 of the master plan; 凉山 is outside the park and not drawn).
6. **Timeline.** Tapping top-right `时间轴` opens the 1950–present history sheet (`heading "分布时间轴"`, `CloseButton` `"关闭时间轴"`): play button, year label (`现在` or `YYYY 年`), histogram scrubber (`label "年份"`), and `YearSheet` event cards drawn on a vertical `w-hairline bg-border` rail with small dots, dual-tone badges (`归国` in `bg-highlight-soft text-primary`), and `PandaThumb`s.
7. **Sheet.** Up to half/expanded screen; drag or tap the grabber to fold/expand. With nothing chosen: **足迹护照卡** (`FootprintPassportCard` with `ProgressRing`, `已去过 N / M 个场馆`, `今年新解锁` / `现场见过 K 只大熊猫`, `link "看猫日记"` → `/visits`, shown when visited > 0 or `filter === "visited"`), `VenueFocusCard`, `DirectoryShortcut` → `/institutions`, and `map-places` venue rows with `PandaThumb` and `lastVisited` subtitle (`VisitedEmptyCard` when `filter === "visited"` and 0 visits). Chosen place/wild sheets open `PlaceSheet` / `WildSheet`.

Status: upgraded in Batch 2 (v4.3).

## 发现 (retired tab; blocks unified into 探索, `/play`, `/compare`, `/learn`)

> The standalone `发现` tab from the 5-tab v4 draft was folded into `探索` (`/(tabs)/(today)`) and pushed screens (`/play`, `/compare`, `/learn`, `/calendar`) when the app moved to 4 tabs. Kept here as background for block origins.

What to read and play when the fan is not looking for one panda. Every block is led by photographs from our own media host, each naming the panda pictured. A block with nothing real to show is left out.

1. The large title 发现.
2. **本期.** The featured `StoryCard`, turning over each day among the published articles whose hero panda has a reviewed cover (shown through that cover, not the article's hotlinked original) and the 专题 with content.
3. **熊猫日历.** A card that opens `/calendar`, with the next three birthdays as photo tiles. 那年今天 and 生日周 are read by date from the calendar, so they need no block of their own here.
4. **专题.** 4:5 photo cards for the 专题 with content that are not leading: 归国熊猫 (overseas-status items), 双胞胎, 场馆动态 (venue-news items).
5. **比一比.** Pairs the team publishes (`data/curation/comparisons`, `GET /api/v2/comparisons`); fans do not pick them. A rail of cards: the two covers side by side split by a white hairline with 比 on a white disc, the names at the bottom corners, the title and the dek under the photo. A card opens `/compare` with the pair; legacy `/comparisons` redirects to `/compare`. Hidden until an entry is published.
6. **玩一玩.** Four square photo cards, always there: 每日一猫, 猜熊猫, 认脸挑战, 月度挑战.
7. **文章.** The first three published articles that are not leading, as 科普's feed rows, with 全部 to `/learn`.

Status: built. Phase 2 adds status to the blocks (玩一玩 progress) from the loaders the pages already use.

## 我的图鉴 — `/book` (v4.5 overhaul; formerly `03-book`)

1. The screen title `我的图鉴`, with header-right bare `Share` action (`分享`) sharing the passport summary.
2. **Obsidian Panda Passport Hero (`LitCard`).** Dark ink card (`bg-button` in light, `bg-card` + hairline `border-border` in dark) combining the `ProgressRing` (`点亮 N%`), `吱熊猫　个人图鉴护照` eyebrow, oversized `${met} / ${catalog} 只大熊猫`, and bottom hairline-separated 3-column counters (`现场见过 N 只 | 猜谜认出 N 只 | 去过场馆 M 处`). Preserves the concise variant without counters in `年度回顾`.
3. **Empty state.** Keeps `从第一只开始` and `WaysIn` (`认出` / `见过` / `去过`), persisting locally for guests via AsyncStorage (`zhipanda:guest:*`).
4. A `Segmented` control with exact labels `全部`, `见过`, and `认出`.
5. **Grid & DiscoveryRow.** 3-column (2-column under `useSingleColumn()`) square photo tiles (`MetTile`) with edge-to-edge cover, `Scrim`, panda name, and frosted `见过`/`认出` badge (`role="link"`, `No.${number}，${name}，${detail}`). Unmet placeholder tiles are replaced by a single warm `DiscoveryRow` (`还有 N 只待点亮　去找熊猫 ›` → `/find`).
6. **基地集邮进度.** Borderless hairline-separated rows directly on `bg-background` (visited/started bases first, expandable to remaining bases with living pandas), each displaying a lead resident `PandaThumb` via `pickBaseLeadPandaId`, venue title, `${known} / ${members.length}` right-aligned in `text-primary`, rounded progress bar (`bg-fill` / `bg-graphic`), and `已到访` / `${pct}%` status.

Status: upgraded in Batch 3 (v4.5).

## 趣味挑战 — `/play` (v4.5 overhaul)

1. Eyebrow `每日猜谜与主题收集` over `趣味挑战`, backed by real guest/signed-in game records (`loadGuestGames()` / `GET /api/v2/me/panda-book`), `loadDailyPanda()`, `useLearningCatalog()`, `useChallengeState()` + `useMonthThemes()`, and `lookAlikePairs()`.
2. **16:10 `每日一猫` Spotlight Hero.** Full-bleed `RemoteImage` + `Scrim`, top-left `今日主线　已完成/待猜测` pill, conditional top-right frosted streak pill (`Flame` bare icon, only when real daily streak > 0), bottom title/subtitle, and light `开始`/`查看` pill (`Play` bare icon) → `/daily`.
3. **2-column Challenge Cards.** Side-by-side (`1`-column under `useSingleColumn()`) photo tiles for `猜熊猫` (frosted `已认出 N 只` or `看图识猫` → `/guess`) and `认脸挑战` (conditional `${count} 组挑战` → `/learn/challenge`).
4. **月度挑战 Banner & 双胞胎与撞脸对照.** `月度挑战` card with live small `ProgressRing` (`done/total` → `/challenge`), followed by a borderless `双胞胎与撞脸对照` row with overlapping covered `PandaThumb` avatars → `/look-alikes`.

Status: upgraded in Batch 3 (v4.5).

## 比一比 — `/compare` (v4.5 overhaul; `/comparisons` redirects here)

1. **Picking state (`/compare` or `/compare?a=...`).** Eyebrow `档案与外貌对照` over `并排比一比`, unified Split `VS` Stage (`rounded-card border-hairline border-border`, `2px` `bg-background` seam, centered `VS` pill, `useStacked()` column restack), inline `SearchField` + selectable list, primary CTA when distinct, and `精选对照` Editorial Diptych Photo Cards (`buildFeaturedComparePairs`) with `全部双胞胎` → `/look-alikes` when not filtering.
2. **Result state (`/compare?a=...&b=...`).** Header-right `换选` (`ArrowLeftRight` bare icon → `/compare`), Seamless Split Diptych Hero (two 4:5 `PandaPhoto`s with `2px` seam, tapping each opens `/pandas/[slug]`; top frosted `VS` pill swaps `a`/`b`), `KinshipCallout` (`summarizeCompareKinship` → pre-filled `/relationship?a=...&b=...`), borderless centered-axis `核心档案对照` matrix (`性别`, `出生` with exact delta badge, `现居` with `同住一馆`, `谱系号`; stacks cleanly at `useStacked()`), borderless `外貌辨识` section with calm single-paragraph observation note when points/hints are absent (zero missing-field editorial copy), and quiet `LearningSources` when present. Legacy `/comparisons` renders `<Redirect href="/compare" />`.

Status: upgraded in Batch 3 (v4.5).

## 认识大熊猫 — `/learn` (v4.5 editorial polish)

1. Magazine masthead (`博物科普与识猫` eyebrow over `认识大熊猫`, right `${count} 篇科普`), conditional `AskEntry` (`问问熊猫`), and 4:3 full-bleed `FeaturedArticle` hero.
2. **认脸指南.** Promoted 4:5 portrait carousel + `认脸挑战` button directly below `FeaturedArticle`.
3. **Borderless Editorial Feed.** Category article sections (`FeedArticle`) render directly on `bg-background` separated by `border-b-hairline border-border`, followed by `名词` (`ListSection`). Developer `资料版本` footer removed.

Status: upgraded in Batch 3 (v4.5).

## 我的 — `04-me`

1. The large title 我的.
2. **Profile row.** A large monogram avatar, the name, and a tint pencil glyph that opens 改名字.
3. **Stat tiles.** 关注 N 只 (hints `含 M 场馆` when `followedPandas` is empty), 打卡 N 天 and 去过 N 处. 打卡 is 累计来过 from The Daily Check-in Rule: a total, never a streak.
4. **年度回顾 banner.** A photo card with the year and 年度回顾. It needs #805 and shows only once the year has data.
5. **First group.** 关注的熊猫, 我的合集, 去过的地点 and 里程碑, each with a count and a chevron. 里程碑 shows only while the milestones switch is on.
6. **Second group.** 通知, 我的纠错 with a count, and 设置.

Signed out, the profile row becomes 登录 and the stat tiles and the first group are hidden.

Status: built in the second batch; the 年度回顾 banner came with #805. 关注的熊猫 opens `/following` and 我的纠错 opens `/contributions`.

## 我的关注 — `/following` (v4.3 overhaul)

1. Screen title `我的关注`.
2. `Segmented` toggle (`熊猫 N` | `场馆 M`, defaulting to `熊猫`).
3. **`熊猫` tab.** `PandaRow` list of followed pandas, or `ScreenState` pointing to `/find`.
4. **`场馆` tab.** Cards for followed venues (`54×54` `PandaThumb` or bare `Landmark` icon), live local status + embedded `VenueActivityBar`, unfollow action (`已关注场馆`), `查看攻略` → `/institutions/[slug]`, and `看直播` when available.

Status: upgraded in Batch 2 (v4.3).

## 去过的地点 — `/visits` (v4.3 overhaul)

1. Screen title `去过的地点` with top-right `足迹地图` capsule link → `/map?filter=visited`.
2. Borderless 3-column stat strip (`到访 | 去过的地方 | 现场见过`).
3. Yearly vertical journal timeline (`YYYY 年看猫手账　N 次`, `w-hairline bg-border` rail + small dot): `longDate`, tappable place/institution name, quoted `visit.note`, horizontal `PandaThumb` + name chip strip for same-day seen pandas (`matchSeenPandasForVisit`), prompt to `/institutions/[slug]/checkin` on today's unannotated visits, and muted secondary `移除` button (`删除...去${placeLabel}的记录`). Empty state keeps `还没有到访记录。`.

Status: upgraded in Batch 2 (v4.3).

## 设置 — `05-settings`

1. A pushed screen with the inline title 设置.
2. **Account row.** The monogram and the name, with a chevron to the account.
3. **外观.** One row whose value is 跟随系统 / 浅色 / 深色. It opens a picker list (`/appearance`), not a segmented control.
4. **提醒.** One group of `SwitchRow`s: 生日提醒, 那年今天, 里程碑 and 场馆动态. A switch shows only when it does something. 生日提醒 needs #804 and 场馆动态 needs #807.
5. **Pages.** One group: 数据来源, 隐私, 用户协议, 反馈 and 关于吱熊猫. A row shows only when its page exists.
6. The data version, as a centered footnote.
7. 退出登录, in its own group.

Status: built, without 反馈 and 关于 (no pages yet). 场馆动态 turns the 探索 card on and off; it is kept on this device.

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

A venue's page (`/institutions/[slug]`, redesigned in Batch 1 v4.1) uses a single-scroll canvas without middle `Segmented` tabs (`?tab=guide` remains harmlessly accepted). Below the stretchy hero (`INSTITUTION_HERO_HEIGHT = 276`) sit the factual intro, the dual primary/secondary action capsules (`关注场馆` and `去过打卡` / `今天已打卡` → `/institutions/[slug]/checkin`), a borderless hairline-separated 3-column metric strip (`现在住这里 | 在这里出生 | 门票概况`), the inline `VenueLiveCard` (local clock, activity bar, `看直播`), and the compact `VenueQuickTools` strip (`导航过去 / 官方直播 / 查看官网`). Next sits `住在这里` (optional `你在本馆已见过 N / M 只` progress bar, `全部 / 未见过 / 我关注` filter tabs, search for `>= 4` residents, and an initial 6-item preview expanding via `看全部熊猫`), followed by the 6-layer `参观攻略`, `FacilityVisits`, `VenueNewsSection`, expandable `以前住过`, and a quiet source footer.

今日逛园打卡 (`/institutions/[slug]/checkin`, added in Batch 2 v4.3) lets signed-in and guest fans pick a facility (when > 1), enter an optional 1-line `看猫小记`, filter residents (`未见过优先` / `全部 N` + `SearchField` when `>= 6`), check off seen pandas across a 3-column (2-col on `useSingleColumn()`) photo tile grid + coverless checklist rows, and save via `Promise.allSettled` (preserving failed IDs for retry on partial failure). Full success renders a notched `SouvenirTicket` (`今日逛园战绩` header, `线下逛园纪念票根` hero plate, quoted note, 3-up newly lit pandas strip, `ProgressRing` venue progress, `分享纪念票根`, `查看看猫日记` → `/visits`, and `返回场馆页`).

A wild range's page (`/wild/[id]`) opens from the map sheet's 栖息地页. It shows a sketch of the populations (circles sized by habitat, lettered), tiles for 野生大熊猫, 栖息地 km² and 占国家公园, the populations by count with a bar each, the venues within reach of the range's centre (the map's 附近场馆 rule), the other ranges and the source.

The enriched `参观攻略` (`institution-guide.tsx`, `venue-guide-extras.ts`) structures pre-trip decisions into 6 modular layers: (1) 2×2 pre-trip Bento (`开放时间 / 门票预约 / 最佳观猫 / 建议时长`), (2) full-day activity band (`DayBand`, falling back to `VENUE_CLOCK_SPECS` when facility hours lack viewing bands), (3) curated 01–04 route timeline with resident avatar hints when configured for major flagship venues (collapsed gracefully when unconfigured), (4) horizontal photo-spot cards from `photoSpots`, (5) an SVG schematic location map card + address one-tap navigation + transit summary, and (6) practical tips + official website entry. Missing blocks hide without placeholders.

场馆动态 (`07b-venue-news`) is one timeline card (`NewsTimeline`), newest first, the newest dot tinted. Each row has the date (2026.11.06), the venue, the notice's own headline, a countdown (2 天后) on one still to come, or else the photo of the first panda it names, and it opens the original. Ink chips narrow it: 全部, 关注的 (the venues where the followed pandas live, shown when one has a notice), then each venue with a notice. The hosts follow as official `SourceBadge`s. The mockup's bell waits for a news reminder. A venue's page shows its three newest notices on the same card, with 全部动态 when there are more.

生日周 (`08-birthday-week`) has 接下来 7 天 over the title, a strip of the seven days (weekday over date, today on an ink tile, a dot under each day with a birthday), then one group per day (今天 · 11月4日 周三) of 44pt round photos with the age at the right; a row opens the 生日卡. 生日提醒 sits at the foot as a switch, and also in 设置's 提醒 group. The mockup's bell is left out: the reminder lives on 探索, not in a push. 官方生日活动 shows only when an institution's own announcement is curated in `events.ts`.

生日卡 (`09-birthday-card`) has 封面, 奖章 and 海报 in a `Segmented` above the card, the card itself on a 360×480 artboard in palette C (ink ground, white type, sky accent, a silver medal), then 分享 and 分享链接 as glyph actions and 看看{名字} as the filled button. 存到相册 and 复制链接 wait for the media-library and clipboard modules; the page dots wait for a swipeable card.

年度回顾 (`10-year-review`) is the fan's own year, from their records only: the year over the title; a hero with the first panda they met that year (今年第一只, the day at the right); 见过, 打卡 and 去过 as stat tiles; 每月打卡 as twelve bars with the busiest month in `graphic`; the 图鉴点亮 ring card shared with 我的图鉴 (`/book`, `LitCard`); 第一次, the year's first 认出, 见过, 去过 and 打卡 on a `Timeline`; and 分享回顾, which saves the top of the page as an image. The mockup's 看得最多 41 次 needs per-year counts the records do not keep, so the hero names the first panda instead. On 我的 the banner (the year's first panda behind 2026 年度回顾) shows once the year holds a record. An earlier build reviewed the public record (births, moves) instead; it was replaced to follow the mockup.

月度挑战 (`11-monthly-challenge`) has 月度挑战 over 十一月挑战, then a card with a large `ProgressRing` (done over total) and the days left; 任务 as a stepper of discs on a rail, an ink check once done (the disc is the checkbox) and the number until then, each row opening the page that does it; and 往期, a trophy per earlier month joined, ink when complete. Joining is opt-in and kept on this device: before joining the page offers 参加十一月挑战, and 退出本月挑战 sits at the foot. Tasks are ticked by hand. The mockup's tasks that name a panda or read a record (认出晓晓和蕾蕾, 打卡 7 天) wait for a month's theme to be written.

双胞胎 (`12-twins`) lists pairs as cards: the two covers side by side (the first character on the placeholder when one has none), the names joined by a quiet &, the birthday (2021.06.23 出生) for twins or the written note for a pair, and a chevron to 比一比. A `Segmented` switches 双胞胎 and 像的熊猫 when both exist. Twins come only from sourced lineage (same mother, same exact birth date). The mockup's birthplace waits for a birthplace field. 找熊猫 opens it from a 双胞胎 explore card; the 双胞胎 filter chip is still to come. 对比 (`13-twins-compare`) is the existing 比一比 page on `CompareTable`; its 同框 photo waits for photos tagged with both pandas.

归国与旅居 (`/returning`, `15-overseas-return`, upgraded in Batch 3 v4.5) keeps stack title `归国熊猫` under eyebrow `海外合作与归国行程` + display title `归国与旅居`, country `Chip` filters (`全部` + countries), and Flighty-style `ReturnRouteCard`s (`bg-card rounded-card border-hairline border-border`): semantic status pill (`已归国` / `即将归国` / `现居海外`) + tabular `returnMeta`, dashed route arc with bare `Plane`/`MapPin` (`place` → `中国` or `旅居展馆`, restacking under `useStacked()`), and independent tappable panda member cards (`查看{name}的档案` → `/pandas/[slug]`) for every item in `group.items`, above a calm single-line source footer.

家族树 (`/pandas/[slug]/family`, polished in Batch 3 v4.5) preserves `FamilyTree`, cached lineage prefetching and in-place `history` navigation, replaces `StatTile` boxes with a borderless 3-column `SummaryStrip` (`上溯 | 后代 | 亲缘查询` with `查关系` modal trigger, or single `Button "查关系"` when `!known`), renders `GenerationSection` (without `出处` noise) and `DescendantPlaces` as borderless hairline rows on `bg-background`, and finishes with a single-line archive footer.

The 那年今天 page (`14-on-this-day`; legacy `/week` redirects here) has a back chevron, the date line and the large title, then a `Segmented` control with 本周 and 本月, the week hero, the memories of the range, and the 那年今天 switch. The memories are one timeline card as in the mockup (`MemoryTimeline`), with 少显示 and 关闭 on a long press and as accessibility actions, and the sources as badges under the card. The hero is the page variant of the week hero: no tag, the day it happened, what happened, and N 周年 at the right.

## Open decisions

Decided: 图鉴 follows its mockup (2026-11-04), with the ring against the whole catalog and the 全部 / 见过 / 认出 views; DESIGN.md › The Life List Rule says so. The tab glyphs follow the mockup (2026-11-05). 大家常看 counts follows in the last 30 days, with at least 5 followers (2026-11-05).

None are open now. When a mockup and a written rule disagree, the rule holds until the owner decides, and the disagreement is listed here.
