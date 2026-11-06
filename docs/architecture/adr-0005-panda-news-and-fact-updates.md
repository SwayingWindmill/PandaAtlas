# ADR 0005：熊猫动态与事实更新

- 状态：提议（2026-11-06）
- 修订：ADR-0004 的第 4 层（智能处理层）和"部署"；ADR-0003 对定时发布的适用方式
- 不变：ADR-0001。`services/api` 仍是唯一写入 Supabase 的地方

## 背景

ADR-0004 把采集结果推给 AIHOT，但没有说处理完的内容去哪里。运营者的要求是：动态放进吱熊猫自己的网站和 App；这些内容既要做成每日动态，也要补充站内的熊猫资料（出生、去世、转移、命名）；审核发布参考 AIHOT，不要过度防御。

核对代码后，有这些事实决定了设计：

1. **AIHOT 的推送接口丢掉了正文。** `ingest/items.ts` 只把 `title`、`url`、`publishedAt`、`author`、`raw` 交给 `upsertMaterial`，而 `upsertMaterial` 本来就支持 `bodyText`、`excerpt`、`media`。AIHOT 对只有标题的资料“先等待材料，不评分”，再去抓原文页补正文。小红书、抖音、微博的原文页要登录，所以社媒内容会一直停在等待状态。
2. **AIHOT 的处理流水线值得直接用。** 预筛、两次独立评分、结构化、写作、翻译、事件归组（四种关系判断，带评测脚本）、热度、付费请求回执与预算熔断，重写的代价远高于维护一个分支。
3. **AIHOT 现有的同步接口不能直接喂给我们。** `/api/v1/selected/changes` 按文章记账，每个事实只保留一篇代表报道。载荷里没有事件 id、热度、图片、实体和平台。代表报道换了，旧的那篇会以 `remove` 出现，但它并没有被撤回。事件合并后旧 id 变成别名（`events/merge.ts`）。AIHOT 的模块有 `articleChanged` 回调（带 `previousStoryIds`）和自己的 `http` 插口（`packages/backend/src/modules.ts`），可以在模块里另建一条按事件记账的变更流。
4. **AIHOT 推送进来的信源默认是 `T2`、`isolated`，不参与精选。** 分级要由我们来设。按采集目标定级也不对：关键词目标会抓到任何作者的帖子，转发会把粉丝的帖子算成机构发的。分级必须按帖子的原作者账号来定。
5. **我们这边改一条熊猫事实的成本很高。** 现在要手写一条 SQL 迁移，再跑一次 `release.publish`。评审路径只能写 `panda.fact_conclusions` 的单个字段，写不了生命事件、居住地、名字和新熊猫。同一件事分散在几处：去世是两个事实加一个死亡事件；所在地是两个事实、一条居住记录，海外熊猫还有海外状态目录。事实键是自由字符串，`birth_date` 和 `birth.date` 并存。
6. **发布有固定成本。** 构建会快照全部当前事实，在 GitHub Actions 里直连数据库运行；每次激活都会清空整个边缘缓存。在 Worker 的 15 分钟定时任务里每小时发布一次，既跑不动，也会让 24 小时缓存失效。
7. **事实变更的量很小。** 出生、去世、转移、命名，一年几百条，平均每天不到一条。

## 决定

### 1. 分工

| 部分 | 由谁负责 |
|---|---|
| 社媒采集（小红书、抖音、微博、B 站） | `services/collector`（ADR-0004） |
| 官网 RSS、无 RSS 的官网列表、JSON 接口、微信公众号、X | AIHOT 的信源读取器。采集器删掉自己的 `rss` 适配器 |
| 预筛、评分、结构化、写作、翻译、归组、热度 | AIHOT |
| 内容运营后台（信源、内容诊断、重新归组、模型与评测、付费上限） | AIHOT 后台，只对运营者开放 |
| 熊猫动态变更流、熊猫事实抽取、账号分级 | AIHOT 模块 `modules/panda`（不改框架代码） |
| 熊猫身份、事实、发布、公开读取 | `services/api`（ADR-0001） |
| 动态展示、熊猫热度榜、动态页 SEO 和分享图 | 吱熊猫网站和 App |
| 治理后台（审计、权限、发布、事实确认） | 吱熊猫后台 |

