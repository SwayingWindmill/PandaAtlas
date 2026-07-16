# PandaAtlas 公共内容、数据真实性、媒体与 UI 状态规则

- **状态：** 已确认，作为所有公开 surface 的内容真实性、来源、双语、媒体与状态呈现规范
- **确认日期：** 2026-07-16
- **Wayfinder 票：** [Define content, data-honesty, media, and UI-state rules](https://github.com/SwayingWindmill/PandaAtlas/issues/36)
- **父地图：** [Wayfinder: PandaAtlas 前端系统性改进](https://github.com/SwayingWindmill/PandaAtlas/issues/31)
- **现状依据：** [PandaAtlas frontend system and evidence-gap audit](../research/frontend-system-audit-2026-07-15.md)
- **上游原则：** [PandaAtlas 前端设计原则与规范优先级](./frontend-design-principles-and-standards.md)
- **公共旅程：** [PandaAtlas 核心公共旅程与信息架构](./core-public-journeys-and-information-architecture.md)
- **系统边界：** [PandaAtlas 前端系统边界与 Token / 模块架构](../architecture/frontend-system-boundary-and-token-component-architecture.md)

## 1. 决策摘要

PandaAtlas 的公共呈现必须永远落后于或等于证据，不得领先于证据。

任何公开事实、数字、图像、关系、地图点、编辑叙述或状态提示，都必须能够回答：

- 这是什么类型的内容；
- 它由什么公开证据支持；
- 证据支持到什么程度；
- 该事实是否仍在有效核实窗口内；
- 用户当前看到的数据通过什么交付路径到达；
- 当前语言是否经过审核；
- 媒体是否具有明确身份和使用权；
- 缺失、失败或降级时，界面是否准确说明原因和范围。

本规范建立以下核心机制：

1. **三维真实性模型**：结论状态、新鲜度状态、交付状态彼此独立。
2. **四类公共声明**：档案事实、聚合数字、产品计算、编辑内容分别使用不同门槛。
3. **三层来源呈现**：事实级可追溯、模块级摘要、页面级完整来源。
4. **双语内容治理**：一个领域含义、两个审核表达、缺失翻译显式降级。
5. **媒体 fail-closed**：没有可验证身份与许可记录，就不发布媒体。
6. **UI 状态契约**：loading、empty、error、offline、cached、partial 等不能互相伪装。
7. **Public Content Envelope**：真实性状态随数据穿过整个 interface，组件只呈现，不猜测。
8. **自动与人工双门禁**：机器守住结构和禁止项，人工判断来源、翻译、媒体身份和语义诚实度。

首个 Public Beta 宁可展示空状态、粗粒度事实、来源链接或结构化替代，也不得通过 fixture、推测、无许可媒体、虚构指标或静默 fallback 补齐视觉完整度。

## 2. 当前基线与必须纠正的问题

截至本规范形成时，仓库已经拥有一个可信内容内核：

- 可信个体档案区分 `confirmed`、`provisional`、`disputed`、`superseded`；
- 关键事实显示公开来源和 `last_verified_at`；
- 来源发布日期与事件日期保持区分；
- 媒体具有 `licensed`、`no_licensed_media`、`source_link_only` 等初步状态；
- 档案可展示修订版本和来源元数据；
- 地图已有加载、失败、文本 fallback 和数据来源提示；
- 黄金数据集对 restricted 字段、来源关联和发布状态具有较强约束。

但公开系统仍存在会破坏真实性的并行契约：

- 多个 API adapter 在失败时静默返回本地 fixture；
- atlas、lineage、stats、habitats 等读取通常没有 origin 或 delivery discriminator；
- legacy profile 生成无来源性格、喜好、体重、故事、时间线和媒体；
- 图鉴存在未定义的“热门”排序、标签和本地 popularity 数字；
- 首页包含无来源收录量、社交数字和保护行动式 CTA；
- `apps/web/public` 中存在大量没有共存媒体清单的熊猫和编辑图片；
- 英文页面经常通过 `name_en ?? name_zh` 静默回退；
- route 缺少统一 loading、error、not-found 和 degraded contract；
- 空结果、服务失败、无已发布记录和静默 fallback 可能呈现成相似成功界面。

因此，本票解决的不是“状态文案风格”，而是公共内容 interface、发布准入和用户可感知诚实度。

## 3. 规范性语言

- **必须 / 不得**：不可豁免的公共发布与架构约束。
- **应该 / 不应该**：默认要求；偏离时必须记录原因、风险与验证方式。
- **可以**：在不破坏更高优先级规则时允许。

本规范使用以下核心术语：

- **Fact Assertion**：由来源支持的原始事实陈述。
- **Public Conclusion**：从一个或多个 assertion 形成的、可发布的当前解释。
- **Conclusion status**：证据支持该解释到什么程度。
- **Freshness**：时效性事实是否仍处于其核实政策的有效窗口。
- **Delivery status**：用户当前看到的数据通过什么公开交付路径到达。
- **Coverage**：当前结果实际覆盖的集合、区域、时间点与截断范围。
- **Public Projection**：从审核源生成、只包含公开字段的不可变发布版本。
- **Editorial content**：明确属于 PandaAtlas 编辑表达而非来源事实的内容。
- **Documentary media**：描绘已确认主体、场所或事件的档案媒体。
- **Illustrative media**：只解释一般概念、不证明具体个体事实的说明性媒体。

## 4. 总体优先级

当真实性、可用性、视觉完整度或编辑表达发生冲突时，按以下顺序决策：

1. 公共发布与安全边界；
2. 领域事实与证据；
3. 精度和新鲜度；
4. 无障碍与核心任务可完成性；
5. 双语语义对等；
6. 媒体身份与许可；
7. 编辑表达与视觉完整度。

较低优先级不得覆盖较高优先级。

示例：

- 没有获许可照片时，使用无媒体状态，不使用无关熊猫图片。
- 只确认到国家级时，展示“中国”，不因地图需要而推断基地。
- 英文摘要未审核时，显示缺失翻译，不显示机器翻译成品。
- API 失败且没有正式发布缓存时，展示 unavailable，不返回 demo fixture。

## 5. 三维真实性模型

每项公共内容至少从以下三个彼此独立的维度理解。

### 5.1 结论状态：证据支持到什么程度

沿用领域状态：

#### 已确认 `confirmed`

一个可发布值被当前证据支持为现行结论。

要求：

- 至少关联一个允许公开的来源；
- 值、精度和来源之间一致；
- 不代表事实永远不会被修订；
- 时效性事实仍需独立判断 freshness。

#### 暂定 `provisional`

当前展示一个候选值，但证据不足以支持无条件确定表达。

要求：

- 不确定性紧邻值展示；
- 来源和最后核实日期可访问；
- 不得在其他页面简化成 confirmed；
- 由该值计算的产品结果继承不确定性。

#### 有争议 `disputed`

存在两个或多个互不兼容的可发布候选值，尚未解决。

要求：

- 不选择一个无标记主值；
- 展示候选范围或冲突说明；
- 保留每个候选的来源；
- 相关聚合、关系路径或时间线说明冲突影响。

#### 已取代 `superseded`

旧结论被新结论替代，仅作为修订历史保留。

要求：

- 不在当前事实区作为现行值；
- 在历史中显示替代时间和替代原因摘要；
- 不静默删除过去公开过的重大结论。

#### 未知 / 尚无公开结论

这是缺少当前结论，不是第五种证据强度。

要求：

- 使用“暂无已发布结论”或等价表达；
- 不使用 `0`、空字符串、旧值、推测值或页面默认值填补；
- 不把“未记录”写成“现实中不存在”。

### 5.2 核实动作不等于结论状态

“已核实”表示 PandaAtlas 在某日检查了来源和当前解释。

它不表示：

- 结论一定是 confirmed；
- 事实发生在该日期；
- 来源在该日期发布；
- 现实状态在核实后没有变化；
- 来源机构为 PandaAtlas 的解释背书。

因此，一条 provisional 或 disputed 结论也可以有近期 `last_verified_at`。

### 5.3 新鲜度状态：时效性事实是否仍有效

新鲜度只适用于会随现实变化的字段，例如当前场所、生命状态、来源访问状态、地图快照与机构当前名单。

#### 当前 `current`

仍在该字段 freshness policy 的有效窗口内。

#### 临近复核 `review-due`

尚未越期，但已进入复核窗口。

默认处理：

- 不一定在每个事实旁显示警告；
- 可以在档案或模块级提示；
- 进入审核工作队列。

#### 已过期 `stale`

超过允许的最大核实年龄。

允许继续展示历史上最后确认的值，但必须写成：

> 截至 2026 年 5 月 10 日最后确认：卧龙神树坪基地。

不得写成无时间限定的“当前位于卧龙神树坪基地”。

#### 稳定事实 `stable`

出生日期、稳定身份等不会仅因时间经过自动过期。

稳定不代表不可修订；出现冲突或新证据时仍可变化。

#### 无法判断 `undated`

缺少必要核实日期或 freshness policy。

不得暗示仍然 current。对于必须具备时效判断的字段，`undated` 应阻断无条件当前表达。

### 5.4 交付状态：当前数据通过什么路径到达

交付状态位于页面、结果集或功能区域级别。

#### 当前发布版本 `live`

来自当前已批准、未撤回的公开投影。

#### 已发布缓存版本 `cached`

正常服务不可达，但显示的是可识别、不可变、此前正式发布的版本。

必须显示：

- 发布版本；
- 发布或缓存日期；
- 无法刷新的能力；
- 当前内容可能不是最新的说明。

#### 部分可用 `partial`

当前任务只交付了明确部分。

必须有 coverage，说明：

- 已显示什么；
- 缺失什么；
- 缺失原因；
- 聚合数字是否仍可信；
- 是否可继续加载或换用结构化路径。

#### 不可用 `unavailable`

没有可安全显示的已发布内容或必要模块无法交付。

不得用 demo、无来源 local data 或旧生成内容掩盖。

#### 预览 `preview`

只允许受控评审环境。

必须：

- 持续显眼标记；
- `noindex`；
- 不进入正式 sitemap、缓存、统计和搜索；
- 不与 production 数据混合。

#### 示例 `demo`

只允许开发、测试或教学环境。

生产公共 route 不得接收或展示 `demo`。

### 5.5 `fallback` 不是用户状态

`fallback` 只描述 implementation 采用替代路径，不能成为用户无法理解的模糊标签。

任何替代路径必须明确落入：

- `cached`；
- `partial`；
- `preview`；
- `demo`；
- `unavailable`。

不得显示“正在使用备用数据”而不说明备用数据是正式发布缓存还是测试 fixture。

### 5.6 合法组合示例

- `confirmed + current + live`：当前发布版本中的近期已确认事实。
- `confirmed + stale + live`：当前版本仍公开该历史确认，但已超过复核期限。
- `provisional + current + live`：近期核实过的暂定结论。
- `confirmed + current + cached`：事实在缓存发布版本中仍为当前，但页面无法刷新。
- `disputed + stable + live`：稳定身份字段存在未解决冲突。
- `confirmed + undated + partial`：值被确认，但缺少必要时效元数据且当前模块不完整。

界面不得压缩成单一“可信 / 不可信”评分。

## 6. 四类公共声明

所有公共文案必须属于以下一类。

### 6.1 档案事实

描述具体实体、关系或事件，例如：

- 出生日期；
- 性别与生命状态；
- 当前场所；
- 父母关系；
- 居住区间；
- 迁移事件；
- 机构管理场所；
- 媒体许可状态。

发布条件：

- 来自当前或明确标记的正式公共投影；
- 对应可发布 conclusion 或结构化记录；
- 可追溯到公开来源；
- 显示适当 conclusion status；
- 时效性字段显示 freshness 与最后核实日期；
- 精度不超过来源支持范围。

没有公开结论时使用“暂无已发布结论”。

### 6.2 聚合数字

例如：

- 当前发布版本收录档案数量；
- 某机构当前公开名单数量；
- 当前地图模式包含地点数；
- 当前搜索结果数。

只有同时满足以下条件才可显示精确值：

- 统计集合定义清楚；
- 使用同一个已发布版本；
- 版本或快照日期明确；
- 未知、隐藏和不适用记录处理规则明确；
- coverage 完整，或数字明确限定为当前局部范围；
- 用户不会把“本站收录范围”误解为现实世界总量。

推荐：

> 截至发布版本 2026.07.14.3，共收录 7 份公开个体档案。

禁止：

> 全球共有 7 只大熊猫。

### 6.3 产品计算

例如：

- 当前筛选匹配；
- 关系路径长度；
- 日期跨度；
- 当前视口数量；
- 最近浏览；
- 基于真实关系的相关档案。

要求：

- 明确写成“在本站档案中”“根据当前筛选”“按已发布关系计算”；
- 方法稳定且可解释；
- 输入不确定时结果继承限制；
- 不将内部 score 或排序权重呈现为自然事实；
- 不使用“最热门”“最重要”“最完整”，除非存在已定义、可审计指标。

相关推荐只可基于可解释关系，例如：

- 已发布亲缘；
- 共同场所；
- 同一公开事件；
- 同一机构公开名单。

不得伪装成大众偏好。

### 6.4 编辑内容

包括：

- 首页定位语；
- 审核故事；
- 章节导语；
- 方法说明；
- 编辑精选。

编辑内容可以温暖，但必须：

- 不新增档案事实；
- 不为动物赋予无来源性格、情绪、喜好、动机或内心；
- 不把推测写成叙事事实；
- 涉及具体日期、地点、数字、关系和事件时遵守档案事实规则；
- 明确区分编辑选择与数据排名；
- 使用“编辑精选”，不使用“最受欢迎”。

## 7. 精度与范围规则

### 7.1 日期精度

- 来源只支持年份时，只显示年份；
- 来源只支持月份时，不补具体日期；
- 未知日期不得默认成月初或年初；
- announced 与 completed 日期不得混用；
- 来源发布日期不得作为事件日期；
- 相对时间不能替代关键绝对日期。

View model 必须保留日期精度：

- `day`；
- `month`；
- `year`；
- `unknown`。

### 7.2 地点精度

- 只支持国家级时，只显示国家；
- 只支持地区级时，不推断机构或园区；
- Institution 不等于 Place；
- Place 关联 Institution 不等于法律所有权；
- 野生位置必须遵守敏感位置降精度政策；
- 地图坐标存在不代表可以公开同等精度。

### 7.3 数量精度

- 范围不得转为单一精确值；
- partial 集合不得显示全量总数；
- 本地可见点数不得写成全球设施数；
- 未公开记录不得被推断为零；
- 相同原始事件的转载不得重复计数。

### 7.4 关系精度

- tentative parentage 不得在卡片或路径中简化成 confirmed；
- dependency stub 必须显示其不完整身份范围；
- 未确认父母不得由名字、共同场所或时间推断；
- 图形边与线性关系列表必须使用同一公开关系记录。

## 8. 社会证明与指标

首个 Beta 禁止显示没有审计来源和定义的：

- 浏览量；
- 收藏量；
- 用户数；
- 社交媒体影响数字；
- popularity score；
- 增长率；
- 保护成果归因；
- 未定义的全球熊猫、机构、场所或国家总量；
- 虚构评价、评分和用户引语。

没有真实指标时，删除模块，不使用占位数字。

若未来引入指标，必须定义：

- 数据来源；
- 统计范围；
- 时间窗口；
- 机器人与重复行为处理；
- 隐私边界；
- 更新频率；
- 是否可公开；
- 是否影响排序。

## 9. CTA 真实性

CTA 文字必须准确描述真实目的地或动作。

要求：

- “查看来源”打开具体来源；
- “浏览家族关系”进入家族任务；
- “在地图中查看”进入对应模式与实体状态；
- “了解保护工作”进入真实方法或外部项目说明；
- 外部链接明确外部目的地；
- 暂不可用动作使用禁用说明或移除，不使用空链接。

禁止：

- 自链接；
- 无动作按钮；
- “加入保护行动”却只滚动当前页面；
- “支持我们”但没有真实支持渠道；
- “立即查看最新信息”却打开 stale/cached 数据而不说明。

## 10. 来源呈现架构

采用三层来源结构。

### 10.1 事实级可追溯

以下内容必须从值本身直接到达依据：

- 当前场所；
- 出生日期；
- 性别与生命状态；
- 父母和关键亲缘；
- 迁移事件；
- 具体时间线日期；
- provisional 或 disputed 结论；
- 精确统计；
- 媒体身份与许可声明。

事实级区域默认展示：

- 当前值；
- conclusion status；
- freshness 或时间限定；
- last verified；
- 可聚焦的来源入口。

来源入口不得只是无语义信息图标。

### 10.2 模块级来源摘要

多个事实确实共享同一来源集合时，可以显示模块摘要：

> 本节依据 3 个已审核公开来源，最后核实于 2026 年 5 月 10 日。

仅在以下条件满足时合并：

- 来源集合相同或用户可区分；
- 不掩盖 provisional、disputed 或 stale；
- 事实级入口仍可定位；
- 不让用户误以为一个来源支持模块所有内容。

### 10.3 页面级完整来源区

个体、机构、场所和专题页应提供完整来源清单。

每项至少显示：

- 发布者；
- 原始标题；
- 原始 URL；
- 原始发布日期，如有；
- PandaAtlas 最后核实日期；
- 来源语言；
- 当前访问状态；
- 支持的事实或章节入口。

不得使用“资料来源：互联网”或一个模糊机构列表作为背书。

## 11. 三类日期必须分开

### 来源发布日期

原始内容何时发布。

### 最后核实日期

PandaAtlas 最近何时检查来源，并确认当前公开解释仍符合当时可见证据。

### 档案修订日期 / 发布版本

PandaAtlas 何时发布当前公共解释。

界面不得把三者合并成一个“更新时间”。

## 12. 来源访问状态

受控状态至少包括：

### 可访问 `accessible`

当前原链接可访问。

### 已跳转 `redirected`

原链接跳转到可识别的同一内容或官方替代地址。

### 已归档 `archived`

原链接不可用，但存在可公开访问、可识别的可信归档副本。

### 内容已变化 `changed`

页面存在，但关键内容与审核时不同。

相关结论必须进入复核，不得继续无条件依赖旧内容。

### 暂不可用 `unavailable`

当前无法访问，且无足够公开归档路径。

### 受限 `restricted`

来源存在，但公众无法直接访问。

`unavailable` 或 `restricted` 不自动使历史结论失效，但必须影响 freshness、可验证表述和复核优先级。

## 13. 来源质量与独立性

- 来源数量不是可信度分数；
- 多个转载同一公告不构成独立多重证据；
- 官方来源不支持其未明确陈述的推论；
- 一手来源优先，但可靠二手来源可用于背景、交叉核实或 provisional；
- 来源冲突时保留冲突，不用多数数量自动决定；
- 不公开内部来源评分、审核员备注和 restricted attachment；
- 来源语言与译题必须清楚区分。

## 14. `Last verified` 的标准含义

统一定义：

> PandaAtlas 在该日期检查了对应公开来源，并确认当前发布解释仍符合当时可见证据。

不表示：

- 事件发生日期；
- 来源发布日期；
- 现实状态在之后没有变化；
- 来源机构背书；
- 已联系机构或当事方；
- 结论一定 confirmed。

中文统一使用“最后核实”，英文统一使用 **Last verified**。

不得在相同语境交替使用 Updated、Checked、Reviewed、Verified 而制造不同含义。

## 15. 修订历史

当前档案应展示：

- 当前数据版本；
- Public Schema 版本；
- 当前修订发布日期；
- 当前修订摘要；
- 可访问的近期修订列表。

修订摘要必须描述事实变化，例如：

- 更新当前场所及核实日期；
- 将父亲关系由暂定改为已确认；
- 撤下未获许可媒体；
- 修正英文罗马字拼写；
- 将迁移事件由 announced 更新为 completed。

禁止只写：

- 优化体验；
- 更新资料；
- 若干修复；
- 内容调整。

## 16. 撤回、更正与已取代内容

当结论被撤回或替代：

- 当前页面立即停止把旧值作为当前事实；
- 旧值进入修订历史并标记 superseded 或 withdrawn；
- 派生统计和路径使用新版本重算；
- 缓存按发布版本切换；
- 重大错误显示页面级更正说明；
- 不静默改写历史时间线；
- 不公开 restricted 更正备注。

已撤回实体或媒体不得继续出现在：

- Open Graph；
- structured data；
- sitemap；
- CDN；
- 搜索索引；
- 旧卡片缓存。

## 17. 双语内容治理

采用 **一个领域含义、两个经审核表达、明确原文降级**。

### 17.1 正式 locale

公开界面正式支持：

- `zh-CN`；
- `en`。

每个公共字段必须属于：

- 语言无关结构值；
- 审核中文内容；
- 审核英文内容；
- 必须保留原文的专名或来源标题；
- 明确缺失翻译。

不得通过静默 fallback 伪装翻译完整。

### 17.2 项目级术语表

必须集中管理：

- conclusion status；
- freshness；
- delivery；
- 亲缘关系；
- residency 与 transfer；
- Institution 与 Place；
- 来源访问状态；
- 媒体许可状态；
- UI 状态。

示例：

| Domain term | 中文 | English |
|---|---|---|
| confirmed | 已确认 | Confirmed |
| provisional | 暂定 | Provisional |
| disputed | 有争议 | Disputed |
| superseded | 已取代 | Superseded |
| last verified | 最后核实 | Last verified |
| current place | 当前场所 | Current place |
| institution | 机构 | Institution |
| place | 场所 | Place |
| cached | 已发布缓存 | Published cache |
| partial | 部分可用 | Partial |

不得在不同页面用“已验证、已核验、已审核、已确认”表达同一状态。

术语表定义领域含义，不只定义 UI 字符串。

### 17.3 熊猫名称

熊猫名称是结构化身份记录，不是普通翻译。

中文页面默认：

1. 审核中文主名称；
2. 可选官方英文罗马字；
3. 必要时拼音或历史拼写。

英文页面默认：

1. 审核官方英文名称或罗马字；
2. 中文主名称作为次级身份提示；
3. 不自行字面翻译。

缺少英文名称时必须明确：

> 美香<br>
> English name not available in the published record.

不得仅使用 `name_en ?? name_zh` 而不提示。

### 17.4 机构与场所名称

优先级：

1. 当前 locale 审核正式名称；
2. 机构或场所官方外文名称；
3. 原文名称并标注语言；
4. “暂无审核译名”。

首次出现可能同时显示官方原名，避免身份混淆。

不得根据设施名称推断法人主体、管理关系或所有权。

### 17.5 来源标题与发布者

优先保留：

- 发布者官方名称；
- 原始标题；
- 原始语言；
- 可选审核译题。

译题必须标记为 PandaAtlas 译题。

示例：

> Giant Panda FAQs<br>
> 熊猫常见问题（PandaAtlas 译题）

原始 URL 不因 locale 改写到不同内容页面。

### 17.6 翻译发布门槛

正式翻译必须：

- 保持领域含义；
- 核对专名、数字、日期、状态；
- 不增加原文不支持的确定性；
- 保持来源和链接；
- 经过长度、响应式与无障碍验证；
- 有可追踪审核状态。

机器翻译可作为内部草稿，但 `draft`、`machine_generated`、`unreviewed` 不得进入公共投影。

### 17.7 缺少翻译时的降级

#### 关键结构化事实

- 显示语言无关值；
- 使用已审核界面标签；
- 专名保留原文并标注语言。

#### 编辑摘要或故事

- 显示“该内容暂未提供英文 / 中文版本”；
- 可以链接另一语言版本；
- 不自动整段显示另一语言。

#### 来源原文

- 允许显示原文；
- 标记原始语言；
- 译题或摘要明确为 PandaAtlas 翻译。

缺少翻译不是 404，但不能伪装为完整语言版本。

### 17.8 语义对等

中英文不要求逐字相同，但必须在以下方面对等：

- 当前结论；
- 不确定性；
- 精度限制；
- 来源范围；
- 日期和数量；
- CTA 结果；
- 媒体许可；
- error、degraded 与 correction。

不得中文写“仅确认到国家级”，英文写具体机构。

### 17.9 Locale-aware formatting

使用 locale-aware formatter 处理：

- 日期；
- 数字；
- 列表；
- 相对时间；
- 标点；
- 复数。

格式化不得提高原始精度。

## 18. 搜索、别名与身份提示

搜索可以匹配：

- 中文主名称；
- 英文名；
- 拼音；
- 历史拼写；
- 审核别名；
- 外部标识符。

结果必须显示当前 locale 主名称和足够身份提示。

别名命中不代表别名是当前正式名称，不得自动替换页面标题。

同名或相似名称必须通过稳定 ID、场所、出生年份或其他已发布身份信息区分。

## 19. 媒体总原则

采用 fail-closed：

> 没有可验证媒体记录，就不发布媒体。

以下事实均不构成公开使用权：

- 文件存在于仓库；
- 浏览器能加载；
- 来源页面公开；
- 搜索引擎可找到；
- 文件名像某只熊猫；
- EXIF 包含信息；
- 设计稿以前使用过；
- 生产页面已经显示过。

## 20. 媒体发布记录

每个公共资产必须对应受版本控制的媒体记录，至少包含：

- 稳定媒体 ID；
- 媒体类型；
- 原始来源 URL 或受控内部来源；
- 原始发布者；
- 创作者或摄影者，如已知；
- 描绘主体及身份置信范围；
- 拍摄或制作日期及精度；
- 许可名称或授权依据；
- 许可原文 URL 或授权记录引用；
- 允许用途；
- 是否允许复制、代理、裁切、压缩、格式转换与衍生；
- 必须使用的署名文本；
- 地域、期限、平台或展示限制；
- 审核日期；
- 到期或复核日期，如适用；
- 对应公共来源 ID；
- 当前发布状态；
- 原始与衍生文件 checksum。

文件名、Git 历史和代码注释不足以替代记录。

## 21. 媒体许可状态

### 已许可 `licensed`

许可或授权范围明确，允许当前用途。

### 公共领域 `public-domain`

公共领域依据已审核并记录。

### 来源链接限定 `source-link-only`

可以链接来源页面，但不得复制、代理、缓存或重新展示媒体。

### 无已许可媒体 `no-licensed-media`

没有可安全公开的媒体，使用设计化空状态。

### 待审核 `pending-review`

只允许内部，不进入 production public projection。

### 已到期 `expired`

授权期限结束，必须撤下。

### 已撤回 `withdrawn`

权利人、来源或审核流程要求停止使用。

### 未知 `unknown`

许可依据不足，公开行为等同不可发布。

生产只可直接渲染 `licensed` 或 `public-domain`。

## 22. 媒体主体身份

个体档案媒体必须明确支持该身份。

不得：

- 将通用熊猫图重新标记为具体个体；
- 因同一机构、家族或时间段推断身份；
- 将无法区分的多只熊猫同框图作为单个个体头像；
- 将身份只支持到“未确认个体”的图作为 hero、档案头像或搜索封面；
- 通过裁切删除会改变身份和事件判断的上下文。

多主体媒体必须说明：

- 可确认主体；
- 画面位置；
- 无法确认部分；
- 来源与身份依据。

## 23. Documentary、Illustrative 与 Decorative

### 档案媒体 `documentary`

- 描绘已确认主体、场所或事件；
- 可以进入档案、时间线和事实模块；
- 必须携带身份、日期、来源、许可与署名。

### 说明性媒体 `illustrative`

- 解释物种、栖息地、竹林或一般背景；
- 必须标记“示意图片”或等价文案；
- 不得放置在易被误认为具体个体照片的位置；
- alt 不得包含具体熊猫身份。

### 装饰媒体 `decorative`

- 不承载事实；
- 使用空 alt；
- 许可记录仍必须存在；
- 不得被 structured data 或社交预览当作档案媒体。

“示意”不构成许可豁免。

## 24. 署名与许可呈现

可见媒体至少提供：

- caption 或上下文说明；
- 摄影者或来源署名；
- 许可名称；
- 原始来源链接；
- 必要修改说明。

短署名可以紧邻媒体，完整信息可以进入 Disclosure。

不得：

- 只在仓库内部保留署名；
- 将 PandaAtlas 视觉包装误写成原始媒体所有权；
- 改写许可要求的固定措辞；
- 隐藏 attribution 以保持视觉简洁。

## 25. 衍生媒体

以下均属于受控衍生：

- 压缩；
- 尺寸调整；
- 格式转换；
- 裁切；
- 色彩调整；
- 缩略图；
- 社交分享图；
- 视频片段和字幕版本。

记录必须包含：

- 原始资产 ID；
- 转换步骤；
- 衍生 checksum；
- 是否允许修改；
- focal point 或裁切规则；
- 修改说明是否需公开。

不得通过 WebP、截图、镜像或重新托管规避原许可。

不得进行会改变事实的生成式扩图、对象移除、背景替换或内容修复。

## 26. AI 生成与 AI 重构媒体

首个 Public Beta 不使用 AI 生成或 AI 重构的：

- 熊猫个体照片；
- 历史事件图；
- 机构场景；
- 地图证据图；
- 来源截图修复；
- 看似真实的档案媒体。

未来若使用纯装饰生成图，必须另行决策，并满足：

- 清楚标记；
- 不靠近档案事实形成误认；
- 不模仿真实摄影来源或机构品牌；
- 评估模型许可、训练数据与无障碍风险。

## 27. 热链接与外部图片

默认不直接热链接第三方图片。

只有来源明确允许嵌入且稳定性、隐私和追踪风险已评估时，才可通过独立 adapter 使用。

默认处理：

- 有复制许可：导入受控媒体存储；
- 只有查看权：`source-link-only`；
- 权利不明：`no-licensed-media` 或 unavailable。

“浏览器能加载”不代表允许公开嵌入。

## 28. 视频、音频与第三方 embed

公开使用必须：

- 提供标题和内容说明；
- 有字幕或文字记录；
- 不自动播放；
- 不依赖声音表达关键信息；
- 不作为理解关键事实的唯一方式；
- 明确第三方隐私、Cookie 与网络影响；
- 默认点击后加载追踪脚本；
- 供应商不可用时提供文字替代。

社交媒体帖子只能作为有来源引用或外部链接，不能因 embed 外观成为已审核事实。

首个 Beta 不建立通用视频、轮播或 embed framework。

## 29. 地图、底图与导出许可

地图模块分别记录：

- 底图供应商；
- 数据提供者；
- 样式许可；
- attribution 文本和链接；
- 使用限制；
- 缓存规则；
- 离线权限；
- 截图和导出权限；
- 数据快照日期。

底图许可与 PandaAtlas 叠加数据来源必须分开呈现。

地图截图、分享图和导出必须保留必要 attribution。

供应商条款不允许导出时，不提供导出功能。

## 30. 媒体撤下

媒体进入 `expired`、`withdrawn` 或 `unknown` 时：

- 当前发布版本不得继续引用；
- 新投影切换为空状态；
- 清理 CDN 与衍生缓存；
- Open Graph、structured data 和 alt 不得继续泄露；
- 修订历史记录许可状态变化；
- 不公开 restricted 内部备注。

## 31. 现有仓库媒体迁移政策

当前 `apps/web/public` 中没有配套媒体记录的熊猫与编辑图片统一视为未审核迁移债务。

- 不享有祖父条款；
- 未逐项审核前，不得进入新系统切片；
- 身份或许可无法确认时删除或隔离；
- 首个可信档案切片优先使用高质量无媒体状态；
- legacy profile 中跨个体复用并重新标记的图片必须退出。

## 32. 公共 UI 状态总原则

每个状态必须：

- 说明发生了什么；
- 说明受影响范围；
- 保留已知且可验证内容；
- 提供一个清楚的下一步；
- 使用机器可读语义；
- 不仅依赖颜色、图标或插画。

## 33. Loading

Loading 仅在确实等待数据或模块时出现。

必须：

- 保留页面标题、导航与已有上下文；
- 明确加载对象；
- 避免反复 live-region 播报；
- 长时间请求提供返回、取消或替代路径；
- 完成后保持用户任务焦点。

不得：

- 使用空白页；
- 显示虚构内容；
- 服务器已有数据时再次客户端等待；
- 用装饰动效延迟内容。

## 34. Skeleton

Skeleton 只用于稳定、可预测结构。

必须：

- 与最终结构近似；
- 不包含看似真实姓名、数字、图片或文字；
- 对读屏隐藏；
- reduced motion 下停止持续脉冲；
- 附近仍有可感知 loading 状态。

不得用于：

- 未知高度长文；
- 复杂关系图；
- 无法预测的媒体组合；
- 伪造“内容已存在”的事实卡片。

## 35. Empty

Empty 表示请求成功，集合确实没有匹配项。

### 空搜索结果

推荐：

> 当前查询和筛选下没有匹配档案。

提供：

- 查询与筛选摘要；
- 清除或调整筛选；
- 返回完整图鉴；
- 不自动修改用户条件。

### 无已发布领域记录

推荐：

> 当前公开档案中尚无已发布的迁移记录。

不表示：

- 现实中从未发生；
- 已确认不存在；
- 加载失败。

除非来源支持否定结论，否则使用“暂无已发布记录”，不写“没有”。

## 36. Unavailable

用于：

- 当前发布数据不可访问；
- 没有可验证缓存；
- 必要模块失败且无安全替代；
- 资源被撤回；
- 当前 locale 或 route 尚未发布。

必须说明：

- 哪部分不可用；
- 其他内容是否仍有效；
- 是否可以重试；
- 是否有结构化替代；
- 问题是否可能暂时。

不得返回 fixture 继续显示成功页。

## 37. Error

Error 描述用户动作失败，例如：

- 搜索失败；
- 加载下一页失败；
- 更新地图快照失败；
- 收藏、复制或分享失败。

必须：

- 使用可理解文案；
- 保留已成功内容；
- 提供具体恢复动作；
- 不暴露 stack、内部服务、Token 或敏感标识；
- 避免无限自动重试。

错误不应无依据归咎用户。

## 38. Offline

Offline 是浏览器环境状态，不等于所有数据不可用。

可以继续显示：

- 已加载页面；
- 已验证发布缓存；
- 本地收藏；
- 已有结构化内容。

必须提示：

> 当前处于离线状态。以下内容来自已加载的发布版本，可能无法刷新。

不得声称：

- 内容仍最新；
- 来源链接可访问；
- 增量请求已经成功。

恢复网络后提供手动刷新，不突然替换用户正在阅读的内容。

## 39. Cached / Degraded

DegradedState 使用已确认 delivery 状态，例如 `cached` 或 `partial`。

必须显示：

- 发布版本；
- 发布或缓存日期；
- 哪些能力受影响；
- 哪些内容仍可信；
- 重试或结构化路径。

示例：

> 实时地图服务暂不可用。当前列表与统计来自发布版本 2026.07.14.3；地图交互和最新视口查询暂不可用。

不得只写“使用备用数据”。

## 40. Partial / Incomplete

适用于：

- 查询被截断；
- 部分模块失败；
- 档案只发布部分领域内容；
- 地图只返回当前视口；
- 当前语言缺少编辑摘要；
- 服务达到安全上限。

必须说明：

- 已显示什么；
- 缺少什么；
- 为什么不完整；
- 是否能扩大范围或继续加载；
- 聚合数字针对什么集合。

partial 数据不得支撑全量排名和总量。

## 41. No media

按媒体许可状态呈现：

- `no-licensed-media`：当前没有获准公开媒体；
- `source-link-only`：只提供来源页面；
- `expired / withdrawn`：中性空状态并在修订历史记录撤下。

No-media 必须保留身份与事实，不使用无关熊猫照片填空。

## 42. No map

地图不可用时，结构化路径是一等界面。

必须保留：

- 当前模式和筛选；
- 当前地域或视口摘要；
- 地点或记录列表；
- 数量及范围限定；
- 来源和快照日期；
- delivery 状态；
- 普通链接进入档案、机构或场所。

不得只显示“地图暂不可用，请稍后再试”。

## 43. No lineage graph

谱系图失败时必须保留：

- 焦点熊猫；
- 已发布父母关系；
- 子代和当前范围关系；
- 每条关系状态和来源；
- 普通链接；
- 当前深度和筛选说明。

图形不得成为关系数据唯一表现。

## 44. Not Found、Withdrawn 与 Unpublished

必须区分：

### 404 Not Found

没有对应公开实体或合法 route。

### 已撤回

实体曾公开但当前版本撤回。依据安全和产品政策显示中性说明。

### 未发布

内部可能存在，但公共界面不得确认存在。

### 旧 slug

永久重定向到 canonical route。

### 无权限内容

公共 route 不泄露内部记录、草稿状态或审核原因。

不得通过错误文案确认未发布实体存在。

## 45. 状态优先级

同一区域存在多个问题时，主状态按以下顺序：

1. 安全或发布限制；
2. 不可验证来源；
3. unavailable 或 error；
4. partial 或 degraded；
5. stale；
6. empty；
7. normal content。

示例：API 失败后 fixture 为空，主状态是 unavailable，不是 empty。

## 46. 共享状态 pattern 的最低结构

每个状态 pattern 至少包含：

- 简明标题；
- 原因说明；
- 受影响范围；
- 已保留内容；
- 一个主要恢复动作；
- 必要时替代路径；
- 机器可读语义；
- 合适且不过度的 live-region 行为。

图标、颜色和插画只作辅助。

## 47. 自动重试

- 首次瞬时失败可以有限重试一次；
- 用户提交动作不得无提示重复；
- 不无限轮询；
- 恢复后不重置筛选、滚动和选择；
- 重试仍失败，进入 Error 或 DegradedState；
- 搜索和地图请求处理取消与竞态；
- 旧响应不得覆盖新状态。

## 48. Public Content Envelope

所有公开 page 与 feature 只消费明确 Envelope，不自行猜测来源和状态。

概念结构：

```ts
interface PublicContentEnvelope<TData> {
  data: TData | null;
  release: PublicReleaseMetadata;
  delivery: PublicDeliveryStatus;
  locale: PublicLocaleCoverage;
  coverage: PublicCoverage;
  sources: PublicSourceSummary[];
}
```

### 48.1 `data`

只包含当前任务所需、允许公开的 view model。

不得包含：

- curator notes；
- internal completeness score；
- review ownership；
- translation drafts；
- restricted attachment；
- unpublished identifiers；
- sensitive precise wildlife coordinates。

### 48.2 `release`

至少包含：

- data version；
- Public Schema version；
- projection version 或 checksum；
- publication time；
- withdrawal state。

### 48.3 `delivery`

受控值：

- `live`；
- `cached`；
- `partial`；
- `unavailable`；
- `preview`；
- `demo`。

生产不得接受 `demo`。

### 48.4 `locale`

至少包含：

- requested locale；
- actual available locale；
- missing fields 或 modules；
- 是否发生原文降级；
- translation review state。

### 48.5 `coverage`

至少包含：

- 集合定义；
- 是否完整；
- 截断原因；
- total 是否可信；
- 当前视口、时间点、筛选或分页范围。

### 48.6 `sources`

包含当前页面使用的公共来源摘要、访问状态、最后核实日期和支持范围。

组件不得通过 `data.length === 0` 推断 empty，也不得通过 HTTP 200 推断 live。

## 49. 事实级 Metadata

关键事实统一携带：

```ts
interface PublicFactValue<TValue> {
  value: TValue | null;
  conclusionStatus: PublicConclusionStatus | null;
  freshness: PublicFreshness;
  precision: PublicPrecision;
  sourceIds: string[];
  lastVerifiedAt: string | null;
}
```

必要时包括：

- candidate values；
- superseded values；
- start/end precision；
- location precision；
- applicable period；
- uncertainty explanation。

Page 不得将这些压平成字符串后丢失状态。

## 50. 内容所有权

### 领域与发布层

拥有：

- 事实值；
- conclusion status；
- freshness policy；
- precision；
- source association；
- publication / withdrawal；
- media license state；
- 可公开 revision summary。

### 前端内容策略层

拥有：

- 双语术语；
- 状态标题和解释模板；
- 日期、数字和列表格式；
- 精度的可读表达；
- CTA 文案规则；
- Editorial register 语气。

### Feature module

拥有：

- 当前任务展示字段；
- pattern 组合；
- 用户交互；
- 产品计算。

不得重新判断事实可信度、freshness 或媒体许可。

### CSS 与视觉层

不拥有真实性判断。

## 51. 禁止前端自行推导

前端不得自行推导：

- 当前场所；
- 关系是否 confirmed；
- 事件是否 completed；
- 数据是否 stale；
- 媒体是否可公开；
- 来源是否足够；
- 档案是否完整；
- 实体是否热门；
- 数量是否代表全球总量。

前端可以计算当前筛选、排序和关系路径，但必须标记为产品计算。

## 52. Fail-closed 条件

以下情况阻断构建、投影或公开运行：

- confirmed 事实没有公共来源；
- 时效性事实没有 last verified 或 freshness policy；
- 精确日期缺少精度依据；
- 具体 Place 只有国家级证据；
- 媒体没有许可记录；
- 当前 locale 是 draft 或 unreviewed；
- 来源处于禁止发布状态；
- production 响应使用 demo fixture；
- partial 集合显示无范围限定总量；
- withdrawn 版本仍由当前指针引用；
- restricted 字段进入 browser payload；
- illustrative media 被标成具体个体；
- 来源原文与译题混淆。

不得静默修复为默认值。

## 53. 自动检查

默认检查应覆盖：

- 所有 conclusion status 属于受控枚举；
- confirmed 至少关联允许公开来源；
- disputed 保留多个候选，不选择无标记主值；
- 时效性字段具有核实日期和 freshness；
- 页面或结果 Envelope 始终有 delivery；
- partial 具有 coverage 和缺失范围；
- production 不包含 demo 或未审核 preview；
- 公共媒体全部存在 manifest；
- 未许可媒体不进入构建资产、Open Graph 和 structured data；
- 两个 locale 的关键状态、数字和链接语义对等；
- UI fixture 覆盖 loading、empty、error、offline、cached、partial、no-media、no-map、no-lineage-graph；
- 静默 fallback 调用点只降不升；
- no-media 不引用其他个体图片；
- 来源状态变化会触发 freshness / review；
- 撤回资源不会继续出现在生成物。

## 54. 人工评审

以下不能仅靠自动化：

- 来源是否真正支持结论；
- 翻译是否增加或削弱确定性；
- 编辑文案是否暗示不存在的事实、感情或社会证明；
- 图片主体身份是否可靠；
- 许可条款是否覆盖具体用途；
- illustrative 是否可能被误认为 documentary；
- error / degraded 文案是否让普通用户理解范围；
- CTA 是否准确；
- 媒体裁切是否改变事实；
- disputed 呈现是否公平表达冲突。

人工记录应包含审核人、日期和版本，但个人信息不得进入公共投影。

## 55. Preview 与测试 fixture

### Preview

- 持续标记；
- `noindex`；
- 不进入正式 sitemap、统计、缓存和搜索；
- 不混入 production release；
- 允许展示 pending 状态仅用于授权评审者。

### Demo fixture

- 仅本地和测试；
- 浏览器测试显式声明数据来源；
- 不通过 API 失效自动进入成功基线；
- 不进入 production bundle 或 public runtime。

### 降级测试 fixture

应使用明确的已发布缓存 fixture，并验证 `cached` 或 `partial`，而不是静默 fixture。

## 56. 迁移顺序

1. 为所有公共 API adapter 增加 release、delivery、coverage 与 origin metadata；
2. 禁止 detail、list、lineage、stats、habitats 返回无 discriminator fallback；
3. 将可信档案结论、来源、freshness 与媒体状态抽成共享 view model；
4. 建立状态、来源和双语术语 registry；
5. 建立媒体 manifest 和构建门禁；
6. 用 unavailable、cached、partial 替换静默 fixture；
7. 删除无来源性格、热门分数、标签、替代图、虚构统计和无效 CTA；
8. 为 route 建立 loading、error、not-found 与 degraded boundaries；
9. 为地图与谱系建立一直存在的结构化等价界面；
10. 增加 CI 预算，保证旧模式不增长。

迁移必须与 [前端系统边界与 Token / 模块架构](../architecture/frontend-system-boundary-and-token-component-architecture.md) 的垂直切片策略一致。

## 57. 首个实施切片中的内容要求

首个“语言化 Product Shell + 全局导航 + 全局搜索 + 可信档案首屏”必须展示并验证：

- Envelope 的 release 与 delivery；
- 关键事实 conclusion status；
- current place freshness；
- 事实级来源入口；
- 页面级来源摘要；
- 中英文名称和缺失翻译处理；
- no-licensed-media 或 source-link-only；
- cached、partial、unavailable 至少各一个 fixture；
- 404、旧 slug redirect 与 unpublished 不泄露；
- 无 JavaScript 下仍可读取核心事实和来源。

## 58. 架构验收场景

后续实现至少验证：

1. confirmed 当前场所同时具有 source、last verified、freshness 和 precision。
2. confirmed 但 stale 的场所使用“截至某日最后确认”。
3. provisional 关系在卡片、图谱和线性列表中保持 provisional。
4. disputed 事实显示多个候选，不无标记选择一个。
5. superseded 值只出现在修订历史。
6. 未知事实不显示 `0` 或默认字符串。
7. API 正常时 delivery 为 live。
8. 正式缓存降级时显示版本和受影响能力。
9. 没有正式缓存时进入 unavailable，不使用 demo。
10. partial 结果说明 coverage 和截断范围。
11. partial 集合不显示无范围限定全量总数。
12. 首页无无来源社会证明数字。
13. “热门”排序不存在，或具有完整审计指标。
14. 编辑精选明确标记为编辑选择。
15. CTA 目的地与文案一致。
16. 事实级来源可通过键盘到达。
17. 页面来源区区分 published、last verified 和 revision 日期。
18. changed 来源触发相关内容复核。
19. restricted 来源不被写成公众可验证。
20. 修订摘要描述具体事实变化。
21. 重大更正不会静默改写历史。
22. 英文名称缺失时显式标记，不静默 fallback。
23. 英文与中文保持相同不确定性和精度。
24. 来源译题明确标记为 PandaAtlas 翻译。
25. 未审核翻译不能进入 production。
26. 每个公共图片具有 media manifest 记录。
27. 个体 hero 图身份与档案一致。
28. illustrative media 不被误认为个体照片。
29. source-link-only 不代理第三方媒体。
30. no-licensed-media 不使用无关熊猫图。
31. expired / withdrawn 媒体从 Open Graph 和缓存撤下。
32. 地图 attribution 在所有响应式状态可见。
33. 地图导出遵守供应商条款。
34. loading 保留页面上下文。
35. skeleton 不包含伪造事实。
36. empty 与 unavailable 使用不同文案和语义。
37. offline 保留已加载发布内容并说明无法刷新。
38. no-map 保留结构化地点列表。
39. no-lineage-graph 保留关系列表、状态和来源。
40. 404 不泄露未发布实体存在。
41. 旧 slug 永久重定向 canonical route。
42. Envelope 的 HTTP 200 不自动等于 live。
43. 前端不重新推导 current place、freshness 或 media license。
44. production 构建不包含 demo fixture。
45. 浏览器测试显式声明 fixture origin。
46. 旧静默 fallback 数量只降不升。
47. 所有状态不只依赖颜色或图标。
48. reduced motion 下 skeleton 与状态动画不持续脉冲。
49. 来源和媒体外链具有准确可访问名称。
50. 结构化数据不包含撤回、未许可或未审核内容。

## 59. 对后续 Wayfinder 票的约束

### Prototype the cross-surface PandaAtlas design language

原型必须同时展示：

- confirmed、provisional、disputed、stale；
- live、cached、partial、unavailable；
- 事实级来源与页面来源区；
- 中英文名称和缺失翻译；
- documentary、illustrative、no-media、source-link-only；
- loading、empty、error、offline、no-map、no-lineage-graph；
- 更正与修订摘要；
- 无 JavaScript 结构化等价界面。

不得只展示理想 live / confirmed / licensed 桌面状态。

### Define frontend quality gates and visual verification

质量门禁必须验证：

- Envelope 结构；
- truth-state 枚举与组合；
- fixture / preview 隔离；
- 双语语义对等；
- 媒体 manifest 与撤下；
- 所有 UI 状态 fixture；
- 地图和谱系结构化等价路径；
- 人工来源、翻译和许可评审记录。

### Create the phased frontend implementation handoff

实施计划必须：

- 按 vertical slice 迁移真实性状态；
- 明确旧静默 fallback 删除点；
- 为每个 route 定义 live、cached、partial、unavailable；
- 将媒体清单与旧图片退出纳入依赖；
- 不把文案替换当成完成；
- 为第一切片提供无需新政策决策的 acceptance criteria。

## 60. 非目标

本规范不决定：

- 每个事实的最终来源选择；
- 每张现有图片的最终许可结论；
- 具体 freshness 天数；
- 最终状态组件视觉稿；
- 完整翻译工作流工具；
- 编辑故事选题；
- 新账户、评论、社交或捐赠功能；
- 生产缓存基础设施实现；
- 地图供应商更换；
- 后端审核 UI 重设计。

这些内容可以由后续实施票决定，但不得破坏本文的真实性、精度、双语、媒体和状态边界。

## 61. 最终决议

PandaAtlas 的可信度不能由一个“已验证”徽章、页面底部来源列表或精美无媒体插画产生。

可信度来自完整链路：

> 领域层给出可发布事实、结论状态、精度、来源和新鲜度；发布层给出不可变版本和撤回边界；Public Content Envelope 携带交付、语言、coverage 和来源；前端 pattern 将这些状态准确呈现；媒体通过身份和许可清单进入；失败与缺失通过不同 UI 状态诚实暴露；自动门禁阻止结构性越界，人工评审判断真实支持关系。

系统在任何时候都必须能够选择“不显示”，而不是为了视觉完整度选择“看起来可能正确”。
