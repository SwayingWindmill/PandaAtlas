# Panda Detail Content Template V1

## 目的

熊猫详情页不是“把研究记录逐条展示出来”的数据页，也不是固定的杂志长页。它应该把已经采集到的大量研究事实整理成一个稳定的个人档案模板：每只熊猫共享同一套内容语义，但只展示它真正拥有、且达到展示资格的数据。

核心原则：

1. 先回答“这是谁”，再回答“它是什么样的一只熊猫”，最后回答“它经历过什么、与谁有关、为什么重要”。
2. 页面结构由内容域驱动，而不是由数据库表或采集 category 直接驱动。
3. 不为完整感制造空模块；没有数据的域直接消失。
4. 不把 `publication_status` 当成研究库是否可用于产品的总开关；研究主库通过发布/展示投影进入页面。
5. 冲突、低置信、需要进一步核实的记录继续留在研究层，不在模板层自动裁决。
6. 正确的个体影像是绝对约束；无确认个体照片时使用明确的 no-photo 状态。
7. 日期精度、关系置信度、当前位置时效、野外地点敏感度必须被保留，不得为了 UI 简化而伪造精度。

---

## 研究库当前已经覆盖的内容类型

现有采集已经不只是出生、性别和家族关系。研究记录中实际存在的内容包括：

- 身份：`identity`、`alias`、`name_meaning`、`sex`、`birth`、`origin`、谱系号；
- 识别特征：`appearance`、`distinguishing_feature`；
- 个性与日常：`personality`、`preference`、`diet`、`behaviour`、`enrichment`；
- 饲养与照护：`husbandry_training`、`growth_measurement`、`health`、`veterinary_care`；
- 家族与繁殖：`relationship`、`social_relationship`、`reproduction`、`maternal_care`、`hand_rearing`；
- 生命周期：`public_debut`、`milestone`、`transfer`、`location`、`residency_history`、`death`；
- 野外经历：`rescue`、`release`，并包含救护地点、健康状况、放归方式、监测方式等结构化信息；
- 科研与保护：`research`、`conservation`；
- 历史与社会意义：`diplomacy`、`cultural_context`、`anecdote`；
- 媒体：经确认属于该个体的多张图片，以及 credit / rights / source；
- 来源：publisher、title、URL、source type、authority、source family、retrieved time。

典型记录已经可以描述非常具体的个体生活，例如性格、偏爱的食物、医疗脱敏训练、公开亮相、幼崽照护、救护和放归、历史文化影响等。因此详情模板必须显式保留这些语义，不能再全部压进 `highlights[]`。

---

# 一、页面内容结构

## 1. Identity / 身份封面 —— 必选

### 用户要回答的问题

“这是谁？”

### 展示内容

- 主肖像；
- 中文名 / 英文名；
- 正式名、常用别名、历史名（有时才出现）；
- 性别；
- 出生日期或出生年份，保留原始精度；
- 出生地 / 来源地；
- 当前生命状态；
- 当前或最近确认居住地；
- 国际谱系号；
- 野生来源 / 圈养出生等 origin type（有数据时）；
- 一句“记忆点”。

### “记忆点”选取规则

优先级：

1. distinguishing feature / appearance；
2. 官方或机构明确描述的 personality；
3. name meaning；
4. 具有代表性的 milestone；
5. 不生成无来源营销文案。

例如“白手套妹妹”应该属于身份层的记忆点，而不是被埋在普通列表里。

---

## 2. Recognition / 怎么认出它 —— 条件模块

### 用户要回答的问题

“它长什么样？有什么明显特点？”

### 数据来源

- `appearance`
- `distinguishing_feature`
- 与识别有关的 `identity`
- 经确认的细节照片

### 展示内容

- 外貌特征；
- 毛色、体型、眼圈、耳朵、四肢等可可靠区分的特征；
- 特殊昵称产生的外观原因；
- 1–3 张能帮助识别的正确个体照片。

这是“熊猫图鉴”区别于一般动物百科的重要模块。