AIHOT 只在内部运行，它的网页、RSS、MCP 不对外开放。需要动态 RSS 时，由 `services/api` 提供。

### 2. 数据流

```text
collector ──ingest（正文、图片、原作者账号）──▶ AIHOT ──精选、归组、热度
                                                 │
                                   modules/panda（articleChanged 回调）
                                     ├─ /api/panda/news/changes   按事件记账的动态变更流
                                     └─ /api/panda/facts/changes  事实候选变更流
                                                 │
services/api 定时任务（每 15 分钟拉取，按游标续传）◀──┘
   ├─ news.*：动态，立即可读
   └─ fact_candidates ──确认（或按种类自动）──▶ 事实写入 ──▶ 定时发布
```

`services/api` 主动拉取，AIHOT 不持有写入吱熊猫的凭据。AIHOT 主机通过 Cloudflare Tunnel 暴露 `modules/panda` 的两个只读接口，用 Cloudflare Access 服务令牌鉴权。

### 3. AIHOT 分支的改动

- **框架只改一处：推送接口接收 `bodyText`、`excerpt`、`media`、`externalId`。** 有正文的条目不再等待抓原文。先提给上游。
- **账号登记表。** 采集器的目标增加 `institution`（机构 slug）和 `role`（`institution`、`official`、`media`、`fan`）。一个脚本从 `data/collector/targets.yaml` 生成 AIHOT 的信源（`editorial`，分级 `T1`、`T1_5`、`T2`）和 `modules/panda` 的账号登记表。推送时带上帖子原作者的平台账号 id；转发带被转发的原帖作者。`sourceTier` 按原作者账号查登记表，查不到就是 `fan`。
- **熊猫行业包。** 提示词改成熊猫领域；实体表由脚本从吱熊猫已发布的熊猫和机构生成，包括别名和拼音、英文写法；评分门槛用 100 到 200 条标注样本重新校准。
- **`modules/panda`。** 两条变更流各有自己的账本和纪元（与 `v1.ts` 的约定相同：游标、`409 snapshot_required`、快照）。事实抽取跑在所有通过预筛的 `T1`、`T1_5` 资料上，不只是精选的，因为机构的简短公告往往评分不高。

### 4. 熊猫动态

`services/api` 新增 `news` 模块，表不进发布版本。条目 id 稳定，事件是派生出来的分组：

```ts
interface NewsItem {
  itemId: string;                 // AIHOT 文章 id，稳定
  storyId: string;                // 当前所属事件；事件合并后由变更流改写
  url: string;
  author: { platform: Platform; accountId: string; name: string };
  sourceTier: "institution" | "official" | "media" | "fan";
  publishedAt: string;
  title: string;
  summary: string;
  coverKey?: string;
  withdrawnBySource: boolean;     // 只有 AIHOT 明确撤回时为 true
  hiddenByOperator?: { reason: string; at: string; by: string };
}

interface NewsStory {
  storyId: string;
  aliases: string[];              // 合并进来的旧事件 id
  title: string;
  summary: string;
  heat: number;
  pandaIds: string[];
  placeIds: string[];
  lastUpdatedAt: string;
}

type Platform = "weibo" | "douyin" | "xhs" | "bilibili" | "wechat" | "x" | "web";
```

