# 吱熊猫设计系统

- **状态：** 当前生效。网站公开页面以第 1–9 节为准。App 以第 10 节为准，第 10 节与前面冲突时以第 10 节为准。
- **生效日期：** 2026-10-29（App 改为 iOS 26 系统语义；网站仍用 Radix）
- **适用范围：** `apps/web` 的公开页面和共享组件，以及 `apps/mobile`（App，写法见第 10 节）；Admin 有自己的作用域样式，不受本文约束。
- **取值来源：** 网站的数值在 `apps/web/styles/tokens.css`。App 的数值在 `apps/mobile/src/global.css`，并与 `apps/mobile/src/lib/theme.ts` 同一组 iOS 系统色。两份不再共用色阶和字号。本文和对应 token 文件不一致时以 token 文件为准，并修正本文。
- **样板页面：** 网站是首页 `features/home/`、熊猫列表 `app/[locale]/pandas/`、熊猫资料页 `features/profile/`；App 是家谱 `apps/mobile/src/app/pandas/[slug]/family.tsx`。新页面先照着样板的写法做。

## 1. 十条规则

每个公开页面的改动都要满足这十条。评审时逐条对照。

1. **不用「·」当分隔符。** 并列的次要信息用间距隔开（见 4.3 的 meta 行），不用标点串起来。
2. **不加解释性文字。** 不写「这里展示的是……」「我们只……」这类说明段落。界面本身说不清楚的，先改结构和标签，而不是加一段话。
3. **文案面向熊猫爱好者。** 好懂、不口语化、不造词，长度和场景匹配：按钮两到四个字，标题一句话。用第 7 节的词表。
4. **颜色只用 Radix Colors，并按它的色阶用途来用**（见第 2 节）。
5. **对齐和圆角。** 做光学对齐（例如热门链接和搜索框里的文字对齐，而不是和框线对齐）；有嵌套时圆角同心：内圆角 = 外圆角 − 两者间距。
6. **线条一律 0.5px。** 用 `var(--pa-border)`。
7. **动效从简。** 默认不加；需要时用 `var(--pa-duration)`（250ms）和 ease-out。不做图片悬停放大、按下缩放这类装饰动效。
8. **字号最多四档，最小 12px。** 层级不够时用字重、颜色和间距来拉开，而不是再加一档字号（见第 3 节）。
9. **少让用户做判断。** 必须选择时，放在用户本来就打算选的地方（例如筛选栏）。先排信息优先级，次要信息收起或删掉。
10. **克制使用圆角和阴影。** 阴影只给真正浮起来的层（浮层卡片、下拉菜单）。不用卡片左侧彩色竖线。

## 2. 颜色

### 2.1 用到的色板

全部来自 `@radix-ui/colors`，在 `app/globals.css` 顶部引入：

| 色板 | 角色 | 说明 |
|---|---|---|
| `olive` / `olive-alpha` | 中性色 | 背景、文字、边框、主按钮。Radix 官方把 olive 列为和 jade、grass、green 搭配的灰。 |
| `jade` | 唯一的点缀色 | 用量极少，见 2.3。 |
| `amber` | 提醒 | 资料暂缺、加载失败、待确认的记录。 |
| `red` | 错误 | 真正的错误和危险操作。 |
| `black-alpha` / `white-alpha` | 叠在照片上 | 照片底部的渐变遮罩等。 |

不要再引入其他色板。需要新语义时先在这张表里加一行，并说明为什么现有颜色不够。

### 2.2 十二级色阶的用途

按 Radix 官方《Understanding the scale》的规定使用：

| 级别 | 用途 | 在本项目里 |
|---|---|---|
| 1 | 页面背景 | `--pa-color-canvas`、`--pa-color-surface`（olive-1） |
| 2 | 卡片等次一级背景 | 可与 1 互换 |
| 3 | 组件常态背景 | `--pa-color-surface-subtle`（olive-3）：次按钮、空状态、收藏区块 |
| 4 | 组件悬停背景 | `--pa-color-surface-hover`（olive-4） |
| 5 | 组件按下 / 选中背景 | `--pa-color-surface-strong`（olive-5） |
| 6 | 非交互元素的细线 | `--pa-color-line`（olive-6）：分隔线、页头底线 |
| 7 | 交互元素的细线 | — |
| 8 | 交互元素的强调线、焦点框 | `--pa-color-line-strong`（olive-8）：搜索框、筛选下拉 |
| 9 | 实色背景 | jade-9：点缀色本色 |
| 10 | 实色背景悬停 | — |
| 11 | 低对比文字 | `--pa-color-ink-muted`（olive-11）、`--pa-color-highlight-text`（jade-11）、`--pa-color-warning`（amber-11） |
| 12 | 高对比文字 | `--pa-color-ink`（olive-12） |