---

## 3. Personality & Daily Life / 性格与日常 —— 条件模块，优先级高

### 用户要回答的问题

“它是一只什么性格的熊猫？平时喜欢什么？”

### 数据来源

- `personality`
- `preference`
- `diet`
- `behaviour`
- `enrichment`

### 内容分组

#### 性格

例如活泼、谨慎、独立、敏感、喜欢护理员陪伴等，只展示有明确来源的机构描述或观察记录。

#### 喜欢什么

- 喜爱的食物；
- 喜欢的玩具 / 丰容；
- 喜欢的活动、姿势、环境或互动。

#### 日常习惯

- 作息；
- 行为特点；
- 有代表性的日常观察。

该模块应以短内容块呈现，而不是时间线。

---

## 4. Family / 家族 —— 条件模块，优先级高

### 用户要回答的问题

“它从哪里来？和哪些熊猫有关系？”

### 关系层级

- 父亲；
- 母亲；
- 同胞 / 双胞胎；
- 兄弟姐妹；
- 配偶 / 繁殖伙伴 / 长期同伴（语义必须区分）；
- 子女；
- 寄养 / 代养 / foster mother 等非谱系照护关系。

### 模板规则

- 核心谱系关系和社会关系不能混在一个 `relationship` 列表中；
- 有对应熊猫页时必须可继续点击；
- 可以反向推导 parent → child，但必须来自已有 direct 关系；
- tentative / disputed 关系以后需要保留不同视觉语义，不能显示成 confirmed。

### 扩展内容

如果该熊猫繁殖资料丰富，Family 后面可以自然进入 Reproduction，而不是全部塞进生命时间线。

---

## 5. Reproduction & Parenting / 繁殖与育幼 —— 条件模块

### 用户要回答的问题

“它有怎样的繁殖和育幼经历？”

### 数据来源

- `reproduction`
- `maternal_care`
- `hand_rearing`
- 与生产相关的 `birth`
- foster / nursery 关系

### 展示内容

- 交配 / 人工授精等重要繁殖事件；
- 妊娠与生产；
- 每胎幼崽及出生信息；
- 双胞胎 / 三胞胎等信息；
- 母兽育幼行为；
- 轮换育幼、人工育幼、寄养等；
- 特殊育幼纪录和里程碑。

### 模板适用

这一模块对于繁育母兽、重要种公、历史繁殖项目个体价值很高；没有繁殖数据的熊猫完全不出现该模块。

---

## 6. Life Journey / 一生的轨迹 —— 条件模块，主时间轴

### 用户要回答的问题

“它这一生发生过什么？”

### 适合进入时间轴的事件

- 出生；
- 救护；
- 转移 / 抵达 / 回国；
- 公开亮相；
- 重要成长节点；
- 重大繁殖节点；
- 重大健康 / 医疗事件；
- 放归；
- 重要科研 / 保护节点；
- 死亡。

### 不应该塞入时间轴的内容

- 所有性格描述；
- 普通饮食偏好；
- 每一次普通训练；
- 没有时间意义的文化背景；
- 重复的事实型描述。

### 规则

- 保留日期精度：年 / 月 / 日分别展示；
- 同一年大量事件可按阶段聚合；
- 时间轴是“生命周期骨架”，不是全部研究记录的 dump。

---

## 7. Places / 它生活过的地方 —— 条件模块

### 用户要回答的问题

“它去过哪里？现在在哪里？”

### 数据来源

- `origin`
- `location`
- `transfer`
- `residency_history`
- rescue / release location

### 展示内容

- 出生地；
- 历次机构 / 城市；
- 抵达和离开时间；
- 当前、历史、last-known / stale 状态；
- 迁移动因（有来源时）。

### 野外地点规则

- 不公开敏感精确坐标；
- 展示到保护区 / 山系 / 合适粗粒度；
- 放归和监测可叙述方法，但不得暴露不适宜公开的实时位置。

---

## 8. Wild Story / 野外、救护与放归 —— 条件模块，特殊个体优先