- **变更流的条目：** `story.upsert`、`story.merged {from, into}`、`item.upsert`、`item.withdrawn`。代表报道变化不产生撤回。
- **公开接口：** `GET /api/v2/news`（按熊猫、地点、日期筛选，游标分页），`GET /api/v2/news/stories/:storyId`（旧 id 跳转到合并后的事件），`GET /api/v2/news/hot-pandas`（近 7 天事件热度汇总到熊猫，和按关注数排的“大家常看”并列）。一个事件公开，当且仅当它至少有一条未撤回、未被隐藏的条目。
- **先发布，后纠正。** 和 AIHOT 一样，精选结果直接公开，没有事前审核。运营者在吱熊猫后台隐藏条目或整个事件（写在其全部条目上），写明理由，操作进审计。隐藏跟着条目走，事件合并后依然有效。
- **同步：** 每次定时任务最多处理固定页数，记下“已追上”或“还落后多少”。收到 `409` 时取快照全量对账，快照里没有的条目记为 `withdrawnBySource`。同步超过 2 小时没有前进就告警。
- **缓存：** 熊猫页、机构页上的动态区块由客户端读取，不进 24 小时缓存。事件页有自己的短缓存路由、站点地图条目和分享图。
- **图片：** 封面由 AIHOT 主机上传到 R2 的公开前缀 `news/<sha256>`，`services/api` 只存对象键。第一阶段只转存机构账号的封面，其他条目只显示文字和原文链接。

### 5. 事实更新

**候选的形状：**

```ts
type FactChange =
  | { kind: "birth"; mother: PandaRef; father?: PandaRef; place: PlaceRef; date: DayOrMonth; ordinal: number; sex?: "male" | "female" }
  | { kind: "death"; panda: PandaRef; date: DayOrMonth }
  | { kind: "transfer"; panda: PandaRef; from?: PlaceRef; to: PlaceRef; date?: DayOrMonth; phase: "announced" | "completed"; overseasStage?: OverseasStage }
  | { kind: "naming"; panda: PandaRef; name: string; status: "proposed" | "official"; date: DayOrMonth };

interface FactCandidate {
  candidateKey: string;           // 由变更本身算出，见下文
  change: FactChange;
  evidence: { itemId: string; url: string; author: NewsItem["author"]; sourceTier: NewsItem["sourceTier"]; quote: string; publishedAt: string }[];
  extractedBy: { model: string; promptVersion: string };
}
```

`DayOrMonth` 不允许“未知”精度：抽不到日期的转移只能是 `announced`。`PandaRef` 和 `PlaceRef` 是名字、别名或 slug，由 `services/api` 解析。

**身份按事实，不按事件。** `candidateKey` 由种类、解析后的熊猫 id（出生用母亲 id 加序号）、目标地点和按月取整的日期算出。事件合并、重新抽取都落到同一个候选上，只是追加证据。

**判定是一个纯函数，按种类定义冲突：**

| 情况 | 结果 |
|---|---|
| 熊猫或地点解析不到，或对应多个 | 需要指认 |
| 和现有事实一致 | 不变，只追加证据 |
| 去世：已有不同的去世日期 | 冲突 |
| 转移：`from` 和当前所在地不符，或日期早于最近一条居住记录的开始 | 冲突 |
| 出生：同一母亲 ±7 天内已有同序号的幼崽 | 冲突 |
| 命名：`status` 是 `proposed`（名字征集、投票） | 只作为动态，不进候选 |
| 证据里有原作者为相关机构的帖子（熊猫所在地；回国、转移时也认目的地机构），或有两个原作者不同的官方帖子 | 可自动生效 |
| 其他 | 来源不足 |

日期比发布日期早 30 天以上的说法不丢弃，按“来源不足”进队列，因为确实有晚几周才公布的去世。

**先确认，再按种类放开自动。** 每条候选都进后台的确认队列，同时记下判定函数“本来会怎么判”。运营者一键确认就执行，没有第二个审核人。某个种类的影子判定在至少 20 条真实候选上和人工结论一致率达到 95% 后，在配置里为这个种类打开自动生效，打开需要提 PR。这样做是因为事实变更一天不到一条，一键确认几乎不花时间，而一条错的去世公开出去，伤害远比晚几个小时大。动态那一侧则完全照 AIHOT，先发布后纠正。