主按钮是例外：用 olive-12 做实色背景、olive-1 做文字，悬停变 olive-11。这是黑白风格的主操作，不是点缀色。

### 2.3 点缀色（jade）只用在这些地方

- 收藏爱心（页头「我的熊猫」、资料页收藏按钮、首页收藏区块）；
- 首页「已收录 N 只熊猫」和「今日推荐」这类一行小标签；
- 经历时间线里「现在」的节点；
- 动态里的「新动态」标记；
- 键盘焦点框。

新增使用位置前先问：去掉它，用户会不会错过什么？不会就不加。按钮、链接、大面积背景都不用点缀色。

### 2.4 在代码里怎么写

- 页面和组件只读 `--pa-*` 语义 token，不直接写 `--olive-7` 这类色阶变量，也不写十六进制或 `rgba()`。照片遮罩可以直接用 `--black-a*`。
- Tailwind 写法：`bg-[var(--pa-color-surface-subtle)]`。不要用 Tailwind 自带色板（`bg-stone-100`、`text-amber-900` 等）。
- 文字对比度由 axe 测试把关（WCAG AA）。amber-11 放在 amber-3 上只有 4.24，不够，提醒块里的正文用 amber-12。

## 3. 文字

### 3.1 四档字号

| token | 大小 | 用途 |
|---|---|---|
| `--pa-text-meta` | 12px | 次要信息：日期、地点、数量、筛选标签、页脚小标题、版本号 |
| `--pa-text-body` | 16px | 正文、按钮、链接、卡片上的熊猫名字 |
| `--pa-text-title` | 20px | 区块标题（h2）、资料页时间线和家人的小节标题 |
| `--pa-text-display` | 32–48px 随屏宽变化 | 每页唯一的 h1 |

Tailwind 对应：`text-xs`（12）、`text-base`（16）、`text-xl`（20）。不用 `text-sm`（14）、`text-lg`（18）、`text-2xl` 及以上。

全局的 h1、h2 默认字号写在 `styles/typography.css`，选择器用 `:where()` 降到零权重，所以模块里的类名可以直接覆盖。

### 3.2 层级靠字重、颜色和间距

- 字重：正文 400；名字、事实值 700；区块标题 800；h1 900。
- 颜色：主信息 olive-12，次要信息 olive-11。
- 例子：资料页事实列表是「12px 灰色标签 + 16px 粗体值」，不是两档字号的标题。

### 3.3 字体

中文 Noto Sans SC Variable，西文标题 Archivo Variable（字体已作为依赖安装）。Logo 文字只有「吱熊猫」，不再有小号的 ZHIPANDA 字样。

## 4. 间距、圆角、线条、阴影

### 4.1 内容宽度与页边距

- 内容最大宽度 `--pa-content-max`（77.5rem），页边距 `--pa-space-page`（16–64px 随屏宽变化）。共享写法是 `publicShellClassName`。
- 区块之间 56px（3.5rem）；标题与内容之间 20–24px。

### 4.2 圆角

| token | 大小 | 用途 |
|---|---|---|
| `--pa-radius-sm` | 8px | 嵌在 16px 圆角里、间距 8px 的元素 |
| `--pa-radius-md` | 12px | 小卡片、地点结果 |
| `--pa-radius-lg` | 16px | 照片卡片、空状态、提醒块、下拉菜单 |
| `--pa-radius-xl` | 24px | 首屏大图、收藏区块 |
| `--pa-radius-pill` | 胶囊 | 按钮、搜索框、筛选下拉 |

同心示例：搜索框高 56px、内边距 6px，里面的按钮也是胶囊，两者圆心重合；下拉菜单 16px 圆角、内边距 6px，菜单项圆角 10px。

### 4.3 线条