### 用户要回答的问题

“如果它来自野外，它经历了什么？”

### 数据来源

- `rescue`
- `release`
- `conservation`
- `research`
- origin type = wild

### 展示内容

- 被发现 / 救护的时间和大致地点；
- 当时状态；
- 救护原因；
- 治疗和恢复；
- 人工照护持续时间；
- 放归时间、区域、类型；
- GPS / 无线电项圈 / 相机等监测方法；
- 已确认的放归结果。

### 重要性

野生救护个体不应该套用“动物园熊猫”的默认叙事。这个模块可以在此类熊猫页面中提升到 Family 之前。

---

## 9. Growth & Care / 成长与照护 —— 条件模块

### 数据来源

- `growth_measurement`
- `husbandry_training`
- `health`
- `veterinary_care`

### 内容分组

#### 成长

- 出生体重；
- 关键年龄的体重、体型；
- 成长节点。

#### 日常护理与训练

- target training；
- 躺下、张嘴、伸爪等护理行为；
- 医疗脱敏；
- 自愿采血、注射等。

#### 健康

- 重大疾病；
- 手术 / 治疗；
- 检疫；
- 重要健康评估。

### 展示边界

不是医疗病历页。只展示能帮助理解个体生命史的重要健康/照护记录。

---

## 10. Significance / 为什么它值得被记住 —— 条件模块

### 用户要回答的问题

“除了它自己，它在更大的熊猫历史里意味着什么？”

### 数据来源

- `milestone`
- `research`
- `conservation`
- `diplomacy`
- `cultural_context`
- `anecdote`（必须达到展示资格）

### 可包含

- 世界 / 机构 / 地区的历史纪录；
- 熊猫外交经历；
- 科研贡献；
- 保护项目意义；
- 重要公众事件；
- 奥运、纪念、展览、文化符号等；
- 有史料依据的高价值轶事。

### 注意

这个模块必须是“意义”，不能变成新闻剪贴簿。

---

## 11. Media Story / 影像档案 —— 条件模块

### 内容

- Hero 主肖像；
- 识别照；
- 幼年 / 成年 / 不同阶段历史照片；
- 家族 / 育幼 / 迁居 / 野外 / 公开活动等与生命事件关联的图像；
- 每张图 credit、rights、source。

### 模板规则

影像应与内容模块关联，不只是页尾统一图库。

优先策略：

1. 主肖像；
2. 与人物识别有关；
3. 与重要生命事件有关；
4. 再进入完整影像档案。

---

## 12. Sources & Trust / 来源与可信度 —— 必须可达

### 页面默认层

普通用户只需要看到：

- 主要来源机构；
- 关键参考资料；
- 最近更新 / 整理时间（如果产品层决定展示）。

### 深层 disclosure

每条重要事实应能追溯到 source id / URL；但不要让证据系统抢占主要阅读路径。

### 不展示给普通用户的研究工作流字段

- `review_status`
- `publication_status`
- 内部 conflict queue
- acquisition task / batch / round 等内部术语

除非未来有明确的“研究模式”。

---

# 二、推荐页面模板顺序

详情页不是所有熊猫都严格显示 12 个模块，而是一个稳定的 slot system。

## 固定骨架

1. **Hero / Identity**
2. **Quick Identity Facts**
3. **记忆点 / Recognition 或 Personality**
4. **Family**（如果存在）
5. **Life Journey**（如果存在）
6. **主要主题模块**
7. **Places**
8. **Media Story**
9. **Significance**
10. **Sources**
11. **继续探索其他熊猫**

## “主要主题模块”按个体自动选择

- 繁育母兽 / 种公 → Reproduction & Parenting；
- 野生救护 / 放归个体 → Wild Story；
- 幼崽 / 年轻熊猫 → Growth & Daily Life；
- 健康史特别重要 → Growth & Care；
- 外交 / 历史名熊猫 → Significance 提前；
- 普通动物园个体 → Personality & Daily Life。