**生效是一条有类型的命令。** `services/api` 为每个种类写一条命令，在一个事务里把这件事的所有表示一起写对：

- `death`：`life_status`、`death_date` 两个事实，加一个死亡事件。
- `transfer`：`announced` 写一个已公布的转移事件；`completed` 更新这同一个事件，改 `current_facility`、`current_coarse_location`，结束旧居住记录、开始新的，涉及海外时同步海外状态目录。
- `birth`：每只幼崽一条变更。建熊猫，slug 用 `<母亲 slug>-cub-<年份>-<序号>`，写出生事实、母亲关系和出生事件。不写临时名字，显示名由母亲和序号推出。
- `naming`：写正式名字，把幼崽 slug 改成旧 slug，换上按名字生成的新 slug。

事实键由一张登记表统一定义，命令只用登记表里的键。这一阶段同时写一条迁移，把现存重复的键（如 `birth.date`）并到登记表的键上。证据自动建成 `evidence.sources`。断言 id 用 `news:<candidateKey>:<fieldKey>`。

**撤销按种类各有反操作：** 事实写一条新断言恢复原值；新建的熊猫用现有的下架机制隐藏；居住记录恢复原状；名字删除。撤销后照常进入下一次发布。

**发布。** 有已写入、未发布的事实变更时，定时批处理以系统账号 `news-facts` 运行 `release.publish`，每天最多两次；后台另有“立即发布”按钮。有人手动回滚版本后，定时发布自动暂停，直到运营者恢复它。

### 6. 对 ADR-0003 的修订

- 确认队列里的每条事实，由一个人点击决定，和 ADR-0003 一致。
- 定时发布由系统账号执行，不再需要每次人工发起。每个版本都能追溯到具体的候选，也都能撤销或回滚。
- 将来某个种类打开自动生效后，责任人是判定规则本身。规则和开关写在代码里，改动必须提 PR，由运营者批准。
- 人工录入的事实和社区贡献，照旧走现有流程。

## 分阶段交付

每一步都以一个可以验证的结果结束：

1. **AIHOT 接入。** fork AIHOT，打推送接口补丁；采集目标补上 `institution` 和 `role`，生成信源和账号登记表；写熊猫行业包并用标注样本校准门槛；和采集器部署在同一台主机。验证：标注样本上的精选结果达到校准目标，一条小红书笔记推进去后被评分。
2. **动态和热度榜上线。** `modules/panda` 的动态变更流、`news` 模块、同步任务、三个公开接口、后台隐藏，网页和 App 的动态区块。验证：AIHOT 精选后 30 分钟内 App 的熊猫页能看到这条事件；合并两个事件后，旧 id 跳转，隐藏状态不丢。
3. **事实更新。** 事实键登记表和重复键迁移、事实变更流、候选同步、判定函数、四条命令、撤销、确认队列、定时发布。验证：用标注过的历史公告回放，统计抽取召回率；确认一条去世公告后，它出现在下一个版本里，撤销后恢复原值。
4. **按种类放开自动生效。** 验证：影子判定达到上面的门槛。
5. **图片与页面。** 封面转存、事件页分享图和站点地图。

App 现有的场馆动态（单行 JSON、人工录入）在第 2 步保持不变。动态上线后，场馆动态的时间线改为读取 `news` 中机构账号的条目，再删掉旧的目录表。

## 后果

- 运营者要维护一个 AIHOT 分支，和采集器部署在同一台主机（建议至少 2 核 4GB）。模型调用和公众号、X 信源按量付费。
- 熊猫动态由机器精选、直接上线，运营者事后纠正。
- 熊猫资料第一次能从动态里补充，不用再手写迁移。最初每条要一键确认，按种类证明准确后再自动生效。
- 事实的几种表示由同一条命令一起写入，不再各自漂移。
- AIHOT 自己的网页、RSS 和 MCP 不对外。将来需要时，在 `services/api` 里实现。