- 一律 `var(--pa-border)`（0.5px）。Tailwind 写 `border-[0.5px]`、`ring-[0.5px]`。
- 列表优先用分隔线，不用一格一格的底色卡片（资料页事实列表、生活过的地方）。

### 4.4 阴影

只有 `--pa-shadow-float`，只给首页浮在大图上的推荐卡片和导航下拉菜单。其他卡片 `--pa-shadow-card` 为 `none`。

### 4.5 动效

- 只在状态切换需要提示时加，例如下拉箭头旋转、按钮颜色变化：`transition-colors duration-250 ease-out`。
- `prefers-reduced-motion` 下全部关闭（`styles/motion.css`）。

## 5. 常用组件写法

| 组件 | 写法 |
|---|---|
| 主按钮 | 胶囊，高 44–48px，olive-12 底、olive-1 字，16px 粗体；悬停 olive-11 |
| 次按钮 | 胶囊，olive-3 底、olive-12 字；悬停 olive-4 |
| 文字链接 | olive-12 粗体，无下划线，悬停出现下划线（偏移 3px） |
| 搜索框 | 胶囊，0.5px olive-8 线，左侧图标，右侧主按钮；聚焦时线变 olive-12 |
| 筛选 | 原生 `<select>` 包成胶囊，标签 12px 灰色在前、当前值粗体在后；一个「应用筛选」按钮，无 JavaScript 也能用 |
| 照片卡片 | 4:5 照片、16px 圆角；下面是名字（16px 粗体）和 meta 行；整张卡是一个链接，悬停只给名字加下划线 |
| meta 行 | 12px olive-11，项与项之间 12px 间距，可换行 |
| 事实列表 | 两列 `<dl>`，每项上方一条 0.5px 线，12px 标签 + 16px 粗体值 |
| 待确认标签 | 只有「待确认」「有争议」「已更正」「已宣布」「已取消」才显示，12px amber-11，跟在值后面；已确认的不标 |
| 空状态 | olive-3 底、16px 圆角、一句短话；能给下一步就给一个链接或按钮 |
| 提醒块 | amber-3 底、amber-12 字、16px 圆角；只在资料过期、部分缺失或无法更新时出现 |
| 数据版本 | 资料正常时只在页尾留一行 12px 小字「资料版本 …」 |

组件来源仍按 `ui-component-sourcing-policy.md`：先找成熟组件（shadcn/Radix 等），再按本文调样式。

## 6. 页面结构

- **首页：** 搜索在首屏左侧，一张熊猫大图在右侧，推荐卡片浮在图上；往下依次是最近更新、按地点找、收藏区块。
- **列表页：** 标题和数量、搜索框、吸顶筛选栏、照片网格、分页。没有结果时给建议的熊猫和清除筛选。
- **资料页：** 先放照片和身份（名字、别名、简介、事实列表、收藏和见过），再放动态、经历和家人（两栏）、生活过的地方、照片，最后是数据版本。参照百科信息框的顺序：性别、出生、所在地、父母放在首屏。
- 每页只有一个 h1，区块用 h2，区块内小节用 h3。

## 7. 文案词表

| 概念 | 中文 | English |
|---|---|---|
| 熊猫资料页 | 熊猫资料 | Panda profile |
| 生活状态 | 在世 / 已离世 | Living / Deceased |
| 当前地点 | 所在地 | Lives at |
| 父母 | 父母 | Parents |
| 经历 | 经历 | Life story |
| 生活过的地方 | 生活过的地方 | Places lived |
| 动态 | 熊猫动态 | Panda updates |
| 未定的记录 | 待确认 / 有争议 | Unconfirmed / Disputed |
| 无数据 | 暂无记录 / 暂无照片 | Unknown / No photos yet |
| 收藏 | 收藏 / 已收藏 | Favorite / Favorited |

不用「档案」「投影」「交付」「结构化」「精度」「结论状态」这类内部词。出生年份写「2008 年出生」，不写「2008 年生」或单独一个年份。

## 8. 参考过的资料

- Radix Colors《Understanding the scale》和《Composing a palette》：十二级色阶用途、olive 与 jade 的搭配、语义色的选择。<https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale>
- Wikipedia「Mei Xiang」信息框：熊猫个体资料的常见顺序（照片、物种、性别、出生、所在地、父母、后代）。<https://en.wikipedia.org/wiki/Mei_Xiang>
- Apple Human Interface Guidelines《Typography》：用字重和颜色表达层级、设置最小可读字号。<https://developer.apple.com/design/human-interface-guidelines/typography>