这意味着我们只有**一个详情模板**，但模板具备个体主题排序，不需要为每种熊猫维护完全不同页面。

---

# 三、模块出现条件

建议不要通过“有一条 record 就显示一个 section”来控制，而是设置内容阈值。

| 模块 | 建议出现条件 |
|---|---|
| Identity | 永远 |
| Recognition | ≥1 个可靠外观/识别事实，或 ≥2 张能辅助识别的图片 |
| Personality & Daily Life | ≥2 条 personality/preference/behaviour/diet/enrichment，或 1 条非常强的机构描述 |
| Family | ≥1 个 confirmed 父母/子女/兄弟姐妹关系 |
| Reproduction & Parenting | ≥1 次确认繁殖/生产/育幼事件 |
| Life Journey | ≥2 个有时间信息的高价值事件 |
| Places | ≥2 个生活地点，或 1 次重要跨地区迁移 |
| Wild Story | 有 rescue/release，或明确 wild-origin 且有野外经历 |
| Growth & Care | ≥2 个成长/训练/重要健康事实，或 1 个重大健康事件 |
| Significance | ≥1 个真正具有历史/科研/保护/文化意义的强事实 |
| Media Story | 除 Hero 外 ≥2 张确认个体影像 |
| Sources | 有任何被展示事实的来源 |

阈值可以后续根据全量统计调节。

---

# 四、Profile Projection V2

当前前端 projection：

```ts
ResearchDetailPanda {
  core
  relations
  moments
  highlights
  media
  sources
}
```

不足点是 `highlights` 丢失了大量领域语义。建议下一版改成：

```ts
PandaProfileProjectionV2 {
  identity: {
    names
    aliases
    nameMeaning
    sex
    birth
    birthplace
    originType
    studbookNumber
    lifeStatus
    death
    currentResidence
  }

  recognition: {
    appearance[]
    distinguishingFeatures[]
  }

  personality: {
    traits[]
    preferences[]
    diet[]
    behaviours[]
    enrichment[]
  }

  family: {
    parents[]
    siblings[]
    companions[]
    breedingPartners[]
    children[]
    careRelations[]
  }

  reproduction: {
    breedingEvents[]
    pregnancies[]
    births[]
    maternalCare[]
    handRearing[]
  }

  journey: {
    events[]
    residencies[]
    transfers[]
  }

  wildStory: {
    rescues[]
    releases[]
    monitoring[]
  }

  growthAndCare: {
    measurements[]
    training[]
    health[]
    veterinary[]
  }

  significance: {
    milestones[]
    research[]
    conservation[]
    diplomacy[]
    culturalContext[]
    anecdotes[]
  }

  media[]
  sources[]
}
```

关键原则：**projection 负责分类和安全筛选，页面负责排版，不让 React 页面重新解释原始 predicate。**

---

# 五、事件模型需要再升级

`moments[]` 目前只有：date / category / predicate / summary。

建议 V2 event 至少增加：

```ts
ProfileEvent {
  id
  kind
  date
  datePrecision
  endDate?
  title
  summary?
  place?
  relatedPandas[]
  media[]
  sourceIds[]
  significance: "major" | "normal"
}
```

这样前端才能：

- 把同一天的生产、幼崽和母亲关联起来；
- 把迁居事件和地点关联；
- 给重要事件配正确照片；
- 对普通记录和真正关键节点做视觉区分。

---

# 六、家族模型需要区分“谱系”和“社会关系”

目前统一 `relation.kind` 不够。

建议：

```ts
ProfileRelation {
  relationType:
    | "mother"
    | "father"
    | "child"
    | "sibling"
    | "twin"
    | "breeding_partner"
    | "companion"
    | "foster_mother"
    | "foster_child"
  certainty
  targetPanda
  sourceIds[]
}
```

页面默认家族树只放 biological lineage；companion / foster / breeding partner 用独立关系语义。

---

# 七、5 类典型页面状态

模板必须同时覆盖以下真实数据状态：

## A. 数据丰富的明星 / 长寿个体

