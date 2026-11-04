# Screens: the v4 mockups

What each app screen holds, top to bottom, as approved in the v4 mockups (2026-11-04, palette C 熊猫). [DESIGN.md](../../DESIGN.md) is the visual system: tokens, components, glyphs and rules that hold on every screen. This file is the surface layer: which blocks a screen has, in what order, what data feeds each block, and when a block is hidden. When the two disagree on how something looks, DESIGN.md wins; when they disagree on what a screen contains, this file wins, and the conflict is listed under [Open decisions](#open-decisions).

The mockups are in [`mockups/v4/`](mockups/v4/), and [`00-overview.webp`](mockups/v4/00-overview.webp) shows them all on one sheet. Build a screen from its own image, then compare a real screenshot with the image side by side in light and dark mode before you open the PR.

## How to read a mockup

- **示例 means invented.** A block or number marked 示例 shows a layout, not data. It never ships with made-up values (The Sample Rule in DESIGN.md). When there is real data, the block shows it. When there is not, the block is hidden, or shows the screen's empty state if the block is the reason the screen exists.
- **A missing feature hides its block.** A block whose feature or page does not exist yet is left out. Do not put a placeholder, a disabled row or 即将上线 in its place. List what you left out in the PR's comparison.
- **Names, dates and photos in a mockup are examples.** Real screens read them from the API.

## Tab bar

There are four tabs: 今天, 找熊猫, 图鉴 and 我的. The bar is the system bar described in DESIGN.md › Navigation. The mockups use a calendar glyph for 今天 and a book for 图鉴. Whether to switch from the current glyphs (`sun`, `layout-grid`) is an open decision.

## 今天 — `01-today`, `01-today-dark`

1. **Header.** The date as a semibold secondary footnote line (11月4日 星期三), then 今天 in display. The date line is content, not a kicker. The monogram avatar on the right opens 我的.
2. **Week hero** (`WeekHero`). This is the nearest 那年今天 or 生日周 anniversary in the coming 7 days: one photograph, the tag in the top-left corner, the title (回国 3 周年) and the pandas' names at the bottom-left, and the day (11.8 周日) at the bottom-right. Tapping it opens the first panda. In a week with no anniversary the featured story card takes its place.
3. **Quick entries.** There are four bare glyphs with labels, all in label color: 观猫时机, 归国, 挑战, 场馆. An entry shows only once its page exists. Until then the slot goes to an existing page, such as 日历 or 猜熊猫.
4. **观猫时机 and 挑战.** Two half-width cards. 观猫时机 shows the best hours today at the user's followed or nearest venue, with a `TimeBand`; it needs #811. 挑战 shows this month's progress as a `ProgressRing`; it needs #806 and real progress. The ring shown in the mockup is 示例.
5. **场馆动态.** A `Timeline` card with the next and the latest event at the venues the user follows, a countdown (2 天后) on an upcoming one, and a chevron to the list. It needs #807.
6. **What follows.** The story cards, 本周新鲜事, 你关注的 and the birthday scroller stay below, as in DESIGN.md, until the blocks above are live. After that, decide whether they stay.

Status: #814 ships 1–3. Steps 4 and 5 wait for #811, #806 and #807.

## 找熊猫 — `02-find`

1. The large title 找熊猫.
2. A search field with the placeholder 名字、拼音或场馆.
3. Filter chips (`Chip`), single select: 全部, 在中国, 在海外, 双胞胎, 归国. A chip shows only when its filter has a real query behind it.
4. **探索.** A horizontal scroller of photo cards, each with a bare glyph and a title on the photo: 归国熊猫, 双胞胎, 场馆, and the existing explore entries (熊猫在哪里, 查两只熊猫的关系, 比一比两只熊猫). A card shows only when its page exists.
5. **大家常看.** One inset group of panda rows: a 56pt round photo, the name with a sex glyph, the current place as a subheadline, and a chevron. 全部 opens the full list. The mockup marks this block 示例. It ships only when there is a real popularity signal. Until then the block is the plain list, which is today's behavior, without the 大家常看 heading.

Status: the second batch, in progress.

## 图鉴 — `03-book`

1. The large title 图鉴.
2. **Progress card.** A `ProgressRing` and 点亮 18 / 942. See [Open decisions](#open-decisions): this conflicts with The Life List Rule.
3. **Stat tiles.** Three tiles: 见过 N 只 (`Eye`), 认出 N 只 (`BadgeCheck`) and 去过 N 处 (`MapPin`). Each opens its own list.
4. A `Segmented` control with 全部, 见过 and 认出.
5. **Grid.** Four columns of square photo tiles with the name under each. Pandas not yet met are a `card` tile with a tertiary `Eye` and 未见过. Show at most one row of unmet tiles, not the whole catalog.
6. **各个基地.** One inset group, with a row per base that has a panda the user has met: `MapPin`, the name, met / living there now (2 / 2), and a chevron.

Signed out and empty states stay as described in DESIGN.md › The Life List Rule.

Status: the second batch, in progress.

## 我的 — `04-me`

1. The large title 我的.
2. **Profile row.** A large monogram avatar, the name, and a tint pencil glyph that opens 改名字.
3. **Stat tiles.** 关注 N 只, 打卡 N 天 and 去过 N 处. 打卡 is 累计来过 from The Daily Check-in Rule: a total, never a streak.
4. **年度回顾 banner.** A photo card with the year and 年度回顾. It needs #805 and shows only once the year has data.
5. **First group.** 关注的熊猫, 我的合集, 去过的地点 and 里程碑, each with a count and a chevron. 里程碑 shows only while the milestones switch is on.
6. **Second group.** 通知, 我的纠错 with a count, and 设置.

Signed out, the profile row becomes 登录 and the stat tiles and the first group are hidden.

Status: the second batch, in progress.

## 设置 — `05-settings`

1. A pushed screen with the inline title 设置.
2. **Account row.** The monogram and the name, with a chevron to the account.
3. **外观.** One row whose value is 跟随系统 / 浅色 / 深色. It opens a picker list (`/appearance`), not a segmented control.
4. **提醒.** One group of `SwitchRow`s: 生日提醒, 那年今天, 里程碑 and 场馆动态. A switch shows only when it does something. 生日提醒 needs #804 and 场馆动态 needs #807.
5. **Pages.** One group: 数据来源, 隐私, 用户协议, 反馈 and 关于吱熊猫. A row shows only when its page exists.
6. The data version, as a centered footnote.
7. 退出登录, in its own group.

Status: shipped in #814 without 生日提醒, 场馆动态, 反馈 and 关于.

## 熊猫详情 — `06-panda`, `06-panda-dark`, `06b-panda-family`, `06c-panda-photos`

1. **Hero.** A stretchy, full-bleed photograph with bare back, share and ••• glyphs (The Plate Rule).
2. The name in display, with the pinyin and sex glyph as a footnote.
3. **关注 and 见过.** 关注 is the ink button with a `Heart`. 见过 is the tinted button with an `Eye`.
4. **Stat tiles.** 生日 (month and day), 年龄 and 所在地 (The Stat Block Rule).
5. A `Segmented` control with 概况, 家族, 照片 and 动态, linked by `?tab=`.
   - **概况:** a parents row and the latest move row, then the 经历 `Timeline`, which lists only events that happened, each with its `SourceBadge`.
   - **家族:** the family tree, parents over siblings with the current panda ringed, then a 兄姐 group sorted by birth year.
   - **照片:** the photo count, a `Segmented` filter by source (全部, the institution, Wikimedia), a mixed grid, and the credits line.
   - **动态:** venue news about this panda. It needs #807.

Status: shipped in #814 (概况, 家族, 照片).

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
| 那年今天 | `14-on-this-day` | the second batch |
| 归国熊猫 | `15-overseas-return` | #812 |

The 那年今天 page (`14-on-this-day`) has a back chevron, the date line and the large title, then a `Segmented` control with 本周 and 本月, the week hero with its photo credit under it, a `Timeline` card of the other memories in the range (each with its date and year, a bare kind glyph, N 周年 and a thumbnail), the source badges, and the 那年今天提醒 switch. The ••• 少显示 actions in The On This Day Rule stay on each row.

## Open decisions

These are places where a mockup and a written rule disagree. The rule holds until the owner decides.

1. **图鉴 progress against the whole catalog.** The mockup shows 点亮 18 / 942. The Life List Rule says no bar against the whole catalog: progress is shown only against a finite goal the user can finish, such as one base or one family. Ship the mockup's tiles, grid and 各个基地, and leave the ring out until this is decided.
2. **图鉴 views.** The mockup has 全部 / 见过 / 认出. DESIGN.md has 清单 / 按基地 / 按家族. The mockup moves 按基地 into the 各个基地 group and drops 按家族.
3. **Tab glyphs.** The mockup uses calendar for 今天 and book for 图鉴, where the app now uses `sun` and `layout-grid`. Changing them means regenerating `assets/symbols/` and `assets/tab-icons/`.
4. **大家常看.** There is no popularity signal in the API yet. Decide whether to build one, or to drop the block.
