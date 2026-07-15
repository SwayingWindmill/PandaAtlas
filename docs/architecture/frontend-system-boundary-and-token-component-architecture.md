# PandaAtlas 前端系统边界与 Token / 模块架构

- **状态：** 已确认，作为公开前端系统边界、样式所有权、模块 interface、Server/Client seam 与渐进迁移的架构规范
- **确认日期：** 2026-07-16
- **Wayfinder 票：** [Design the frontend system boundary and token/component architecture](https://github.com/SwayingWindmill/PandaAtlas/issues/35)
- **父地图：** [Wayfinder: PandaAtlas 前端系统性改进](https://github.com/SwayingWindmill/PandaAtlas/issues/31)
- **上游政策：** [PandaAtlas 前端设计原则与规范优先级](../design/frontend-design-principles-and-standards.md)
- **信息架构：** [PandaAtlas 核心公共旅程与信息架构](../design/core-public-journeys-and-information-architecture.md)
- **现状依据：** [PandaAtlas frontend system and evidence-gap audit](../research/frontend-system-audit-2026-07-15.md)

## 1. 决策摘要

PandaAtlas 采用 **“一个共享 Foundation、两个受控 register、多个领域 feature module”** 的前端架构。

系统统一的是：

- 语义 Token；
- 排版与空间尺度；
- 基础交互与无障碍机制；
- 全局导航、搜索和公共状态模式；
- URL、语言和页面 shell；
- Server/Client Component seam；
- 依赖方向和架构检查。

系统不强行统一的是：

- 首页的编辑性构图；
- 档案的事实阅读结构；
- 地图的空间交互；
- 谱系的关系浏览；
- 机构、场所和“我的熊猫”的领域组合。

共享只发生在语义和行为确实相同的层级。视觉相似但领域含义不同的模块，不得为了“复用”而被压成一个巨型通用组件。

首个 Beta 继续使用 Next.js 15、React 19、TypeScript、Tailwind v4 和项目自有 shadcn-style primitives。迁移采取 **绞杀式垂直切片**：每完成一个真实用户旅程，就建立新所有权并删除对应旧所有权，不进行全站 flag-day 重写。

## 2. 当前基线

截至本决策形成时，公开前端存在以下结构性问题：

- `apps/web/app/globals.css` 约 1,370 行，同时拥有 Token、文档基础、首页、图鉴、地图、旧地图、档案和谱系样式；
- `components/ui` 只有 Button、Badge、Card、Input、Select、Separator 六个 primitive，部分直接嵌入原始颜色、字号、圆角和阴影；
- 页面重复拥有 `SiteHeader`、内容容器、背景和 `<main>` 结构；
- 语言化路由目前主要覆盖可信个体详情，站点其余部分仍使用无语言路径；
- 可检索到约 504 处十六进制、`rgb()` 或 `rgba()` 样式使用；
- 首页、旧详情、图鉴、地图和谱系大量使用任意 Tailwind 值、内联字体和独立动效时长；
- 地图和谱系由大型 Client Component 承载较多页面级任务状态；
- 图标、`next/image`、MapLibre 与 `localStorage` 没有统一 adapter 或 registry seam；
- ESLint 仅提供 Next.js 默认规则，不能守住模块依赖、样式所有权和 Client Component 边界。

这些事实说明当前问题不是“缺少更多组件”，而是缺少可执行的所有权模型。

## 3. 规范性语言

- **必须 / 不得：** 架构和发布硬约束。
- **应该 / 不应该：** 默认方案；偏离时必须记录收益、风险和验证方式。
- **可以：** 在不破坏更高层约束时采用。

本文使用以下代码设计术语：

- **Module：** 具有 interface 与 implementation 的代码单元，规模不限。
- **Interface：** 调用方必须知道的全部契约，包括类型、状态、错误、顺序、配置和性能含义。
- **Seam：** module interface 所在的位置，调用方在此跨越所有权。
- **Adapter：** 在某个 seam 上满足 interface 的具体实现。
- **Deep module：** 以小 interface 隐藏较多行为和复杂度的 module。

## 4. 五层前端系统

依赖方向从上到下：

```text
App routes and page orchestration
              ↓
Feature modules and shared product patterns
              ↓
UI primitives
              ↓
Foundation
```

Register shell 位于 App route 与 pattern / feature 之间，负责页面呈现语域，不改变领域结论或基础交互语义。

### 4.1 Foundation

Foundation 只拥有跨全站稳定的机制：

- 参考值与语义 Token；
- 字体角色与排版尺度；
- 间距、容器和响应式尺度；
- 形状、边框、阴影和层级；
- 焦点、禁用和状态语义；
- 动效时长与 easing；
- 文档 reset 和基础可访问规则；
- 第三方样式隔离入口。

Foundation 不得知道：

- 熊猫实体；
- 机构或场所；
- 地图模式；
- 亲缘关系；
- 档案等级文案；
- 页面路由；
- React 业务 module。

### 4.2 UI primitives

UI primitive 统一基础交互机制，例如：

- Button；
- LinkButton；
- Input；
- Textarea；
- Select；
- Checkbox；
- RadioGroup；
- Switch；
- Dialog；
- Drawer；
- Popover；
- Tooltip；
- Disclosure；
- Tabs；
- Table 基础结构；
- VisuallyHidden；
- LiveRegion；
- Separator；
- Skeleton。

每个 primitive 负责：

- 正确 HTML 语义；
- 键盘行为；
- 焦点管理；
- 禁用、只读、错误和加载状态；
- 触控目标；
- Foundation Token 映射；
- 必要的 ARIA 契约。

Primitive 不得知道任何 PandaAtlas 领域概念。

### 4.3 Shared product patterns

Shared pattern 组合多个 primitive，隐藏跨页面重复的产品行为，例如：

- `GlobalSearch`；
- `PageHeader`；
- `FactList`；
- `SourceDisclosure`；
- `VerificationStatus`；
- `RevisionSummary`；
- `EmptyState`；
- `ErrorState`；
- `DegradedState`；
- `SectionNavigation`；
- `EntityLink`；
- `ResultsSummary`；
- `FilterPanel`；
- `StructuredAlternative`。

Shared pattern 可以拥有：

- URL 参数读写；
- 焦点恢复；
- 状态通知；
- 响应式排列；
- 多 primitive 协调；
- 通用 loading、empty、error 和 degraded 结构。

只有至少两个真实页面共享相同语义、状态和行为时，module 才提升为 shared pattern。

### 4.4 Register shells

PandaAtlas 采用两个 register：

#### Editorial register

适用于：

- 首页；
- 审核后的编辑故事；
- 少量品牌和方法说明。

可以调整：

- 内容节奏；
- 标题比例；
- 段落宽度；
- 信息密度；
- 编辑性媒体构图；
- 少量品牌强调方式。

#### Product register

适用于：

- 图鉴；
- 个体档案；
- 家族；
- 地图；
- 机构与场所；
- 我的熊猫。

强调：

- 事实优先；
- 中高信息密度；
- 稳定控制区；
- URL 状态；
- 结构化等价路径；
- 清晰的 loading、empty、error 与 degraded 状态。

两个 register 共享同一 Foundation、primitives、导航信息架构和可信状态语义。

### 4.5 Feature modules

首个 Beta 的主要 feature module：

- `atlas`；
- `profile`；
- `lineage`；
- `map`；
- `institutions`；
- `my-pandas`。

Feature module 拥有：

- 领域 view model；
- 页面专属组合；
- 领域状态与 reducer；
- adapter；
- 局部 CSS Module；
- feature 内部测试；
- 一个窄的公开 interface。

Feature module 不得：

- 发明全局 Token；
- 重建 Button、Dialog、Tabs 等基础交互；
- 直接导入另一个 feature 的私有实现；
- 重新推导后端或领域层已经确定的可信结论；
- 向调用方暴露 MapLibre、localStorage 或图形布局细节。

## 5. 推荐目录目标

实施时可以按以下方向渐进收敛：

```text
apps/web/
├── app/
│   ├── layout.tsx
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── (editorial)/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── (product)/
│   │       ├── layout.tsx
│   │       ├── atlas/
│   │       ├── lineage/
│   │       ├── map/
│   │       ├── institutions/
│   │       ├── places/
│   │       └── my-pandas/
│   └── admin/
├── components/
│   ├── ui/
│   └── patterns/
├── features/
│   ├── atlas/
│   ├── profile/
│   ├── lineage/
│   ├── map/
│   ├── institutions/
│   └── my-pandas/
├── foundation/
│   ├── icons.ts
│   ├── media/
│   └── preferences/
└── styles/
    ├── tokens.css
    ├── base.css
    ├── typography.css
    ├── motion.css
    ├── registers.css
    └── third-party/
        └── maplibre.css
```

这是所有权示意，不要求第一次实施就移动全部文件。迁移不得只做目录重排而不改变 interface 和依赖方向。

## 6. Token 架构

### 6.1 三层 Token 模型

#### 第一层：Reference tokens

Reference token 保存原始设计尺度，例如：

- 自然色阶；
- 中性色阶；
- 可信状态色阶；
- 字号和行高尺度；
- 间距尺度；
- 圆角尺度；
- 阴影尺度；
- 动效时长和 easing。

Reference token 只允许 Foundation 和受控 registry 使用。业务 TSX、page、pattern 和 feature 不得直接引用。

#### 第二层：Semantic tokens

Semantic token 表达用途，而不是具体颜色或尺寸，例如：

```text
surface-canvas
surface-subtle
surface-raised
surface-overlay
text-primary
text-secondary
text-muted
text-inverse
border-default
border-strong
action-primary
action-primary-hover
action-secondary
focus-ring
status-confirmed
status-provisional
status-disputed
status-stale
status-error
```

Primitives、patterns 和 feature module 默认只使用语义层。

#### 第三层：Module-local mappings

Deep module 可以在内部把语义 Token 映射成局部角色，例如：

- Button 的 `surface`、`text`、`border`；
- 档案事实表的 `label` 和 `value`；
- 地图模式 registry 的 `marker` 与 `selectedMarker`；
- 关系 registry 的 `edge` 与 `uncertainEdge`。

局部映射不得形成新的全站视觉语言。删除 module 时，局部映射应一起消失。

### 6.2 Token 命名

Token 名称必须描述语义，不描述具体值。

推荐：

```text
--surface-canvas
--text-primary
--space-section-lg
--radius-control
--motion-fast
```

禁止：

```text
--green-hero
--profile-card-bg
--map-page-text
--button-blue
--rounded-18
```

Reference token 可以包含尺度信息，但不得成为业务调用方 interface。

### 6.3 Register 映射

Route shell 使用稳定属性选择 register，例如：

```html
<body data-register="product">
```

或由对应 layout 在其持久容器上设置。

Register 可以映射：

- 内容宽度；
- 标题比例；
- 节奏与密度；
- 表面层级；
- 品牌强调方式。

Register 不得覆盖：

- 可信状态颜色；
- 焦点样式；
- 错误与警告语义；
- 控件最小尺寸；
- 对比度基线；
- 地图、迁移和亲缘关系含义。

### 6.4 主题策略

首个 Beta 只发布经过完整验证的浅色主题。

- 不根据操作系统偏好只给某一页面自动切换深色；
- 当前 `.trusted-profile-theme` 的局部深色覆盖应退出；
- 不引入运行时主题库；
- 深色主题只有在所有页面、状态、地图、谱系、媒体和对比度都能整体测试后，才作为独立工作进入系统。

### 6.5 领域颜色 registry

确有领域含义的颜色由对应 feature 的单一 registry 拥有，例如：

- 地图模式；
- 机构类型；
- 迁移状态；
- 亲缘关系；
- 结论状态。

Registry 必须同时定义：

- 稳定机器标识；
- 显示标签；
- 语义 Token 映射；
- 非视觉说明；
- 选中、禁用和高对比状态。

不得在 JSX 或长 Tailwind class 中临时创造领域颜色。

## 7. Primitive、pattern 与 feature 的判断规则

### 7.1 Primitive 判断

一个 module 进入 `components/ui`，必须满足：

- 与 PandaAtlas 领域无关；
- 统一基础语义和交互机制；
- 能被多个上层 module 使用；
- interface 小而稳定；
- 无障碍行为可以集中验证。

### 7.2 Shared pattern 判断

一个 module 进入 `components/patterns`，必须满足：

- 至少有两个真实调用方；
- 调用方需要相同语义、状态和行为；
- module 隐藏明显复杂度；
- 删除 module 后，复杂度会重新散落到多个调用方；
- interface 不要求调用方了解内部 URL、焦点或状态通知细节。

### 7.3 Feature 判断

以下 module 留在 feature：

- `PandaIdentitySummary`；
- `LineageRelationshipList`；
- `FootprintTimeline`；
- `InstitutionPandaRoster`；
- `MapModeSwitcher`。

视觉相似不构成共享理由。语义、状态和行为不相同时，不得抽象成 `GenericCard`、`GenericExplorer` 或 `UniversalEntityPanel`。

### 7.4 Card 的处理

通用 Card 不再作为默认页面结构。

若保留 `Card` primitive：

- 只拥有薄的表面层；
- 不拥有固定标题层级；
- 不拥有固定 padding；
- 不拥有默认大阴影；
- 不拥有业务状态。

大多数真实内容块应由 pattern 或 feature module 决定结构。

### 7.5 Badge 的处理

当前通用 Badge 应按语义拆分：

- 分类标签；
- 可信状态指示；
- 交互筛选项。

这三者不能继续通过一个可任意换颜色的胶囊组件表达。

## 8. Route shell 与 page shell

### 8.1 Root document shell

`app/layout.tsx` 只负责：

- `<html>` 与 `<body>`；
- 页面语言；
- 字体加载；
- Foundation 样式入口；
- 全局 skip target；
- 必要 provider。

Root layout 不得拥有：

- 首页背景；
- 站点导航；
- 产品内容宽度；
- feature 状态；
- 地图或谱系 provider。

### 8.2 Locale shell

所有公开页面进入 `app/[locale]`。

该 layout 负责：

- 校验 `zh` / `en`；
- 提供 locale 与共享字典；
- 生成语言切换目标；
- 公共 skip link；
- 站点级 404 与错误语义；
- 默认 metadata、canonical 和 `hreflang` 基础能力。

Page 和 feature 不再自行解析 locale 或拼装语言切换 URL。

### 8.3 Editorial route group

`app/[locale]/(editorial)` 不改变 URL。

该 layout 负责：

- Editorial register；
- 首页内容宽度和节奏；
- 编辑性页面背景；
- 与 Product shell 共享的全局导航 interface。

不得建立第二套导航信息架构。

### 8.4 Product route group

`app/[locale]/(product)` 不改变 URL。

该 layout 负责：

- Product register；
- 全局导航；
- 全局搜索；
- 主内容 landmark；
- 产品内容密度基线；
- 公共页脚；
- 当前页面和语言状态。

### 8.5 Feature route layout

只有持续上下文确实存在时才创建，例如：

- Atlas 与档案的上下文；
- 地图三模式共同边界；
- 机构与场所上下文。

Feature layout 可以拥有：

- 局部导航；
- 章节框架；
- URL 状态解析；
- feature loading、error 与 degraded 边界。

Feature layout 不得：

- 重复渲染全局导航；
- 定义新的 register；
- 创建只返回 `children` 的空 layout。

### 8.6 Page 的职责

`page.tsx` 负责：

- 当前路由的数据编排；
- 实体 metadata；
- 当前页面内容顺序；
- 将已发布领域数据转换为 view model；
- 调用 feature 的公开 interface。

Page 不负责：

- 全局导航；
- 通用容器 class；
- locale 解析；
- Foundation Token；
- 通用空、错和加载视觉；
- 直接操作 MapLibre、localStorage 或图形布局。

### 8.7 Admin shell

`app/admin` 保持独立 shell。

- 可以共享 Foundation 与基础 primitives；
- 不共享公共导航和 Editorial register；
- 后台需求不得反向扩大公开 module interface；
- 公开 feature 不得导入 admin module。

## 9. 排版系统

### 9.1 字体角色

只保留两个字体角色。

#### Product Sans

用于：

- 导航；
- 控件；
- 关键事实；
- 表格；
- 搜索和筛选；
- 地图与谱系；
- 默认正文。

优先保证：

- 中英文混排；
- 数字辨识；
- 小字号可读性；
- 多字重稳定性。

合规自托管字体通过 `next/font/local` 加载；缺少资产时使用稳定系统字体栈。不通过第三方远程 CSS 加载。

#### Editorial Serif

仅用于：

- 首页少量展示标题；
- 审核故事标题；
- 编辑性引语和导语。

不得用于：

- 控件；
- 可信状态；
- 来源；
- 关键事实；
- 密集数据。

缺少合规字体时可以回退 Product Sans，不阻塞系统迁移。

### 9.2 语义排版角色

Foundation 至少提供：

- `display`；
- `heading-1`；
- `heading-2`；
- `heading-3`；
- `body-lg`；
- `body`；
- `body-sm`；
- `label`；
- `caption`。

每个角色同时定义：

- 字号；
- 行高；
- 字重；
- 字距；
- 推荐最大宽度；
- 中英文适配规则。

组件不得通过 `text-[17px]`、内联 `fontSize` 或任意 `clamp()` 创建新层级。

## 10. 间距、形状与容器

### 10.1 间距尺度

Foundation 提供有限间距阶梯，例如：

```text
0, 1, 2, 3, 4, 6, 8, 12, 16, 24
```

具体值由实施规格确定。

默认使用：

- primitive：小阶梯；
- pattern：中阶梯；
- page section：大阶梯。

语义相同且视觉接近的间距不得创建新值。

### 10.2 形状与阴影

Foundation 定义有限角色：

- control radius；
- surface radius；
- overlay radius；
- subtle elevation；
- raised elevation；
- overlay elevation。

Module 不得通过 `rounded-[1.7rem]` 和独立 shadow 串创建局部视觉体系。

### 10.3 容器角色

提供四种语义容器：

- `reading`：故事、来源说明和长文本；
- `content`：档案、机构和常规产品页；
- `wide`：图鉴、比较和密集工作区；
- `viewport`：地图和谱系等空间工具。

每种容器统一处理：

- 最小边距；
- 最大宽度；
- safe area；
- 移动端 padding；
- 大屏留白；
- 200% 缩放行为。

Page 不得复制 `w-[min(1440px,calc(...))]` 等容器公式。

### 10.4 响应式策略

响应式变化以任务是否仍可完成为依据，不以具体设备型号为依据。

- 优先使用 Tailwind 默认断点或少量项目语义断点；
- feature 不得发明相近但不同的断点；
- Foundation 可以管理流体字号和间距；
- 复杂工具使用 `stacked`、`split`、`expanded` 等布局状态；
- 200% 缩放和窄视口下，核心正文不得依赖横向滚动；
- 数据表和空间工具可以使用受控滚动，并提供语义说明。

### 10.5 任意值例外

任意值仅允许用于：

- 数据可视化坐标或几何；
- 媒体固有比例；
- 第三方地图控件对齐；
- 经验证的无障碍修复；
- 已登记迁移事项的临时兼容。

例外必须集中在 module implementation 中，并说明原因。不得进入 page shell 或 primitive interface。

## 11. 图标架构

### 11.1 通用图标集

保留 Lucide 作为首个 Beta 唯一通用图标集。

建立受控入口，例如：

```text
foundation/icons.ts
```

只有该 registry 可以直接导入 `lucide-react`。页面和 feature 通过项目语义名称使用图标。

### 11.2 图标规则

系统统一负责：

- 标准尺寸；
- stroke 宽度；
- 文字基线对齐；
- 高对比和禁用状态。

默认规则：

- 图标默认装饰性并 `aria-hidden`；
- 图标按钮必须有可感知名称；
- 图标传递文字中不存在的信息时，必须提供等价文本；
- 不使用 Emoji、Unicode 符号或单字母替代产品图标；
- 不通过颜色单独表达确认、冲突、过期和错误。

### 11.3 自定义领域符号

允许项目自有 SVG 用于：

- PandaAtlas 标志；
- 地图点型；
- 迁移事件；
- 谱系关系；
- 许可允许的机构标志。

对应 registry 必须定义：

- 稳定语义名称；
- 图例文字；
- 非视觉等价描述；
- Token 映射；
- 选中、禁用和高对比状态。

## 12. 媒体架构

### 12.1 ArchiveMedia seam

建立共享 deep module，例如 `ArchiveMedia`，封装 `next/image` 和媒体状态。

Interface 接收公开投影已经提供的媒体描述：

- 资源位置；
- 媒体类型；
- 宽高或比例；
- 替代文本；
- caption；
- credit；
- license / provenance 引用；
- focal point；
- 媒体状态。

Implementation 负责：

- 响应式 `sizes`；
- 长宽比稳定；
- loading 策略；
- 焦点裁切；
- 加载失败与无媒体状态；
- caption、credit 与许可入口；
- 语言化替代文本；
- 减少布局位移。

Feature 不得重复直接配置 `next/image` 或自行创造无图状态。

### 12.2 信息媒体与背景

- 传递档案信息的图片必须使用真实图像元素和合适替代文本；
- CSS background 只用于纯装饰纹理、渐变和氛围层；
- 熊猫照片、地图截图和来源图表不得作为无语义背景；
- 装饰图片使用空替代文本，不复述相邻标题。

### 12.3 视频与 embed

首个 Beta 不增加通用轮播、视频播放器或 embed 框架。

确有合规媒体时：

- 默认懒加载；
- 不自动播放；
- 不成为首屏关键事实依赖；
- 提供标题、说明或替代路径；
- 第三方脚本通过独立 adapter 隔离。

### 12.4 地图底图 adapter

地图底图属于 `map` feature 的 adapter，不属于通用媒体 module。

Map adapter 统一拥有：

- 供应商配置；
- attribution；
- 许可链接；
- 加载失败处理；
- 结构化列表降级；
- 外部网络和性能边界。

Attribution 不得被抽屉、控制栏或移动布局遮挡。

### 12.5 内容治理边界

本文只决定媒体如何进入和呈现系统。

以下内容由后续 [Define content, data-honesty, media, and UI-state rules](https://github.com/SwayingWindmill/PandaAtlas/issues/36) 决定：

- 发布来源标准；
- 许可最低要求；
- illustrative 与真实档案媒体标签；
- 过期、撤回和未知版权；
- 外部链接、截图和 embed 治理。

## 13. 动效基础设施

### 13.1 动效分类

只允许四类动效。

#### 状态反馈

用于按钮按下、选中、焦点和加载完成，时长最短，不移动主要内容。

#### 结构转换

用于菜单、Dialog、Drawer、Disclosure 和 Tabs，帮助理解界面关系，必须保持焦点和阅读顺序。

#### 空间导航

用于地图视口、谱系焦点和选中对象定位。只在帮助理解空间变化时使用，不自动连续漫游。

#### 编辑性进入

只用于首页和审核故事中的少量淡入。不得用于关键事实、搜索结果或每张卡片的交错入场。

### 13.2 Motion tokens

Foundation 提供少量语义 Token：

```text
motion-instant
motion-fast
motion-standard
motion-deliberate
ease-standard
ease-enter
ease-exit
```

组件不得自行使用任意 `duration-300`、`duration-700` 或内联 `animationDelay`。

### 13.3 动画属性

默认只动画：

- `opacity`；
- `transform`；
- 必要的颜色变化。

不得常规动画：

- 高度和宽度；
- 页面主布局位置；
- 大面积阴影；
- filter 与 blur；
- 导致高频 layout 或 paint 的属性。

### 13.4 减少动画

`prefers-reduced-motion` 下：

- 移除装饰性进入、缩放、漂移和视差；
- 地图和谱系使用即时定位或极短淡化；
- 保留必要状态变化，但不依赖运动表达；
- loading 使用静态或低干扰反馈，不以持续脉冲作为唯一提示。

当前全局 `!important` 清零所有动效的方式应迁移为 Foundation 与 module 级降级，避免破坏浏览器和第三方控件的必要行为。

### 13.5 动画依赖

首个 Beta 不引入 Framer Motion 或其他通用动画框架。

只有同时满足以下条件才重新评估：

- CSS 无法可靠表达真实复杂手势或编排；
- 多个真实 module 共享同一复杂机制；
- 已评估 bundle、Client seam 和减少动画成本；
- 引入后形成 deep module，而不是页面直接调用动画库。

## 14. Server / Client Component seam

### 14.1 Server Component 默认

Route layout、page 和静态 pattern 默认保持 Server Component。

服务器拥有：

- locale、params 和 `searchParams` 解析；
- canonical、`hreflang` 和实体 metadata；
- 初始数据获取；
- 发布状态、404 与重定向；
- 结构化档案内容；
- 地图与谱系文字等价界面；
- 初始 loading、empty、error 和 degraded 语义；
- 向客户端传递最小可序列化 view model。

核心事实不得等待 hydration 后才出现。

### 14.2 Client Component 使用条件

合理客户端岛包括：

- 导航菜单；
- Dialog、Drawer 与 Popover；
- 搜索建议和输入防抖；
- 已加载结果的即时反馈；
- 地图平移、缩放与点选；
- 谱系图形焦点和局部展开；
- 本地收藏与最近浏览；
- 复制、分享和浏览器存储；
- 必要焦点恢复和状态通知。

“使用一个按钮”或“以后可能交互”不是添加 `"use client"` 的理由。

### 14.3 URL 是公开任务状态的事实来源

以下状态以 URL 为准：

- 查询；
- 筛选；
- 排序；
- 地图模式；
- 选中实体；
- 家族焦点；
- 比较对象；
- 时间范围。

Server Component 根据 URL 生成首个有效页面。Client 可以乐观更新 UI 和 URL，但刷新或直接打开必须得到等价结果。

菜单开关、悬停和未提交输入等暂时状态可以只在客户端存在。

### 14.4 Page view model seam

服务器不把完整 API client、repository 或大型原始响应传给客户端。

View model 只包含客户端需要的：

- 稳定 ID；
- 已本地化字段；
- 状态枚举；
- URL；
- 图形坐标或关系数据；
- 无障碍标签；
- 必要版本和时间信息。

可信结论、当前场所与关系判断留在服务器或领域层，浏览器不得重新实现。

### 14.5 地图与谱系渐进增强

推荐：

```text
Server page
├── 页面标题、说明和当前状态
├── 结构化列表或关系摘要
├── 普通链接、筛选表单与无 JS 路径
└── Client visualization island
```

禁止把完整页面放进一个巨大 Client Component，导致 hydration 失败时档案、关系或地图列表一起消失。

### 14.6 数据获取

- 首屏核心数据由服务器获取；
- 不在 `useEffect` 中重新请求服务器已有数据；
- 客户端只请求用户后续动作触发的增量数据；
- 增量请求必须处理失败、取消、竞态和 URL 恢复；
- 同一数据不得由 page、layout 与客户端分别重复请求。

### 14.7 Client deep modules

地图、谱系和本地偏好各自形成 deep module：

- 公开 interface 小而稳定；
- 内部可使用 reducer、adapter、hook 和局部状态；
- 页面不直接操作 MapLibre、localStorage 和布局算法；
- 测试跨 interface，而不是依赖内部 hook 结构。

### 14.8 Server Action

公开只读浏览不为了“现代化”而引入 Server Action。

Server Action 只用于真实服务器写操作、身份验证和可渐进增强表单。本地收藏继续在浏览器内，不伪装成账户同步。

## 15. Styling mechanism 边界

### 15.1 Tailwind utilities

用于：

- module 局部布局；
- flex、grid、间距和响应式排列；
- 已映射到语义 Token 的颜色、字号和形状；
- 简单 hover、focus 和状态样式。

### 15.2 CSS Modules

用于：

- 地图和谱系复杂几何；
- 多元素协同布局；
- module 私有动画；
- 无法合理表达为短 utility 组合的局部样式。

### 15.3 Global CSS

只用于：

- 文档 reset；
- Token；
- register；
- 字体；
- 减少动画基础规则；
- 明确隔离的第三方覆盖。

不得继续用全局 `.atlas-*`、`.map-*` 和 `.profile-*` selector 实现整页功能。

### 15.4 禁止新增 styling framework

首个 Beta 不引入：

- CSS-in-JS；
- 运行时主题库；
- 第二套 utility framework；
- 第二个完整组件库。

## 16. `globals.css` 目标

最终 `app/globals.css` 只作为导入入口：

```text
Tailwind base
Foundation tokens
Document base
Typography
Motion
Registers
Third-party isolated styles
```

推荐拆分：

```text
styles/
├── tokens.css
├── base.css
├── typography.css
├── motion.css
├── registers.css
└── third-party/
    └── maplibre.css
```

具体文件名可以调整，但不得再次形成一个拥有全部页面的单体文件。

## 17. MapLibre 样式隔离

MapLibre 原始样式和项目覆盖集中到 `styles/third-party/maplibre.css`。

每个覆盖必须：

- 针对稳定供应商 selector；
- 记录覆盖原因；
- 使用 Foundation Token；
- 不承担 PandaAtlas 页面布局；
- 在升级 MapLibre 时单独验证。

Popup 内容结构属于 map feature，不属于第三方 CSS 文件。

## 18. 渐进迁移策略

### 18.1 核心方法

采用 **绞杀式迁移、单一所有权、垂直切片删除**。

迁移期间，一个视觉或行为决定只能有一个当前所有者。

禁止：

- 新 Token 与旧原始色同时决定一个控件；
- CSS Module 与全局 selector 同时控制同一布局；
- 新 utility 通过 `!important` 压制旧 CSS；
- 新旧 Button 以路由差异长期并存；
- 新 shell 外继续包旧 `.atlas-site` 或 `.app-bg`。

### 18.2 兼容层规则

短期兼容层必须有：

- 明确调用方；
- 明确删除条件；
- 对应迁移切片；
- 禁止新调用方使用的检查。

不得建立永久 compatibility theme。

### 18.3 迁移阶段

#### 阶段一：建立 Foundation

- 新增 Token、字体、间距、焦点与动效尺度；
- 建立旧变量到新 Token 的临时映射；
- 建立基础架构检查；
- 不先批量重写所有页面。

#### 阶段二：迁移 primitives

- Button、Input、Select 等停止使用原始颜色和任意尺寸；
- 补齐基础交互 primitive；
- 统一焦点、禁用、错误和 loading 契约；
- 删除 primitive 中局部视觉体系。

#### 阶段三：建立 route shells

- 全语言 `app/[locale]`；
- Editorial 与 Product route group；
- 全局导航、搜索、容器和背景收敛；
- 删除页面重复 `SiteHeader` 与容器公式。

#### 阶段四：建立 shared patterns

优先建立：

- GlobalSearch；
- PageHeader；
- FactList；
- VerificationStatus；
- SourceDisclosure；
- Empty / Error / Degraded state；
- SectionNavigation。

#### 阶段五：按真实旅程迁移 feature

建议顺序：

1. 图鉴与可信档案；
2. 家族；
3. 地图；
4. 机构与场所；
5. 我的熊猫。

#### 阶段六：删除旧所有权

每个切片完成后立即删除：

- 对应全局 selector；
- 旧页面组件；
- 旧变量；
- 不再使用的兼容 adapter；
- 重复测试 fixture。

不得把删除工作统一拖到最后。

### 18.4 垂直切片完成定义

每个迁移切片必须同时包含：

- 语义 Token；
- primitive / pattern；
- Server/Client seam；
- 响应式行为；
- 键盘和读屏；
- 减少动画；
- loading、empty、error 与 degraded；
- 视觉验证；
- 对应旧 CSS 删除。

仅拆 CSS 文件、重命名颜色或替换 Card 不构成完成切片。

### 18.5 首个实施切片

首个切片确定为：

> **语言化 Product Shell + 全局导航 + 全局搜索 + 一个可信个体档案首屏。**

该切片验证：

- Locale shell；
- Product register；
- Foundation Token；
- 新 primitives；
- GlobalSearch、PageHeader 与 FactList；
- Server Component 默认；
- 小型本地收藏 Client island；
- 双语；
- 移动端；
- 来源和状态语义；
- 旧可信档案样式删除。

地图和谱系高交互复杂度不应成为首个切片的前置条件。

## 19. 现有 shadcn-style primitives 的政策

PandaAtlas 保留“源码归项目所有”的 shadcn-style 模式。

原因：

- 当前技术栈已经适配；
- 可以按项目 Token 与无障碍要求修改；
- 不需要引入完整外部视觉体系；
- 适合建立小而稳定的 primitive interface。

但不得把 shadcn 示例代码视为不可修改的规范。所有 primitive 必须遵守 PandaAtlas Foundation、中文/英文、触控、键盘、读屏和减少动画要求。

## 20. Headless 依赖政策

Radix 或同类 headless 依赖只在以下情况按 primitive 增量引入：

- 复杂键盘和焦点行为真实存在；
- 自行实现的风险明显更高；
- 现有平台 primitive 不足；
- 可以形成深 module；
- 已验证 bundle 和 Client boundary。

不因视觉偏好或减少几行代码而引入依赖。

## 21. 新依赖准入

任何新前端依赖必须记录：

- 解决的具体机制缺口；
- 为什么现有平台、当前 primitive 或 Radix 不足；
- bundle 和客户端边界影响；
- 无障碍与降级行为；
- 维护状态；
- 许可；
- 替换或退出成本。

默认不批准：

- 第二个完整组件库；
- 通用动画框架；
- 运行时主题库；
- CSS-in-JS；
- 只为一个视觉效果存在的依赖。

## 22. 模块依赖规则

### 22.1 允许方向

```text
app
  ↓
features / patterns
  ↓
ui
  ↓
foundation
```

### 22.2 禁止方向

- `ui` 不得导入 `patterns`、feature 或 `app`；
- `patterns` 不得导入具体 feature 或 `app`；
- feature 不得导入另一个 feature 的私有 implementation；
- `app` 只能通过 feature 公开 interface 使用 module；
- 公开代码不得导入 `admin`；
- Foundation 不得依赖 React page、领域实体或 route；
- admin 需求不得扩大公开 module interface。

### 22.3 Feature 公开入口

每个 feature 提供窄公开入口，例如：

```text
features/map/index.ts
features/lineage/index.ts
```

调用方不得 deep import：

- 私有 hook；
- reducer；
- adapter；
- CSS Module；
- 内部 view model transformer。

## 23. 受限导入

通过 ESLint 与项目检查限制：

- 只有图标 registry 直接导入 `lucide-react`；
- 只有 ArchiveMedia seam 直接导入 `next/image`；
- 只有地图 adapter 直接导入 `maplibre-gl`；
- 只有本地偏好 module 直接访问 `localStorage`；
- page 不得通过底层 primitive 重建已有 shared pattern；
- 公开 feature 不得读取后台 client 或内部发布字段。

## 24. 样式所有权检查

增加项目脚本检查：

- TSX 中新增十六进制、`rgb()` 或 `rgba()`；
- Foundation 之外新增全局 CSS 变量；
- `globals.css` 中出现 page 或 feature selector；
- primitive 使用任意颜色、字号、圆角或阴影；
- page 复制容器宽度公式；
- 非 registry 位置定义地图、关系或状态色；
- 新增内联 `fontSize`、`animationDelay` 或任意基础视觉值。

数据几何、固有比例和第三方兼容例外进入显式 allowlist。

## 25. Client boundary 检查

自动检查与人工审查共同验证：

- `"use client"` 文件位于明确交互 module 或 primitive；
- Server page 不传递不可序列化对象；
- Client 不重新实现可信结论推导；
- 首屏数据不在 `useEffect` 无理由重复请求；
- 地图和谱系结构化等价内容不依赖 hydration；
- 页面级 Client root 数量不增加。

不以 Client 文件数量作为唯一指标，以 seam 是否清楚为判断标准。

## 26. 迁移预算

建立可下降、不可上升的预算：

- `globals.css` page / feature selector 数量；
- 原始色值数量；
- 旧 `.atlas-*`、`.map-*` 和 `.profile-*` selector 数量；
- 直接 `lucide-react` 导入点；
- 直接 `next/image` 导入点；
- 直接 `maplibre-gl` 导入点；
- 页面级 `"use client"` 数量。

每个切片至少降低一项相关旧预算。新旧式用法增长直接阻断。

## 27. Shared module 注册评审

新增 shared primitive 或 pattern 前，PR 必须回答：

1. 是否已有相同语义和行为？
2. 是否至少有两个真实调用方？
3. Module 隐藏了什么复杂度？
4. 删除后复杂度会散落到哪里？
5. 它属于 primitive、pattern 还是 feature？
6. 键盘、读屏、loading、error 与减少动画契约是什么？
7. Interface 是否让调用方知道了 implementation 细节？

没有第二个真实调用方时，默认留在 feature 内。

## 28. 架构例外

例外必须进入版本控制 allowlist，包含：

- 文件或规则范围；
- 具体原因；
- 责任 module；
- 删除条件；
- 对应迁移票或阶段。

禁止：

- 永久通配例外；
- 无删除条件的 lint disable；
- 为赶迁移而关闭整条检查；
- 把例外变成新代码的默认模式。

## 29. 默认 CI 架构检查

前端变更至少运行：

```text
lint
typecheck
architecture:imports
architecture:styles
architecture:client-boundaries
```

本票只定义系统所有权和检查职责。视觉回归、性能预算、内容真实性和人工验收的最终发布门禁由后续 [Define frontend quality gates and visual verification](https://github.com/SwayingWindmill/PandaAtlas/issues/38) 决定。

## 30. 架构验收场景

后续实施至少验证：

1. `app/layout.tsx` 不包含页面构图或公共导航。
2. 所有公开路由位于有效 locale shell 下。
3. Editorial 与 Product register 不改变 URL。
4. 两个 register 共享同一导航和可信状态语义。
5. Page 不重复解析 locale 或生成语言切换 URL。
6. `globals.css` 只保留导入和全局机制。
7. MapLibre 覆盖进入独立第三方样式文件。
8. UI primitive 不使用原始颜色和任意基础尺度。
9. Feature 不定义全局 CSS 变量。
10. 图标只能通过项目 registry 使用。
11. 业务媒体只能通过 ArchiveMedia seam 使用。
12. 地图供应商只通过 map adapter 使用。
13. 本地收藏只通过 preferences module 访问存储。
14. 核心档案事实由 Server Component 输出。
15. 地图和谱系客户端失败时，结构化任务仍可完成。
16. URL 状态刷新后与客户端状态等价。
17. 无 JavaScript 时仍可阅读档案、关系和足迹。
18. 减少动画下没有装饰性入场或空间漫游。
19. 新 shared pattern 至少有两个真实调用方。
20. 每个迁移切片删除对应旧 selector 和旧 module。
21. 架构预算不增加。
22. 新依赖具有完整准入记录。
23. Admin 不决定公开 module interface。
24. 首个 Product Shell 切片覆盖中英文、移动端、键盘和读屏。

## 31. 对后续 Wayfinder 票的约束

### Define content, data-honesty, media, and UI-state rules

必须使用本文定义的：

- VerificationStatus；
- SourceDisclosure；
- Empty / Error / Degraded patterns；
- ArchiveMedia seam；
- 语义状态 Token；
- Editorial / Product register。

该票决定内容和媒体何时可以进入这些 module，而不是重新定义呈现架构。

### Prototype the cross-surface PandaAtlas design language

原型必须遵守：

- 两个 register；
- 语义 Token；
- 四种容器；
- primitive / pattern / feature 边界；
- Server-first 结构；
- 地图和谱系结构化等价界面；
- 受控动效与减少动画。

原型不得通过未登记任意色值和一次性组件形成第三套系统。

### Define frontend quality gates and visual verification

质量门禁必须把以下检查纳入默认流水线：

- import direction；
- style ownership；
- Client seam；
- 迁移预算；
- Token 和 register 覆盖；
- 双语和响应式截图；
- 结构化降级路径；
- bundle 和性能影响。

### Create the phased frontend implementation handoff

实施计划必须采用本文的垂直切片策略，并以首个 Product Shell 切片开路。不得把“拆 globals.css”“替换所有 Card”或“批量移动文件”作为独立用户价值阶段。

## 32. 非目标

本文不决定：

- 最终 Token 具体色值；
- 精确字体文件选择；
- 每个 primitive 的最终 props；
- 高保真页面视觉稿；
- 内容状态文案；
- 媒体许可最低标准；
- 地图供应商更换；
- 领域 API 与数据库重设计；
- 完整后台重构；
- 深色主题实现；
- 账户同步和通知。

这些内容由后续票或独立工作决定，但不得破坏本文的所有权、依赖方向和渐进迁移规则。

## 33. 最终决议

PandaAtlas 的前端一致性不由“所有页面都使用同一种卡片和阴影”产生，而由以下机制共同保证：

> Foundation 统一稳定语义，primitives 统一基础交互，shared patterns 统一跨页面产品行为，register 控制品牌与产品呈现语域，feature modules 保留真实领域差异，route shell 编码持续上下文，Server Components 交付可信任务基础，Client islands 只增强即时交互。

系统迁移的成功标准不是新建了多少 Token 或 module，而是每完成一个公共旅程，都能明确回答：

- 谁拥有这个视觉和行为决定；
- 调用方需要知道什么；
- 无 JavaScript、移动端、键盘和读屏是否仍能完成任务；
- 哪一段旧所有权已经被删除；
- 什么自动检查防止它再次漂移。