大量照片、家族、迁居、性格、历史事件。

页面可以很长，但必须通过模块组织，而不是纯时间线。

## B. 繁育核心个体

Family + Reproduction + Parenting 是页面中心。

## C. 野生救护 / 放归个体

Wild Story + Places + Conservation 是页面中心，Family 可能很弱甚至没有。

## D. 年轻个体 / 幼崽

Recognition + Personality + Growth + Family 是页面中心，历史意义和长时间线很少。

## E. 稀疏历史档案

只有姓名、年份、地点、少数关系甚至无照片。

只显示：Identity + 已知关系/事件 + Sources。不要生成大面积空模块。

---

# 八、用户最终应该得到的回答

一张好的熊猫详情页，浏览结束后应该让普通熊猫爱好者能够回答：

1. 它是谁、怎么认出它？
2. 它是什么性格，喜欢什么？
3. 它的父母、兄弟姐妹和孩子是谁？
4. 它一生最重要的事情有哪些？
5. 它在哪里出生、生活、迁居或被放归？
6. 如果它繁育过，它的繁殖和育幼经历是什么？
7. 如果它来自野外，它的救护/放归故事是什么？
8. 它为什么在熊猫历史、科研、保护或大众文化里值得被记住？
9. 我还能看哪些属于它本人的照片？
10. 这些信息从哪里来？

如果页面不能回答这些问题，它就还只是“熊猫资料卡”，不是完整的熊猫个体档案。

---

# 九、详情页文案系统

详情页展示文案必须继承 ZhiPanda 现有 public copy 的语气：**清楚、具体、亲近、克制**。它不是论文摘要，不是动物园宣传稿，也不是 AI 帮你“润色”后的故事文。

现有网站中“今天认识哪只熊猫？”、“从家庭和地点认识更多熊猫”、“一只熊猫的资料，会自然连接到它的家人和生活过的地方。”这类句子可以作为基准：用普通人会说的话，把事实讲清楚，不刻意显得专业，也不刻意显得可爱。

## 9.1 统一语气

### 应该像

- 熊猫爱好者写给熊猫爱好者；
- 熟悉资料的编辑在介绍一个具体个体；
- 句子短，主语明确，信息落在具体的人、时间、地点和行为上；
- 有温度，但温度来自事实本身；
- 对未知和争议保持克制。

### 不应该像

- 百科词条拼接；
- 新闻通稿；
- 科研项目报告；
- 营销文案；
- 生成式 AI 的“总结型散文”。

## 9.2 基础句法

优先使用：

> 熊猫名 + 具体动作 / 特征 + 时间 / 地点 / 对象。

例如：

- “思缘两只前掌各有一撮白毛，因此被叫作‘白手套妹妹’。”
- “安安偏爱苹果和胡萝卜。”
- “可可喜欢自己的空间，也会主动到门边让护理员挠背。”
- “2024年9月26日，安安从都江堰抵达香港海洋公园。”
- “经过训练后，安安可以自愿配合采血和注射。”

尽量避免先写抽象判断，再补事实。

不推荐：

> “安安在适应新环境方面展现出了良好的状态。”

推荐：

> “到港一年后，护理团队记录安安已经适应新环境。”

## 9.3 AI 感高风险表达 —— 默认禁用

除非原始来源本身就是引语，否则页面生成文案避免以下结构：

- “值得一提的是……”
- “令人印象深刻的是……”
- “有趣的是……”
- “在……方面……”
- “不仅……而且……” / “不仅……更……”
- “从……到……”作为无信息量修辞开头
- “它的一生充满了……”
- “这也体现了……”
- “展现出……的一面”
- “成为了……的重要见证”
- “为……贡献了自己的力量”
- “承载着……”
- “书写了……”
- “留下了浓墨重彩的一笔”
- “让我们一起……”
- “带你了解……”
- “揭秘……”
- “治愈”“萌化”等泛娱乐化形容
- “传奇”“伟大”“珍贵”“特别”等没有事实支撑的价值判断