参考网站只提炼成上面的规则，不照搬某一家的整体样式。

## 9. 交付前自查（网站）

App 的自查看第 10 节和 `DESIGN.md`，不按下面的四档字号和 Radix 色阶。

1. 对照第 1 节十条规则逐条检查；
2. 页面里没有新增十六进制颜色、`rgba()`、Tailwind 自带色板、14px 或 18px 字号，边框都是 0.5px（键盘焦点框除外）；
3. 中文和英文、桌面（1440）和手机（390）都截图看过，包括空状态、无照片、加载失败；
4. `npm run lint`（含设计和文案检查）、`npm run typecheck`、Playwright 冒烟和无障碍测试通过；
5. 320px 宽度和 200% 文字放大下没有横向溢出。

## 10. App（`apps/mobile`）

App 用 iOS 26 的系统界面，不跟网站的橄榄纸和四档字号。品牌留在熊猫照片和一点绿色 tint 上。Android 用同一套颜色和列表，导航交给系统的 Material 标签栏和工具栏。Web 导出用同一套排版，标签栏是一条带模糊的底栏，不是 Liquid Glass。

样板是科普：`learn/index.tsx` 和 `learn/articles/[slug].tsx`。名词、认脸和认脸挑战用同一套阅读栏。

- **颜色：** 系统分组背景 `#F2F2F7` / `#000000`，分组里的表面 `#FFFFFF` / `#1C1C1E`，标签黑/白，次要文字 `#636366` / `#AEAEB2`，分隔线 `#C6C6C8` / `#38383A`。Tint 是熊猫绿 `#1B7F64`（深色里的文字 tint 是 `#3DDC97`）。主按钮用 `#1B7F64` 底、白字，这样浅色和深色都过 WCAG AA。不要再写 Radix olive。
- **深色：** 跟随系统，我的里可以改成浅色或深色。`true black` 是分组背景，不是装饰。
- **字号：** `Text` 用 iOS 字阶，行高给中文留出空：Large Title 34/41、Title1 28/36、Title2 22/28、Title3 20/26、Headline 17/24 semibold、Body 17/26、Callout 16/24、Subhead 15/22、Footnote 13/18、Caption 12/16。旧名字 `h1` `h2` `h3` `muted` `small` 映射到这一阶。西文走系统字体（旧金山 / 苹方），不另载一套展示字体。
- **导航：** 根布局是原生栈。四个标签各包一层栈，标签根屏在 iOS 上用大标题，滚动时收成栏内标题。返回是系统返回，可从屏幕左缘滑回。iOS 26 的标签栏由系统画成 Liquid Glass；不要给它设背景色，设了会关掉系统材质（见 `src/lib/screen-options.ts`）。Android 是 Material 3 底栏。Web 用 `_layout.web.tsx`。
- **列表：** 设置和目录用 `ListSection` + `ListCell`（或 `NavRow`）：圆角 10 的内嵌分组，行高至少 44，分隔线从文字缩进，最后一行没有线。长名单（找熊猫的结果）可以通栏。
- **空和失败：** `ScreenState` / `LoadFailed`：一句说明，需要时一个「重试」。不要再套一块灰色圆角卡片。
- **照片：** 资料页和科普文章以照片开头，说明放在照片下面，不叠字、不加文字阴影。返回和分享在系统栏里。
- **科普：** 首页和文章保持已认可的阅读栏。知识卡和专题路由已删除；条目仍留在目录数据里，不从 API 拿掉。
- **组件来源：** 导航用 Expo Router 的 `native-tabs` 和原生栈，这是 SDK 58 里系统标签和 Liquid Glass 的入口。`expo-glass-effect` 已随 SDK 装上，但 `GlassView` 在非 iOS 上只是普通 `View`，`isLiquidGlassAvailable()` 在非 iOS 返回 false，所以不用它冒充玻璃。按钮、开关、骨架仍用已经放进 `src/components/ui/` 的 React Native Reusables，再按本节改色。分组列表没有对应的维护组件：系统列表是导航器的一部分，RN 里没有可装的 UITableView，所以 `grouped-list.tsx` 只补这一块。

