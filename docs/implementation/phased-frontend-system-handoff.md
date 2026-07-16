# PandaAtlas 前端系统分阶段实施交接

> Status: Accepted implementation handoff for [Create the phased frontend implementation handoff](https://github.com/SwayingWindmill/PandaAtlas/issues/39).
>
> Decision owner: PandaAtlas product owner.
>
> Decision date: 2026-07-16.
>
> Scope: Public frontend system migration from the current mixed legacy/trusted implementation to the approved bilingual, evidence-first PandaAtlas architecture.

## 1. 交接结论

PandaAtlas 前端必须通过**窄垂直切片、路由级绞杀迁移、单一所有权和同版本证据链**实施。

实施顺序是：

1. 建立语言化 Product Shell、可信搜索入口、可信档案首屏和最小质量证据管线；
2. 完成可信档案、来源、修订、媒体和真实性状态；
3. 完成语言化 Atlas 搜索、筛选、结果和 URL 状态；
4. 先建立结构化家族旅程，再增加同步谱系图；
5. 先建立结构化地图旅程，再增加同步 MapLibre 可视化；
6. 建立机构和场所实体页面；
7. 使用已经证明的 Foundation 重建语言化首页；
8. 建立本地“我的熊猫”；
9. 删除剩余兼容所有权并完成正式 Public Beta 证据包。

每个切片必须同时交付：

- 可运行的用户任务；
- 对应数据真实性契约；
- Server/Client seam；
- 双语、响应式、键盘和读屏行为；
- loading、empty、error、cached、partial、unavailable 和适用的领域状态；
- 自动、Staging 和人工证据；
- 对应旧路由、旧样式、旧 fixture 或旧 adapter 的删除。

一个切片若只移动文件、替换颜色、重命名组件或添加新的并行实现，不算完成。

实施 Agent 不需要重新决定产品方向、信息架构、设计语言、真实性模型或质量政策。遇到缺少的后端契约时，必须将切片标为 `BLOCKED` 并提出精确契约缺口，禁止在前端推导或补造事实。

## 2. 必须先阅读的规范

实施 Agent 按以下顺序读取：

1. [Frontend system audit](../research/frontend-system-audit-2026-07-15.md)
2. [Frontend design principles and standards](../design/frontend-design-principles-and-standards.md)
3. [Core public journeys and information architecture](../design/core-public-journeys-and-information-architecture.md)
4. [Frontend system boundary and token/component architecture](../architecture/frontend-system-boundary-and-token-component-architecture.md)
5. [Content, data-honesty, media and UI-state rules](../design/content-data-honesty-media-and-ui-state-rules.md)
6. [Cross-surface design language direction](../design/cross-surface-design-language-direction.md)
7. [Frontend quality gates and visual verification](../release/frontend-quality-gates-and-visual-verification.md)
8. [WCAG 2.2 Level AA launch evidence baseline](../release/wcag-2.2-aa-evidence-baseline.md)

本文件只编排实施，不重复定义这些政策。

冲突优先级保持：

1. 产品事实、隐私与领域边界；
2. WCAG 2.2 A/AA 和核心任务；
3. 内容真实性、来源与媒体权利；
4. 已批准的信息架构、系统架构和质量门禁；
5. 实现便利性和视觉偏好。

## 3. 建议 Agent 工作流

每个实施切片建议使用：

- `implement`：按本交接实施；
- `tdd`：先固定 adapter、view model、URL、状态和关键交互 seam；
- `codebase-design`：只在既有边界内深化 module interface，不重新设计产品；
- `code-review`：在提交前按 Standards 和 Spec 两条轴审查。

实现期间：

- 经常运行相关单测、typecheck 和定向 Playwright；
- 每个可删除旧所有权的提交立即删除，不建立“以后统一清理”的债务；
- 一个 PR 只完成一个本文件定义的切片或一个明确子切片；
- 每个 PR 必须产生 Frontend Release Evidence Manifest；
- 完整测试和 code review 在切片结束时执行。

## 4. 不可重新讨论的产品决策

实施不得重新打开以下问题：

- 所有公开页面使用 `/{locale}`，首个 Beta 为 `zh` 和 `en`；
- `/{locale}/atlas/{pandaSlug}` 是唯一公开个体档案；
- 首页用于理解和进入，不是 Dashboard；
- Atlas 用于搜索和发现，不使用无审计“热门”排序；
- Profile 用于理解一个个体，事实、状态、来源和修订优先；
- Lineage 与 Map 的结构化表示是一等旅程，不是失败 fallback；
- Institution 和 Place 是不同领域实体；
- My Pandas 仅为本地收藏和最近浏览，不含账户或社交；
- A 温暖档案是共享基础；B 证据台账是证据密集模式；C 路径图谱只用于空间和关系任务；
- Public Content Envelope、三维真实性模型和媒体 fail-closed 是强制契约；
- 自动化、不可变 Staging 和人工签核构成三层证据；
- 缺少适用证据为 `BLOCKED`，不是 `PASS`；
- 已知 WCAG A/AA、真实性、安全和媒体权利问题不可豁免。

## 5. 当前仓库起点

当前公开实现是混合系统：

| 当前路径 | 当前状态 | 迁移判断 |
| --- | --- | --- |
| `/` | 硬编码首页、无来源指标和实现评论 | 不可保留为回滚目标 |
| `/atlas` | 客户端搜索、无审计 ranking、静默 fallback | 必须由语言化 Atlas 取代 |
| `/atlas/[slug]` | 生成式旧档案、无来源故事和媒体重标 | 必须停止渲染，仅允许重定向或可信不可用状态 |
| `/zh/atlas/[slug]`、`/en/atlas/[slug]` | 当前最可信的双语档案 | 保留语义，迁入新 shell 和 module ownership |
| `/lineage` | 高交互图、无完整结构化等价、静默 fixture | 先结构化重建，再接图形增强 |
| `/global-distribution` | 有用地图工作区，但语言、URL、等价列表和 attribution 不完整 | 先结构化重建，再接地图增强 |
| `/map` | 旧 alias | 最终只做语言化重定向 |
| `/admin/imports` | 专业工具 | 不在公开系统重设计范围，只共享安全 Foundation |

当前关键遗留所有权：

- `apps/web/app/globals.css` 同时拥有多个 surface；
- `apps/web/lib/api-client.ts` 对多个公共读取执行静默 fixture fallback；
- `apps/web/lib/panda-profile.ts` 生成无来源 profile 表达；
- `apps/web/lib/atlas-presenters.ts` 生成 popularity、标签、摘要和图片；
- `apps/web/components/lineage/lineage-explorer.tsx` 混合领域转换、算法、交互、渲染和无障碍；
- `apps/web/components/atlas/map-stage.tsx` 混合 provider、camera、数据同步和 UI；
- `apps/web/components/atlas/global-distribution-shell.tsx` 承担过多状态；
- `apps/web/components/atlas/atlas-browser.tsx` 在客户端承担完整查询工作区；
- `apps/web/components/site/site-header.tsx` 移动端隐藏主导航；
- 当前 middleware 只推断页面语言，不实现规范路由解析和重定向。

这些文件不是默认删除清单。只有对应切片建立新所有权、测试通过并完成路由 cutover 后才删除。

## 6. 目标路由树

```text
apps/web/app/
├── layout.tsx
├── [locale]/
│   ├── layout.tsx
│   ├── (editorial)/
│   │   ├── layout.tsx
│   │   └── page.tsx                       # /{locale}
│   └── (product)/
│       ├── layout.tsx
│       ├── atlas/
│       │   ├── page.tsx                   # /{locale}/atlas
│       │   └── [slug]/page.tsx            # /{locale}/atlas/{slug}
│       ├── lineage/page.tsx               # /{locale}/lineage
│       ├── map/page.tsx                   # /{locale}/map
│       ├── institutions/[slug]/page.tsx   # /{locale}/institutions/{slug}
│       ├── places/[slug]/page.tsx         # /{locale}/places/{slug}
│       └── my-pandas/page.tsx             # /{locale}/my-pandas
├── admin/
└── api/admin/
```

无语言前缀路径只做语言解析和重定向：

- `/`
- `/atlas`
- `/atlas/{slug}`
- `/lineage`
- `/map`
- `/global-distribution`
- `/institutions/{slug}`
- `/places/{slug}`
- `/my-pandas`

重定向必须保留适用的 query、anchor、mode、focus、filters、selection 和 time-range 状态。

## 7. 目标代码所有权

```text
apps/web/
├── app/                         # 路由编排、metadata、boundaries
├── components/
│   ├── ui/                      # 无领域 primitive
│   └── patterns/                # 跨 feature 产品 pattern
├── features/
│   ├── search/
│   ├── atlas/
│   ├── profile/
│   ├── lineage/
│   ├── map/
│   ├── institutions/
│   ├── places/
│   └── my-pandas/
├── foundation/
│   ├── content/                 # locale、glossary、状态 registry
│   ├── icons.ts
│   ├── media/
│   └── preferences/
└── styles/
    ├── tokens.css
    ├── base.css
    ├── typography.css
    ├── motion.css
    ├── registers.css
    └── third-party/maplibre.css
```

所有权规则：

- `app` 不执行复杂领域转换；
- Server page/loaders 读取已验证 adapter，生成 page view model；
- `components/ui` 不知道 panda、source、map 或 lineage；
- `components/patterns` 可以知道事实状态、来源和通用任务状态，但不拥有领域查询；
- `features/*` 通过公开入口导出，不允许跨 feature 深层导入；
- Map 和 Lineage 的 client island 只能消费已准备好的稳定 view model；
- `globals.css` 最终只负责导入和极少 root 基线，不继续拥有 feature；
- prototype route、mock CSS 和 mock fixture 不复制到生产。

## 8. 实施单位和完成定义

### 8.1 一个切片的最小内容

每个切片必须定义：

- 用户任务；
- route scope；
- data contract；
- module owner；
- server/client boundary；
- URL state；
- applicable UI states；
- locale scope；
- old ownership deleted；
- automated evidence；
- Staging evidence；
- human evidence；
- rollback boundary；
- explicit non-goals。

### 8.2 切片通过条件

切片只有在以下条件全部满足时完成：

- 规范任务可在中英文适用范围完成；
- 没有静默 demo、fixture 或语言 fallback；
- 所有适用状态已实现并测试；
- canonical、hreflang 和旧路径行为正确；
- 结构化任务不依赖图形、颜色、hover 或 drag；
- 适用 Default Gate、Staging 和人工证据完整；
- 旧 route/component/style/fixture 所有权已删除或进入具名兼容 ledger；
- 兼容 ledger 有删除切片，且禁止新调用方；
- PR 通过 `code-review` 的 Standards 和 Spec 两条审查。

### 8.3 不允许的“完成”

以下不构成切片完成：

- 新旧页面长期并存；
- 只在新 route 上复制旧组件；
- 用 `!important` 压旧 CSS；
- 只添加 axe 初始页扫描；
- 只提供桌面成功态截图；
- 把结构化地图或谱系留到“无障碍以后”；
- 把媒体 manifest、source、Last verified 或 delivery 留到后续；
- 通过 mask、宽松截图阈值或跳过测试获得绿色；
- 以旧生成式页面作为 rollback。

## 9. 合并、公开启用和发布波次

切片可以在不可变 Staging 上独立验证，但公开 route cutover 按波次进行，避免新 shell 导航到未完成的目标页面。

### Wave A — 查证主链

包含：

- Slice 1：Localized trust spine；
- Slice 2：完整可信档案；
- Slice 3：完整 Atlas。

Wave A 完成后公开启用：

- `/{locale}` 的最小任务入口；
- `/{locale}/atlas`；
- `/{locale}/atlas/{slug}`；
- `/`、`/atlas`、`/atlas/{slug}` 的语言化重定向。

### Wave B — 关系和空间探索

包含：

- Slice 4：结构化 Lineage；
- Slice 5：Lineage 可视化；
- Slice 6：结构化 Map；
- Slice 7：Map 可视化。

Wave B 完成后公开启用：

- `/{locale}/lineage`；
- `/{locale}/map`；
- `/lineage`、`/map`、`/global-distribution` 重定向。

结构化 Slice 4 或 Slice 6 可以先公开，图形 Slice 5 或 Slice 7 失败时仍保留完整任务。

### Wave C — 网络扩展和入口完善

包含：

- Slice 8：Institution 与 Place；
- Slice 9：Editorial Home；
- Slice 10：My Pandas。

### Wave D — 系统关闭和 Public Beta

包含：

- Slice 11：兼容层关闭、架构门禁和遗留删除；
- Slice 12：正式 Release Evidence Package 和发布决策。

## 10. 依赖图

```text
Slice 1  Localized trust spine
  ├── Slice 2  Trusted profile completion
  │     ├── Slice 4  Structured lineage
  │     │     └── Slice 5  Lineage visualization
  │     ├── Slice 6  Structured map
  │     │     └── Slice 7  Map visualization
  │     └── Slice 10 My Pandas
  └── Slice 3  Localized Atlas
        ├── Slice 8  Institutions and places  ← also depends on Slice 6
        └── Slice 9  Editorial Home           ← also depends on Slice 2

Slices 2–10 ──> Slice 11 System closure ──> Slice 12 Public Beta evidence
```

允许并行：

- Slice 4 与 Slice 6 在 Slice 2 完成后可并行；
- Slice 5 与 Slice 7 可由不同 Agent 在各自结构化 seam 稳定后并行；
- Slice 9 与 Slice 10 在其依赖完成后可并行。

不允许并行：

- 同时修改 Foundation Token 或 Product Shell 的两个切片；
- 结构化 Lineage 与图形 Lineage 同时设计接口；
- 结构化 Map 与 Map provider adapter 同时猜测接口；
- 同一路由新旧所有者同时修改。

## 11. Slice 1 — Localized trust spine

### 11.1 用户任务

用户从语言化入口使用全局搜索确认一只熊猫，进入可信个体档案，立即看到身份、当前场所、结论状态、精度、Last verified 和来源入口。

这是第一个公共垂直切片，也是质量证据管线的第一个实现切片。

### 11.2 风险等级

`Level 3`。

原因：

- Global Product Shell；
- locale architecture；
- global navigation；
- global search；
- canonical profile；
- Public Content Envelope；
- focus 和 route semantics；
- 首批截图和人工读屏证据。

### 11.3 Route scope

实现或重写：

- `app/[locale]/layout.tsx`；
- `app/[locale]/(product)/layout.tsx`；
- `app/[locale]/(editorial)/page.tsx` 的最小任务入口；
- `app/[locale]/(product)/atlas/page.tsx` 的最小搜索结果契约；
- `app/[locale]/(product)/atlas/[slug]/page.tsx` 的可信首屏；
- root、`/atlas`、`/atlas/[slug]` 的 staging cutover/redirect 契约；
- route-level `loading.tsx`、`error.tsx`、`not-found.tsx` 和适用 unavailable boundary。

本切片的 `/{locale}/atlas` 只需完成：

- 接收 `q`；
- 返回已发布身份结果；
- 普通链接进入可信档案；
- empty、error、partial、cached、unavailable；
- 无未审计排序或图片。

完整筛选、排序、分页和混合实体结果属于 Slice 3。

### 11.4 Foundation scope

新增：

- `styles/tokens.css`；
- `styles/base.css`；
- `styles/typography.css`；
- `styles/motion.css`；
- `styles/registers.css`；
- locale parser 和 supported-locale registry；
- route-safe language preference resolver；
- shared focus style；
- reduced-motion foundation；
- Product register container 和 responsive shell。

Root layout 必须停止渲染旧 `.app-bg` 所有权。

不得在本切片引入第二个 styling framework。

### 11.5 Primitive 和 pattern scope

迁移或建立：

- Button；
- Input；
- Select 仅在最小结果需要时；
- SkipLink；
- GlobalNavigation；
- MobileNavigation；
- GlobalSearch；
- PageHeader；
- FactList；
- VerificationStatus；
- SourceDisclosure；
- DeliveryNotice；
- StateMessage；
- no-media-safe identity region。

GlobalSearch 必须：

- 支持键盘建议；
- 不截获输入框普通方向键；
- Enter 可完成任务；
- URL 写入 `q`；
- 无结果不声明现实中不存在；
- 中英文 aliases 指向同一 stable identity。

### 11.6 数据契约

建立严格 `Public Content Envelope` adapter，首批覆盖：

- identity resolution；
- minimal Atlas search；
- trusted profile above-the-fold facts；
- source summary；
- release、delivery、locale、coverage。

关键事实 view model 至少包含：

- value；
- conclusion status；
- freshness；
- precision；
- source IDs；
- Last verified；
- display label；
- locale translation state。

不允许：

- API 失败返回成功形状 fixture；
- `name_en ?? name_zh` 无标记 fallback；
- generic panda image；
- local popularity 或 profile preset；
- HTTP 200 自动等于 live。

如现有 Public API 不能提供必要 metadata：

1. adapter 返回 `BLOCKED`/unavailable；
2. 创建精确后端契约缺口；
3. 不从旧 fixture 或 UI 文案推断。

### 11.7 Profile 首屏内容

必须显示：

- 中文/英文主要名称和必要原文名称；
- stable identity；
- life status；
- birth/death date 与精度；
- current place 与 place precision；
- conclusion status；
- Last verified；
- fact-level source action；
- page-level source summary；
- dataset release / delivery 状态；
- no-media 或 approved media state；
- local favorite Client island；
- family 和 footprint 的结构化摘要入口。

Family/footprint 入口在本切片可指向同页的最小 server-rendered summary anchor。不得链接到不存在或不可信的未来 route。

### 11.8 Server/Client seam

Server Component 默认：

- locale 解析；
- metadata；
- identity resolution；
- envelope 加载；
- page view model；
- facts、sources 和 summaries；
- no-JS 可读输出。

Client island 仅限：

- mobile navigation open/close；
- search suggestion interaction；
- local favorite；
- 必要 disclosure。

不得把整个 shell、profile 或 result list 标为 Client Component。

### 11.9 URL 和 metadata

必须实现：

- canonical `/{locale}/atlas/{canonicalSlug}`；
- `zh-CN`、`en` hreflang；
- `x-default`；
- old slug 永久重定向；
- query 和 anchor 保留；
- invalid locale 404 或规范重定向；
- unpublished entity 不泄露存在性；
- preview/demo 不进入 sitemap、canonical 或 structured data。

### 11.10 状态矩阵

至少实现并测试：

- live；
- initial loading；
- search empty；
- route error；
- not found；
- cached；
- partial；
- unavailable；
- no-media；
- source-link-only；
- missing translation；
- old slug redirect。

### 11.11 质量管线

本切片同时建立：

- Frontend Release Evidence Manifest schema v1；
- `PASS`、`FAIL`、`BLOCKED`、`NOT_APPLICABLE_WITH_REASON` 校验；
- PR risk declaration；
- path-based minimum risk computation；
- 现有 release gate 的 manifest 输出；
- 可识别的 reproducibility、static、public contract、browser、accessibility、visual check group；
- screenshot inventory schema；
- Linux Chromium mobile/desktop 基线；
- route/shared bundle report；
- immutable Staging identity record。

不要求一次完成质量规范的全部最终功能，但缺失的本切片适用证据不得报告为通过。

### 11.12 自动验收

至少包括：

- Linux 和 Windows clean checkout；
- lint、typecheck、production build；
- envelope contract；
- locale parity for identity/facts/sources；
- no-demo/silent-fallback assertions；
- canonical 和 redirect tests；
- search-to-profile smoke；
- mobile navigation complete process；
- keyboard search、nav、source 和 favorite；
- dynamic axe scans；
- axe incomplete retention；
- 320 × 800 reflow；
- 390 × 844 和 1440 × 900 screenshots；
- focus not obscured；
- reduced motion；
- no-JS profile facts and sources；
- shared JS ≤ 110 KiB；
- Home/minimal entry ≤ 140 KiB；
- minimal Atlas/Profile ≤ 170 KiB。

### 11.13 Staging 和人工证据

必须绑定同一 commit/build/deployment/Public Release。

人工至少完成：

- 中文 Edge + Narrator：入口、搜索、档案首屏、来源；
- 英文 Firefox + NVDA：相同任务；
- 键盘完整任务；
- 200% zoom 和 320 CSS px；
- 中英文语义与术语；
- no-media、cached、partial、unavailable 视觉判断；
- A foundation 与 B evidence 的设计评审。

### 11.14 必须删除或隔离的旧所有权

切片完成时：

- `app/atlas/[slug]/page.tsx` 不再渲染生成式 profile；
- `critical-public-journeys.spec.ts` 不再把 legacy profile 当成功旅程；
- root layout 不再使用 `.app-bg`；
- 新 shell 不使用旧 `SiteHeader`/`TopNav` 作为并行 owner；
- 旧生成式 profile 不得作为 rollback；
- 旧 route 若暂时保留文件，只能是 redirect adapter，并有 Slice 2 删除条件；
- 不具媒体 manifest 的 asset 不进入新 route。

### 11.15 Rollback boundary

允许 rollback：

- 回到上一个可信 profile release；
- 关闭新的搜索 suggestion client island，保留 server result list；
- 关闭新视觉 register，回到同一可信 view model 的最小结构化呈现；
- 将 deployment 标为 unavailable 并保留来源和 release identity。

禁止 rollback：

- 重新启用生成式 `/atlas/[slug]`；
- 重新启用静默 fixtures；
- 重新使用无许可 generic media；
- 重新使用无来源 popularity 或 profile preset。

### 11.16 非目标

- 完整 Atlas filters/sort/pagination；
- 完整 profile timeline/story/media gallery；
- Lineage graph；
- MapLibre；
- Editorial Home 完整章节；
- Institution、Place、My Pandas 完整页面；
- 全量 CI 重写。

### 11.17 建议提交序列

1. Evidence Manifest schema、risk classifier 和 compatibility ledger；
2. Foundation styles、locale registry 和 root/locale shell；
3. primitives 和 global navigation；
4. strict envelope adapter 和 view model tests；
5. minimal GlobalSearch/Atlas result route；
6. trusted profile above fold；
7. state boundaries、redirect 和 legacy profile containment；
8. screenshots、browser/accessibility tests 和 Staging record；
9. delete unreachable legacy ownership；
10. final code review and full gate。

每个提交必须可 typecheck；不得在中间提交把 production route 指向 fixture。

## 12. Slice 2 — Complete trusted profile

### 12.1 用户任务

用户在一个档案中理解个体身份、时间线、家族、足迹、媒体、来源和修订，并能分辨 confirmed、provisional、disputed、stale、partial 和 cached。

### 12.2 依赖与风险

- 依赖 Slice 1；
- `Level 2`，若修改 shared focus/ARIA 或 Public Content Envelope 则升级 `Level 3`。

### 12.3 Route scope

- `/{locale}/atlas/{slug}` 完整稳定章节；
- overview、story、timeline、family、footprint、media、sources/revisions；
- section anchor 写入 URL；
- no-JS 可读。

### 12.4 实施内容

建立 `features/profile` 深模块：

- server loader；
- public view model；
- identity hero；
- fact groups；
- timeline；
- family summary；
- footprint summary；
- media state；
- source and revision record；
- local favorite island。

Story 只能使用 reviewed editorial content。没有已审核内容时不生成故事占位。

### 12.5 状态和真实性

必须覆盖：

- unknown fact；
- provisional relation；
- disputed candidates；
- superseded revision；
- stale current place；
- changed/restricted source；
- no-licensed-media；
- source-link-only；
- withdrawn media；
- partial timeline；
- no published relation；
- cached profile；
- unavailable module。

### 12.6 删除边界

完成后删除：

- `lib/panda-profile.ts` 及其 presets；
- legacy profile page rendering；
- generic/relabelled gallery mapping；
- 旧 profile-specific 全局 CSS；
- 只服务旧 profile 的 fixture 和测试。

### 12.7 验收证据

- profile 全章节双语；
- 事实/source/revision parity；
- keyboard section navigation；
- 读屏完整档案任务；
- 200% text、400%/320 CSS px；
- no-media 和 long-content screenshots；
- media manifest gate；
- source URL Staging check；
- no-JS；
- route budget ≤ 170 KiB。

### 12.8 Rollback

回到同一 strict envelope 的简化 Slice 1 profile，不回到 legacy generated profile。

## 13. Slice 3 — Localized Atlas search and discovery

### 13.1 用户任务

用户搜索、筛选、排序、翻页、分享结果状态，并从结果进入唯一可信档案。

### 13.2 依赖与风险

- 依赖 Slice 1；
- 建议在 Slice 2 后公开 cutover；
- `Level 2`。

### 13.3 Route 和 URL scope

`/{locale}/atlas` 支持受控 URL 状态：

- `q`；
- filters；
- sort；
- page/cursor；
- view mode，如确有两个受支持视图；
- locale switch 保留兼容状态。

无效参数必须规范化，不得 silently reset 成不同任务。

### 13.4 结果契约

结果按领域类型组织：

- panda；
- institution；
- place；
- 可发布的其他受控实体。

首批若 Institution/Place 页面尚未就绪：

- 可以只展示已拥有有效目的地的类型；
- 不显示 no-op CTA；
- 不用临时 route 猜测实体页面。

排序只允许：

- relevance，且方法有定义；
- name；
- 受控日期或发布字段。

禁止“热门优先”，除非未来另有审计指标政策。

### 13.5 架构

拆分当前 `atlas-browser.tsx`：

- server query parser；
- server search adapter；
- result view model；
- filter form；
- result summary；
- pagination；
- optional local interaction islands。

默认不把最多 100 条完整数据加载到客户端再过滤。

### 13.6 状态

- initial loading；
- refresh/pagination loading；
- empty query；
- empty filters；
- partial results；
- cached；
- unavailable；
- invalid URL state；
- long bilingual result；
- no-media。

### 13.7 删除边界

完成后删除或替换：

- `lib/atlas-presenters.ts` popularity、featured、tags、generic images；
- legacy `atlas-browser.tsx` 全客户端 owner；
- 旧 Atlas search/filter/sidebar components，除非迁入新公开 interface；
- `/atlas` 内容 page，仅保留 locale redirect；
- 旧 Atlas 全局 CSS；
- 依赖 legacy route 的 smoke tests。

### 13.8 证据

- URL restore/history；
- bilingual parity；
- no unsupported metrics；
- mobile filter sheet keyboard/focus；
- empty/error/partial/cached screenshots；
- structured result count scope；
- real API Staging；
- Atlas route ≤ 170 KiB；
- search/filter API p95 targets。

### 13.9 Rollback

回到 Slice 1 minimal server result list，不回到旧客户端 Atlas 或 popularity ranking。

## 14. Slice 4 — Structured lineage journey

### 14.1 用户任务

用户不依赖图形即可理解一只熊猫的父母、子女、关系方向、代际、证据状态、不确定性和可继续访问的档案。

### 14.2 依赖与风险

- 依赖 Slice 2；
- `Level 3`，因为核心关系语义和无障碍等价路径。

### 14.3 Route 和 URL

`/{locale}/lineage` 至少支持：

- `focus`；
- ancestor depth；
- descendant depth；
- compare entity，如已定义；
- relation filters，如有明确需求；
- selected relation；
- locale switch state preservation。

### 14.4 结构化表示

Server-rendered 结构至少提供：

- focus identity；
- parents；
- children；
- siblings/related paths，仅在定义明确时；
- direction；
- generation；
- conclusion status；
- source；
- unknown/provisional/disputed；
- 普通档案链接；
- result scope 和 depth。

数据必须直接消费 reviewed relationship assertions/edges，不从最终 `father_id`、`mother_id` 反推完整证据语义。

### 14.5 本切片不包含图形

可以提供“图形尚不可用”的 no-lineage-graph 状态，但结构化旅程必须完整。

### 14.6 删除和兼容

- `/lineage` 变为 locale redirect；
- legacy explorer 不再是 route owner；
- `LINEAGE_PANDAS` silent fallback 禁止进入 production；
- 旧 `lib/lineage-data.ts` fixture/转换只可在测试中保留，且明确命名；
- 旧图形组件可暂时保留为 Slice 5 的内部参考，但不得由 route import。

### 14.7 证据

- graph-free complete process；
- stable ID parity；
- Chinese/English relation wording；
- keyboard/reader relationship traversal；
- URL restore；
- provisional/disputed fixtures；
- no-JS；
- 320 CSS px；
- cached/partial/unavailable；
- immutable Staging real relationship release。

### 14.8 Rollback

保留结构化 journey，关闭任何未完成可视化。不得回到 legacy graph-only route。

## 15. Slice 5 — Lineage visualization enhancement

### 15.1 用户任务

用户通过图形探索关系，同时图形和结构化表示始终共享同一 focus、selection、scope、status 和 source。

### 15.2 依赖与风险

- 依赖 Slice 4；
- `Level 3`。

### 15.3 Module seam

建立：

- relationship graph model；
- deterministic layout module；
- viewport/zoom state；
- selection synchronization；
- reduced-motion preference adapter；
- graph client island；
- structured-view synchronization interface。

领域数据转换、layout 算法、camera、drawer 和渲染不得继续集中在一个组件。

### 15.4 无障碍和交互

- graph 不是唯一关系来源；
- keyboard 不需要遍历成百节点才能完成任务；
- drag 有 controls/structured alternative；
- focus 变化同步 URL 和结构化摘要；
- imperative motion 尊重 reduced motion；
- 图形失败立即保留结构化 view；
- graph node 的 accessible name 包含身份和关系上下文。

### 15.5 删除边界

完成后删除或拆除：

- legacy `lineage-explorer.tsx` monolith；
- silent static fallback；
- 独立文案 ownership；
- 旧 lineage 全局 CSS；
- 只测试“图可见”的旧 smoke。

### 15.6 证据

- structured/graph stable ID parity；
- selection parity；
- graph failure；
- reduced motion；
- pointer、keyboard、touch；
- short-height viewport；
- WebKit/Firefox screenshots；
- 真实 Safari + VoiceOver；
- route ≤ 220 KiB，graph chunk ≤ 180 KiB gzip。

### 15.7 Rollback

关闭 graph enhancement，结构化 Slice 4 保持完整。

## 16. Slice 6 — Structured map journey

### 16.1 用户任务

用户不依赖地图画布即可探索全球机构、个体足迹和野生保护范围，理解当前 mode、filters、snapshot、precision、selection 和来源。

### 16.2 依赖与风险

- 依赖 Slice 2；
- 与 Slice 4 可并行；
- `Level 3`。

### 16.3 Route 和 mode

`/{locale}/map` 支持三个清晰模式：

- institutions；
- individual footprint；
- wild conservation。

禁止把三种地理语义无区分叠加。

URL 至少包含：

- mode；
- focus panda/place/institution；
- filters；
- time range/snapshot；
- selected result；
- 适用 viewport state，只在分享任务确有意义时。

### 16.4 结构化表示

必须提供：

- 当前范围和 snapshot；
- result list；
- place/institution/panda identity；
- 公开位置精度；
- current/historical status；
- source 和 Last verified；
- filter controls；
- selection summary；
- ordinary links；
- provider unavailable 不影响的数据任务。

### 16.5 Provider 和媒体契约

本切片建立 Map provider registry，即使尚未加载 MapLibre：

- base-map provider；
- style license；
- attribution；
- screenshot/export policy；
- privacy；
- snapshot；
- failure behavior。

国家级数据不得投影成机构点。

### 16.6 兼容和删除

- `/map` 和 `/global-distribution` 变为 locale-aware redirect；
- legacy workspace 不再是 canonical route；
- 旧 `components/map/*` dead code 删除；
- `global-distribution-shell.tsx`、map-specific sidebar/summary 仅在迁入新公开 interface 后保留；
- 旧 fallback GeoJSON 必须变成正式 cached release 或从 production 删除。

### 16.7 证据

- no-map complete process；
- three modes；
- URL restore；
- precision assertions；
- attribution config；
- Chinese/English；
- keyboard/reader complete journey；
- 320 CSS px；
- provider failure；
- partial/cached/offline；
- real API and snapshot Staging；
- structured route ≤ 220 KiB。

### 16.8 Rollback

保持结构化 Map，关闭 provider/visual layer。不得回到 map-only workspace。

## 17. Slice 7 — Map visualization enhancement

### 17.1 用户任务

用户使用地图浏览可视对象，地图、列表和详情抽屉共享同一 query、selection、precision 和 source。

### 17.2 依赖与风险

- 依赖 Slice 6；
- `Level 3`。

### 17.3 MapLibre seam

建立：

- provider adapter；
- style/attribution adapter；
- map viewport domain；
- query scheduler；
- layer model；
- selection synchronization；
- camera preference service；
- map client island；
- error boundary。

MapLibre CSS 隔离到 `styles/third-party/maplibre.css`。

### 17.4 行为

- dynamic import；
- 不进入 shared bundle；
- map 与列表同步；
- 选择地图对象更新结构化详情；
- 选择列表对象更新地图但不丢焦点；
- reduced motion 禁止 timed flyTo；
- coarse pointer、单指、非 drag alternative；
- attribution 始终可见；
- provider failure 保留 Slice 6；
- network recovery 不重置 filters/selection。

### 17.5 删除边界

完成后拆除：

- legacy `map-stage.tsx` monolith；
- legacy `global-distribution-shell.tsx` orchestration；
- 旧 map overlay/state owner；
- 旧 map 全局 CSS；
- 无 attribution 的 style config；
- 只在 map failure 才出现的 text alternative。

### 17.6 证据

- map/list stable ID parity；
- provider failure；
- reduced motion imperative camera；
- keyboard、touch、screen reader；
- mobile portrait/landscape；
- short height；
- Firefox/WebKit；
- 真实 iOS Safari；
- map chunk ≤ 180 KiB gzip；
- viewport query p95 ≤ 1,200 ms；
- no map requests before feature activation。

### 17.7 Rollback

关闭 MapLibre client island，结构化 Slice 6 保持完整。

## 18. Slice 8 — Institution and Place entities

### 18.1 用户任务

用户理解机构组织和实际场所的不同语义，并从 Panda、Atlas 或 Map 继续查看当前/历史关联、迁移和来源。

### 18.2 依赖与风险

- 依赖 Slice 3 和 Slice 6；
- `Level 2`。

### 18.3 Routes

- `/{locale}/institutions/{institutionSlug}`；
- `/{locale}/places/{placeSlug}`；
- 对应无 locale redirect；
- old slug/canonical/hreflang。

### 18.4 Institution 必须提供

- organization identity；
- current/historical pandas；
- associated places；
- migration events；
- sources；
- revision/release state。

### 18.5 Place 必须提供

- physical place identity；
- public location precision；
- institution relationship；
- residency/migration records；
- sources；
- map structured entry。

不得把 institution 当作精确居住点，也不得把 place 当作组织。

### 18.6 证据

- cross-entity stable links；
- bilingual entity naming；
- precision；
- migration conclusion status；
- source and revision；
- no-media；
- Atlas and Map integration；
- canonical redirects；
- no-JS and mobile。

### 18.7 Rollback

相关链接回到 Panda/Map 的结构化摘要，不显示错误精度或临时合并实体。

## 19. Slice 9 — Editorial Home

### 19.1 用户任务

首次访问者理解 PandaAtlas 是可信、双语的动态档案馆，能够搜索、打开代表性档案、从关系或地点开始探索，并查看最近修订和档案方法。

### 19.2 依赖与风险

- 依赖 Slice 1、Slice 2、Slice 3；
- Map/Lineage entry 可在 Wave B 完成后启用；
- `Level 2`，若修改 Global Shell 则 `Level 3`。

### 19.3 Home sections

按 IA 实现：

1. product positioning and search；
2. representative published profiles；
3. relation/place exploration entries；
4. recent archive revisions；
5. trusted archive method。

### 19.4 内容规则

禁止：

- 无来源总体数量；
- views、followers、growth、social proof；
- 无目的地 CTA；
- 实现评论；
- generic/relabelled panda media；
- hero image 作为发布前提；
- 所有内容变成同构 card grid。

Representative profiles 必须明确 editorial selection，不冒充 popularity。

### 19.5 媒体

每个媒体 asset 必须通过 manifest。没有许可媒体时使用 A foundation 的 no-media-safe composition。

旧 `apps/web/public/home/*` 在没有 manifest 前视为 quarantined，不得继续引用。

### 19.6 删除边界

- 删除旧 root homepage markup、metrics 和 no-op CTA；
- 删除旧 home-specific 全局 CSS 和动画；
- 删除无 manifest 的未使用 home assets；
- root `/` 只做 locale resolution；
- `/{locale}` 成为 canonical Home。

### 19.7 证据

- bilingual Home；
- search task；
- real published selections；
- recent revision data；
- no unsupported metrics；
- media manifest；
- mobile/desktop visual baselines；
- 200%/320 CSS px；
- reduced motion；
- Home ≤ 140 KiB and transfer ≤ 500 KiB。

### 19.8 Rollback

回到 Slice 1 minimal language entry/search，不回到旧营销首页。

## 20. Slice 10 — My Pandas

### 20.1 用户任务

用户在本地回访收藏和最近浏览，能够打开档案、移除、清除，并理解数据只保存在当前浏览器。

### 20.2 依赖与风险

- 依赖 Slice 1 和 Slice 2；
- `Level 2`。

### 20.3 Route

`/{locale}/my-pandas`。

### 20.4 功能边界

包含：

- saved profile IDs；
- recent profile IDs；
- local storage disclosure；
- clear one/all；
- missing/withdrawn entity handling；
- ordinary profile links；
- no-JS 说明。

不包含：

- account；
- cloud sync；
- notification；
- social sharing；
- behavioral profile；
- recommendation ranking。

### 20.5 Client seam

Server page 输出说明和 empty shell；本地列表为小型 Client island。Client 只能存 stable IDs 和本地时间，不缓存或重写公共事实。

### 20.6 证据

- keyboard and screen reader；
- local data disclosure；
- clear controls；
- stale/withdrawn ID；
- locale switch；
- privacy review；
- no-JS；
- mobile screenshots。

### 20.7 Rollback

关闭 local Client island，保留说明和普通导航；不引入账户替代。

## 21. Slice 11 — System closure and deprecation completion

### 21.1 目标

删除所有已被新系统取代的公开所有权，使架构、路由和质量门禁只表达一个公共系统。

### 21.2 依赖与风险

- 依赖 Slices 2–10 的适用完成；
- `Level 3`。

### 21.3 必须完成

- 所有无 locale 内容 route 只做 redirect；
- 所有旧 profile/atlas/lineage/map render owner 删除；
- 所有兼容 adapter 达到删除条件；
- `globals.css` 不再拥有 feature；
- 禁止跨 feature deep import；
- 禁止新 raw color/radius/shadow/z-index ownership；
- 禁止新的静默 fallback；
- 禁止 production demo；
- 媒体 manifest 覆盖所有 public media；
- 状态 registry 覆盖所有 public surfaces；
- screenshot inventory 覆盖所有 canonical surfaces；
- Playwright Chromium/Firefox/WebKit matrix 可运行；
- 所有 route budgets 可读取并阻断；
- architecture and dependency checks 进入 Default Gate。

### 21.4 Legacy deletion checklist

逐项确认无 runtime/import/test dependency 后删除：

- old home implementation；
- old `/atlas` implementation；
- old `/atlas/[slug]` profile implementation；
- `panda-profile.ts`；
- `atlas-presenters.ts`；
- old Atlas browser/presentational components；
- old Lineage monolith and fallback dataset；
- old global distribution orchestration；
- dead `components/map/*`；
- old duplicate headers；
- old feature CSS blocks；
- duplicate fixtures and tests；
- expired compatibility allowlists；
- route aliases that are not required redirects。

### 21.5 证据

- dependency-cruiser 或等价 architecture checks；
- no dead route imports；
- no old CSS selectors used；
- no unmanifested public media；
- no silent-fallback patterns；
- clean checkout；
- full canonical redirect matrix；
- complete browser and state inventory。

### 21.6 Rollback

该切片的 rollback 只能恢复仍满足新真实性和质量政策的 compatibility adapter。不得恢复已删除的 untrusted public implementation。

## 22. Slice 12 — Public Beta release evidence

### 22.1 目标

对同一不可变 release artifact 形成完整自动、Staging 和人工证据，作出 `GO`、`NO_GO` 或 `BLOCKED` 决策。

### 22.2 依赖与风险

- 依赖 Slice 11；
- `Level 3` formal release candidate。

### 22.3 Default Gate

全部适用 check group 必须 `PASS`：

- reproducibility；
- static correctness；
- public contracts；
- media and content truth；
- browser journeys；
- automated accessibility；
- visual regression；
- performance budgets。

### 22.4 Immutable Staging

绑定：

- commit；
- build checksum；
- frontend deployment ID；
- API deployment ID；
- Public Release ID；
- Public Schema version；
- projection version；
- browser/tool versions。

执行：

- Chromium、Firefox、WebKit；
- cold/warm Lighthouse；
- 真实 API；
- fault injection；
- slow network/offline/recovery；
- source/media/provider validation；
- all canonical routes and states。

### 22.5 Human sign-off

最低完成：

- Windows 11 + Edge + Narrator，中文完整旅程；
- Windows 11 + Firefox + NVDA，英文完整旅程；
- macOS + Safari + VoiceOver；
- iOS + Safari + VoiceOver；
- Android + Chrome 真实设备；
- keyboard；
- 200% text、200% zoom、400%/320 CSS px；
- text spacing、forced colors、reduced motion；
- map/lineage structured equivalence；
- bilingual review；
- source support；
- media identity/license；
- visual direction review。

### 22.6 发布决策

`GO` 只有在：

- 所有适用证据同版本；
- 无 unresolved Blocker/High；
- 无已知 WCAG A/AA；
- 无不可豁免真实性或媒体问题；
- 所有 waiver 有效且属于可豁免范围。

否则记录 `NO_GO` 或 `BLOCKED`。

## 23. 路由迁移矩阵

| 当前路由 | 目标路由 | Owning slice | 迁移行为 | 旧实现删除 |
| --- | --- | ---: | --- | ---: |
| `/` | `/{locale}` | 1 / 9 | 先语言解析；Wave A 最小入口，Slice 9 完整 Home | 9 |
| `/atlas` | `/{locale}/atlas` | 1 / 3 | 语言解析并保留 `q`/filters | 3 |
| `/atlas/{slug}` | `/{locale}/atlas/{canonicalSlug}` | 1 / 2 | 永久重定向；unpublished 404 | 2 |
| `/zh/atlas/{slug}` | 相同 canonical | 1 / 2 | 新 Product Shell，完成 profile | 2 |
| `/en/atlas/{slug}` | 相同 canonical | 1 / 2 | 新 Product Shell，完成 profile | 2 |
| `/lineage` | `/{locale}/lineage` | 4 | Wave B cutover；保留 focus/depth/compare | 5 |
| `/global-distribution` | `/{locale}/map` | 6 | 永久重定向；保留 mode/focus/filter | 7 |
| `/map` | `/{locale}/map` | 6 | 语言化重定向 | 7 |
| 无 | `/{locale}/institutions/{slug}` | 8 | 新 canonical route | 8 |
| 无 | `/{locale}/places/{slug}` | 8 | 新 canonical route | 8 |
| `/my-pandas` 或无 | `/{locale}/my-pandas` | 10 | 语言化 route | 10 |

## 24. Compatibility ledger

实施必须维护版本化 compatibility ledger。每条至少包含：

- legacy owner；
- current callers；
- allowed routes；
- reason；
- user-visible truth state；
- 禁止的新 callers；
- deletion slice；
- owner；
- expiry；
- test proving no expansion。

首批 ledger 项：

| Legacy owner | 暂时允许 | 禁止 | 删除切片 |
| --- | --- | --- | ---: |
| old lineage route/component | Wave B 前现有生产 route | 新 localized route 直接复用 silent fallback | 5 |
| old distribution workspace | Wave B 前现有生产 route | 作为新 map 的 structured equivalent | 7 |
| old SiteHeader/TopNav | 尚未 cutover 的 legacy route | 新 Product/Editorial route | 3/7 |
| old API fallback adapters | 精确列出的 legacy callers | 新 feature 或新 test | 4/7 |
| old global CSS feature blocks | 尚未迁移的 route | 新 route selector | owning slice |

生成式 profile、无许可 media 和无来源 popularity 不得进入 compatibility ledger，它们是不可接受的公共行为，必须在 Wave A 中停止。

## 25. 数据契约迁移矩阵

| Contract | 首次 strict slice | 完成 slice | 禁止 fallback |
| --- | ---: | ---: | --- |
| identity resolution | 1 | 1 | alternate identity fixture |
| minimal search | 1 | 3 | local popularity/preset |
| trusted profile | 1 | 2 | generated profile copy/media |
| relationship assertions | 2 | 4 | final parent IDs as full evidence |
| lineage graph model | 4 | 5 | static `LINEAGE_PANDAS` |
| structured map records | 2 | 6 | unlabeled local GeoJSON |
| map visualization query | 6 | 7 | provider success inferred as data success |
| institutions/places | 6 | 8 | merging organization and place |
| Home selections/revisions | 2/3 | 9 | hard-coded metrics/social proof |
| My Pandas local IDs | 1 | 10 | cached public fact copies |

所有 adapter 必须返回 release、delivery、coverage、locale、sources 和受控错误状态。

## 26. 质量基础设施随切片演进

质量工作不作为最后独立项目。

| Quality capability | 首次进入 | 完成/扩展 |
| --- | ---: | --- |
| Evidence Manifest 和状态语义 | 1 | 12 |
| PR risk 自动升级 | 1 | 11 |
| check group 可见性 | 1 | 11 |
| Public Content Envelope gate | 1 | 3/8 |
| locale parity | 1 | 每切片 |
| no-demo/silent-fallback gate | 1 | 11 |
| screenshot inventory/baselines | 1 | 每切片 |
| dynamic axe/incomplete workflow | 1 | 每切片 |
| keyboard golden paths | 1 | 每切片 |
| bundle/asset budgets | 1 | 每切片 |
| immutable Staging record | 1 | 12 |
| Firefox/WebKit Staging | 4/6 | 12 |
| Lighthouse/API latency | 3 | 12 |
| fault injection | 1 | 7/12 |
| media manifest gate | 1 | 9/11 |
| structured human sign-off | 1 | 12 |
| formal release package | — | 12 |

## 27. 每切片证据最低要求

| Slice | Risk | Default Gate | Staging | Human |
| ---: | --- | --- | --- | --- |
| 1 | L3 | full affected matrix | immutable, scoped | zh/en screen reader, keyboard, zoom, visual |
| 2 | L2/L3 | profile full states | profile/source/media | bilingual, source, media, screen reader |
| 3 | L2 | search/URL/states/perf | real query | mobile filters, bilingual, visual |
| 4 | L3 | structured relation | real assertions | graph-free equivalence, screen reader |
| 5 | L3 | graph sync/motion/perf | cross-engine | Safari/VoiceOver, touch, motion |
| 6 | L3 | structured geo | real snapshot/provider config | no-map equivalence, screen reader |
| 7 | L3 | map sync/motion/perf | provider/fault/cross-engine | iOS/Safari/touch/motion |
| 8 | L2 | entity contracts | real links | bilingual, precision, source |
| 9 | L2/L3 | truth/media/visual/perf | real Home | bilingual editorial and design |
| 10 | L2 | local storage/privacy | targeted | keyboard/reader/privacy |
| 11 | L3 | full architecture/deletion | full routes | targeted regression |
| 12 | L3 | complete | complete | complete release matrix |

## 28. Rollback 总原则

### 28.1 可回滚对象

- route cutover configuration；
- Client enhancement；
- visual register mapping；
- current immutable Public Release；
- provider adapter；
- optional media display；
- non-core feature module。

### 28.2 不可回滚对象

不得回滚到：

- 生成式 profile；
- 静默 fixture；
- 无来源 confirmed fact；
- 错误精度；
- 无许可 media；
- 双语事实不一致；
- 只有图形没有结构化任务；
- error/unavailable 伪装 live；
- 已撤回 release 或 media。

### 28.3 安全降级顺序

出现故障时按顺序：

1. 关闭图形 enhancement，保留结构化任务；
2. 使用上一不可变可信 public release，明确 cached；
3. 只保留已成功加载模块，明确 partial；
4. 显示 unavailable 和恢复动作；
5. 不使用 demo。

### 28.4 数据 rollback

本前端计划不重设计数据库或发布系统。需要数据 rollback 时使用既有 immutable release/withdrawal 机制。前端不得自行拼接不同 release 的模块形成“看起来完整”的页面。

## 29. 迁移中 SEO 和索引政策

- 只有 canonical target route 可索引；
- compatibility preview 和 staging route `noindex`；
- 旧 content route cutover 后永久重定向；
- unpublished/withdrawn 不通过搜索建议泄露；
- locale parity 不完整的 draft route 不进 sitemap；
- canonical、hreflang、x-default 和 structured data 绑定同一 release；
- redirect chain 最多一跳；
- 历史 slug 永不重新分配。

## 30. 测试迁移政策

测试代表目标旅程，不代表旧实现。

当 route cutover 时：

- 先增加 target test；
- 确认 target pass；
- 删除 legacy success assertion；
- 保留 redirect/deprecation test；
- 不得为了让旧测试通过保留错误路由。

测试 fixture 分类：

- `published-release fixture`：允许用于 deterministic gate；
- `state fixture`：允许模拟 cached、partial、unavailable 等明确状态；
- `demo fixture`：只允许 prototype/dev，production test 不得把它当成功数据；
- `legacy fallback fixture`：随 owning slice 删除。

## 31. 媒体迁移政策

- 当前 `apps/web/public` 中没有 media record 的文件全部 quarantined；
- 新 route 默认 no-media；
- asset 只有在 subject、source、license、allowed use、attribution、review、checksum 和 derivative 信息完整后可使用；
- 旧 generic/relabelled asset 不迁移；
- Home、Profile、Atlas、OG 和 structured data 使用同一 manifest gate；
- withdrawn asset 必须从引用、构建输出和 CDN manifest 删除；
- source-link-only 只生成链接。

## 32. CSS 和 Token 迁移政策

每个切片：

1. 为需要的语义角色增加或使用现有 Token；
2. 将新 route 样式放入 Foundation、register 或 feature owner；
3. 删除对应旧 selector；
4. 增加禁止新调用的检查；
5. 不建立永久 old-to-new theme。

禁止：

- 新旧 token 同时决定一个控件；
- 新 utility 通过 `!important` 压旧 CSS；
- 把旧 `globals.css` 整段移动到 CSS Module；
- 用 arbitrary values 建立第二套系统；
- 因 prototype 好看而复制 prototype CSS。

## 33. Client boundary 迁移政策

允许 Client Component 的典型对象：

- navigation disclosure；
- search suggestion；
- filter sheet；
- local favorite/recent；
- map canvas；
- lineage graph；
- 必要 dialog/drawer。

不允许默认 Client：

- page shell；
- profile facts；
- source list；
- revision history；
- structured map list；
- structured relation list；
- static Home content。

每个新增 `'use client'` 必须在 PR Manifest 说明：

- 为什么 Server 不足；
- 边界大小；
- 传输和 hydration 成本；
- 无 JS 行为；
- 退出路径。

## 34. 依赖准入

新增依赖必须说明：

- 现有平台机制为何不足；
- 使用的 feature seam；
- bundle 成本；
- Client boundary；
- accessibility；
- license；
- security/privacy；
- exit cost。

不得通过替换整个组件库完成迁移。

MapLibre 保留为隔离的 feature dependency；不得进入 shared shell。

## 35. Blocked 契约处理

实施中发现后端或发布投影缺字段时，必须形成精确 blocker：

```text
Blocked contract:
- consumer route / feature
- missing field or invariant
- required semantics
- current payload evidence
- why frontend cannot infer it safely
- minimum compatible contract
- affected acceptance scenarios
```

可接受临时行为：

- unavailable；
- partial；
- cached previous release；
- no-media；
- no-map；
- no-lineage-graph。

不可接受临时行为：

- fake value；
- local source ID；
- guessed precision；
- inferred relationship certainty；
- untranslated text marked English；
- borrowed media；
- success-shaped fallback。

## 36. 明确非目标

本实施计划不包含：

- 后端领域模型整体重设计；
- 数据库迁移项目；
- 发布工作流整体重写；
- 专业 admin 完整重设计；
- 账户、社交、通知或 recommendation system；
- 原生移动应用；
- 切换前端框架、CSS framework 或组件库；
- 一次性重写所有页面；
- 把 prototype branch 合并成 production；
- 无来源内容补全；
- 为视觉完整度采购或生成临时熊猫身份媒体；
- 正式 WCAG 声明早于完整人工证据。

## 37. 第一张实施 Issue 的可直接复制 Brief

### Title

Implement the localized trust spine and first frontend evidence slice

### Goal

Deliver the first complete PandaAtlas public vertical slice: localized Product Shell, responsive global navigation, task-completing global search entry, minimal localized Atlas results, and trusted profile above the fold, with a strict Public Content Envelope and the first complete automated/Staging/human evidence chain.

### In scope

- Foundation tokens/base/typography/motion/register styles；
- locale registry、root/locale/Product shells；
- responsive global navigation and mobile menu；
- minimal GlobalSearch and `/{locale}/atlas?q=` result route；
- trusted `/{locale}/atlas/{slug}` above-the-fold view；
- release/delivery/coverage/source/precision/Last verified；
- no-media、cached、partial、unavailable、error、404、redirect；
- strict server adapters and view models；
- local favorite client island；
- Evidence Manifest schema、risk classifier、check groups、screenshots、bundle report、immutable Staging identity；
- replacement of legacy profile success tests；
- removal/containment of legacy generated profile rendering。

### Out of scope

- full Atlas filters/sort/pagination；
- full profile sections；
- Lineage/Map visualization；
- Institution/Place/My Pandas；
- final Home；
- full CI migration beyond evidence required by this slice。

### Required seams

- Server Component default；
- public-envelope adapter；
- profile page view model；
- patterns for facts/status/sources/states；
- small explicit Client islands；
- no new deep cross-feature imports。

### Acceptance

Use Section 11 of this handoff and the relevant scenarios in the quality, truth, IA and architecture documents. Missing applicable Staging or human evidence is `BLOCKED`.

### Suggested skills

- `implement`
- `tdd`
- `codebase-design`
- `code-review`

## 38. 实施 Agent 开始前检查

开始 Slice 1 前，Agent 必须确认：

- 当前 branch 和 clean status；
- 原有未跟踪文件不是实现依赖；
- issue/slice scope；
- source docs 已读取；
- 当前 release gate 可运行方式；
- Playwright browser 安装策略；
- Staging deployment mechanism；
- Public Release fixture identity；
- 需要的人类 reviewer 能力；
- 没有计划复用 prototype code。

## 39. 每个切片结束检查

- route/task works；
- locale parity；
- truth/source/media/state contract；
- URL/canonical/redirect；
- Server/Client seam；
- responsive/keyboard/screen reader/reduced motion；
- visual baselines；
- performance budget；
- Default Gate；
- immutable Staging；
- human sign-off；
- old ownership deleted；
- compatibility ledger updated；
- rollback tested；
- code review complete；
- commit and issue resolution link recorded。

## 40. 交接完成条件

本计划完成时：

- canonical public route tree 只有一个所有者；
- 中文和英文核心旅程完整；
- Profile、Atlas、Lineage、Map、Institution、Place、Home 和 My Pandas 都符合批准职责；
- 地图和谱系结构化任务始终存在；
- 所有公共数据通过真实性和媒体门禁；
- 旧生成式、静默 fallback 和无来源视觉补全已删除；
- Foundation、patterns、registers 和 feature modules 的依赖方向可自动检查；
- Default Gate、immutable Staging 和 human sign-off 绑定同一 release；
- Release owner 可以在无需新产品或质量政策决策的情况下记录 `GO`、`NO_GO` 或 `BLOCKED`。

## 41. 最终指令

实施从 Slice 1 开始，不从批量视觉翻新、目录移动、首页重做、MapLibre 重写或组件库替换开始。

第一个成功证据必须证明：

> **一个用户可以在中英文、移动和桌面环境中，从语言化入口搜索并确认一只熊猫，看到来源支持的关键事实；当数据、媒体或网络不完整时，页面诚实地降级；同一 commit 在 clean CI、不可变 Staging 和具名人工验收中形成完整证据。**

只有这条主链稳定后，系统才继续扩展到完整档案、Atlas、家族、地图和其他 surface。