同时避免连续三句同样长度、同样结构的总结句，这也是明显的生成文案痕迹。

## 9.4 事实优先，不替来源加戏

原始记录：

> 海洋公园将安安描述为精力充沛、敏捷、富有冒险精神，并喜欢护理员陪伴。

页面可以写：

> “海洋公园的护理团队形容安安精力充沛、动作敏捷，也喜欢有人陪着。”

不要写：

> “安安是一位天生的冒险家，对世界充满好奇，也与护理员建立了深厚而温暖的情感纽带。”

后一句增加了来源没有表达的心理和情感判断。

## 9.5 保留“谁这样说”

性格、喜好、行为观察具有观察者语境时，不要自动写成永恒人格。

优先：

- “护理员记录它偏爱苹果和胡萝卜。”
- “海洋公园曾形容可可较为独立。”
- “在2025年的观察中，可可常在夜间保持活跃。”

谨慎使用：

- “它最喜欢苹果。”
- “它性格独立。”
- “它是一只夜猫子。”

只有来源能够支持稳定、明确的表述时，才可省略观察语境。

## 9.6 日期和精度写法

研究库只有年份时：

> “1984年，……”

只有月份时：

> “1984年2月，……”

有完整日期时：

> “2012年8月22日，……”

不得为了句子好看把 `1984` 写成“1984年初”，也不得把 `1995-04` 写成“1995年4月某日”。

## 9.7 不确定、争议与未确认

页面文案要自然表达不确定性，而不是暴露内部研究术语。

研究层：`tentative`

页面：

> “现有资料暂将它记录为……”

研究层：`disputed`

页面：

> “关于这一关系，现有资料存在不同记录。”

研究层：日期只到年份

页面：

> 直接展示年份，不额外解释“日期不详”。

不要展示：

- “confidence: medium”
- “needs_primary_source”
- “publication_status”
- “review_status”
- “P0 / P1”
- round / batch / acquisition 等研究工作流词汇。

## 9.8 模块标题风格

标题优先使用普通用户的问题或自然名词，不使用系统术语。

推荐：

- “认识思缘” / 直接使用名字，不一定每页都需要标题；
- “怎么认出它”
- “性格与日常”
- “家人”或“家族”
- “繁育与育幼”
- “一生的轨迹”
- “生活过的地方”
- “从野外到这里” / “救护与放归”（按个体语境）
- “成长与照护”
- “为什么被记住”
- “更多照片”
- “资料来源”

避免：

- “个体画像”
- “核心事实”
- “关系网络”
- “生命周期事件”
- “空间足迹”
- “行为标签”
- “内容洞察”
- “研究高光”
- “证据链”

这些词适合内部模型，不适合熊猫爱好者页面。

## 9.9 各内容域的文案形态

### Identity

以值为主，不写说明型废话。

推荐：

> 2004年8月24日 · 雌性 · 成都 · 谱系号 593

不推荐：

> “思缘是一只出生于2004年的雌性大熊猫，目前拥有国际谱系编号593。”

### Recognition

每条只讲一个可观察特征。

> “两只前掌各有一撮白毛。”

不要把几个外貌事实合成一段“外形描写”。

### Personality & Daily Life

写成“观察片段”，不做心理分析。

> “护理员记录安安偏爱苹果和胡萝卜。”

> “可可喜欢独处，也会主动到门边让护理员挠背。”

### Family

关系本身就是文案，不额外解释显而易见的家庭概念。

> 母亲 奇缘
>
> 父亲 师师
>
> 子女 思一

只有特殊关系才补一句说明。

### Reproduction & Parenting

强调时间、幼崽、照护方式和结果。

> “2015年，思缘产下双胞胎思念和思筠筠。”

而不是：

> “思缘在繁育方面取得了令人瞩目的成果。”

### Life Journey

标题写“发生了什么”，正文只在需要时补背景。

> **2012**
>
> 首次自然交配

而不是每个事件都写成完整新闻摘要。

### Places

优先：地点 + 时间。

> 成都大熊猫繁育研究基地
>
> 2004—

迁移动因有价值时才补充一句。

### Wild Story

使用纪实语气，尤其避免“重获新生”“回归大自然怀抱”等套话。

推荐：

> “2005年7月16日，这只野生大熊猫进入都江堰城区并爬上树。救护后被送往卧龙检查和治疗。”

> “23天后，它被放归龙溪—虹口保护区，并通过无线电项圈和地面追踪继续监测。”

### Growth & Care

只写能帮助理解个体的记录。

> “抵港时，安安体重超过130公斤。”

> “经过医疗脱敏训练后，它可以配合采血和注射。”

避免把护理过程写成专业操作手册。

### Significance

先写具体纪录，再让意义自然成立。

推荐：

> “1958年，Chi Chi在东柏林停留三周，约40万人前往观看。”

不推荐：

> “Chi Chi在东西方文化交流史上留下了不可磨灭的印记。”

### Sources

来源标题保持原始名称；产品层只负责清晰标记机构与链接，不改写来源标题制造戏剧性。

## 9.10 一条事实的三种长度

projection 最好同时支持三种输出尺度，而不是让组件现场截断文本。

```ts
ProfileCopy {
  label?: string       // 极短：列表、事实带
  short?: string       // 1 句：卡片、时间线
  narrative?: string   // 1–3 句：需要上下文的正文
}
```

例如同一记录：

- `label`: `偏爱苹果和胡萝卜`
- `short`: `护理员记录安安偏爱苹果和胡萝卜。`
- `narrative`: `抵港后的护理记录提到，安安偏爱苹果和胡萝卜。它们也被用于日常训练和奖励。` —— 第二句只有来源明确支持时才生成。

这样模板可以统一文风，也避免不同组件各自做“AI 总结”。

## 9.11 文案生成职责

**原始研究记录不直接上页面。**

推荐链路：

```text
research record
→ evidence / conflict filtering
→ semantic domain mapping
→ copy normalisation
→ PandaProfileProjectionV2
→ UI
```

`copy normalisation` 必须是可测试、可重复的规则层，而不是请求时临时调用自由生成模型来“润色”。

如果未来使用模型辅助生成自然语言，它只能：

1. 在已有事实边界内改写；
2. 不新增人物心理、因果、评价和精度；
3. 产物经过禁用表达和事实字段回查；
4. 对高价值个体允许人工编辑覆盖自动文案。

## 9.12 文案质量门禁

建议在现有 `check-public-panda-fan-copy.mjs` 基础上增加详情页规则：

- banned AI phrases；
- banned internal research vocabulary；
- banned generic praise / marketing words；
- 关键模块标题白名单或语义检查；
- 无来源的“最”“第一”“唯一”“传奇”等强断言检查；
- 中英文分别维护自然表达，不逐句机器直译。

最终标准不是“读起来优美”，而是：**像 ZhiPanda 自己写的，像一个真正了解这只熊猫的人在把事实讲给你听。**

这套规则后续还要落成机器可执行的 domain map 与 copy policy，供 projection、覆盖审计和 public copy gate 共同使用。

---

# 十、下一步实施顺序

1. 先升级 research detail projection 到 V2，不改 UI。
2. 建 category/predicate → content domain 的正式映射表。
3. 同时建立 copy normalisation 规则与 banned AI phrase 门禁。
4. 对 960 个 catalog 个体跑覆盖统计，输出每个模块的可用数量。
5. 用 5 类代表个体验证模板：数据丰富、繁育、野外救护、年轻个体、稀疏档案。
6. 对代表个体逐条检查“事实是否准确 + 文案是否像 ZhiPanda”。
7. 确认模块阈值、排序规则和三档 copy 长度。
8. 最后才重新设计详情页面视觉。

这次应当避免先画页面再把数据塞进去；先把“熊猫个体内容模型”和“ZhiPanda 文案系统”一起稳定下来，视觉才会有长期基础。
