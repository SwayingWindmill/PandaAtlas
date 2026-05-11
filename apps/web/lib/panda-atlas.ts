import type { DistributionLayer } from "@/lib/types";

export type AtlasMode = "global" | "china_wild" | "china_captive" | "overseas_captive";
export type AtlasRegion = "china" | "overseas";
export type AtlasStatus = "wild" | "captive";
export type AtlasItemKind = "wild_region" | "breeding_base" | "zoo" | "research_center" | "reserve";
export type AtlasRegionFilter = "all" | AtlasRegion;
export type AtlasStatusFilter = "all" | AtlasStatus;
export type AtlasInstitutionTypeFilter = "all" | Exclude<AtlasItemKind, "wild_region">;

export interface AtlasLegendItem {
  label: string;
  color: string;
  description: string;
}

export interface AtlasModeMeta {
  value: AtlasMode;
  label: string;
  shortLabel: string;
  kicker: string;
  title: string;
  description: string;
  distributionLayer: DistributionLayer | null;
  showHabitats: boolean;
  showDomesticInstitutions: boolean;
  showOverseasInstitutions: boolean;
  bounds: [[number, number], [number, number]];
  legend: AtlasLegendItem[];
  emptyHint: string;
}

export interface AtlasItem {
  id: string;
  name: string;
  kind: AtlasItemKind;
  kindLabel: string;
  region: AtlasRegion;
  status: AtlasStatus;
  country: string;
  city: string;
  province?: string;
  coordinates: [number, number];
  description: string;
  updatedAt: string;
  badge: string;
  detailHref: string;
  mode: AtlasMode;
  featured?: boolean;
  tags: string[];
  note?: string;
}

export interface AtlasChangeEntry {
  id: string;
  title: string;
  summary: string;
  date: string;
  kind: "sync" | "travel" | "agreement";
  mode: AtlasMode | "all";
  focusItemId?: string;
}

export interface AtlasExtensionCard {
  kicker: string;
  title: string;
  body: string;
  href: string;
}

export const ATLAS_SEARCH_PLACEHOLDER = "搜索国家、城市、机构、熊猫名称或区域";

export const ATLAS_DATA_STATUS =
  "自然分布以中国山地森林系统为核心，圈养与合作网络按机构驻留与协作关系组织，可随快照持续更新。";

export const ATLAS_DATA_SOURCE =
  "综合公开保育名录、国内基地信息与图谱演示数据构建；地图快照日期以接口返回为准。";

export const ATLAS_MODES: AtlasModeMeta[] = [
  {
    value: "global",
    label: "全球总览",
    shortLabel: "野生 + 国内 + 海外",
    kicker: "GLOBAL OVERVIEW",
    title: "在一张固定地图上同时阅读中国野生核心、国内保育网络与海外合作节点",
    description:
      "中国是自然分布核心，国内圈养机构与海外合作节点以点状网络延展。点击地图对象后，右侧抽屉负责对象阅读，底部摘要负责变化速览。",
    distributionLayer: "wild",
    showHabitats: true,
    showDomesticInstitutions: true,
    showOverseasInstitutions: true,
    bounds: [
      [-165, -48],
      [165, 72]
    ],
    legend: [
      { label: "中国野生分布", color: "#3F7D47", description: "自然分布核心" },
      { label: "中国圈养机构", color: "#C98A45", description: "国内保育网络" },
      { label: "海外合作机构", color: "#4E86D8", description: "国际合作节点" }
    ],
    emptyHint: "当前筛选没有命中任何地图对象。可以清空搜索词或切换模式后继续浏览整张图谱。"
  },
  {
    value: "china_wild",
    label: "中国野生",
    shortLabel: "野生分布",
    kicker: "CHINA WILD",
    title: "把熊猫作为自然物种放回中国山地森林系统，阅读其野生分布结构",
    description:
      "这一模式强调面状分布区、山系与保护地之间的关系，弱化机构点位，只保留野生分布语义与时间快照入口。",
    distributionLayer: "wild",
    showHabitats: true,
    showDomesticInstitutions: false,
    showOverseasInstitutions: false,
    bounds: [
      [73, 18],
      [136, 54]
    ],
    legend: [
      { label: "核心分布区", color: "#2F6B3B", description: "野生分布核心" },
      { label: "保护地网络", color: "#90A88F", description: "保护地与山系背景" },
      { label: "当前高亮区域", color: "#D0A25F", description: "点击后查看详情" }
    ],
    emptyHint: "中国野生模式只显示野生分布区与保护地语义，当前筛选没有可展示的对象。"
  },
  {
    value: "china_captive",
    label: "中国圈养",
    shortLabel: "国内机构",
    kicker: "CHINA CAPTIVE",
    title: "从繁育基地、动物园与研究机构阅读国内圈养与保育网络",
    description:
      "这一模式以点状机构网络为主，保留轻量空间背景，帮助用户从城市与机构维度理解国内保育体系的组织方式。",
    distributionLayer: "captive",
    showHabitats: false,
    showDomesticInstitutions: true,
    showOverseasInstitutions: false,
    bounds: [
      [73, 18],
      [136, 54]
    ],
    legend: [
      { label: "繁育基地", color: "#C8803F", description: "繁育、救护与转运节点" },
      { label: "动物园", color: "#D79C5B", description: "展示与公众教育机构" },
      { label: "研究机构", color: "#A9692A", description: "科研与长期监测节点" }
    ],
    emptyHint: "当前筛选没有命中国内圈养机构，可调整机构类型或恢复为全部区域。"
  },
  {
    value: "overseas_captive",
    label: "海外圈养",
    shortLabel: "海外合作",
    kicker: "OVERSEAS NETWORK",
    title: "按国家与城市尺度阅读海外合作机构中的驻留、展示与研究网络",
    description:
      "这一模式不再强调自然分布，而是把国际合作机构作为全球网络节点来阅读，并通过时间快照追踪驻留与合作关系的变化。",
    distributionLayer: null,
    showHabitats: false,
    showDomesticInstitutions: false,
    showOverseasInstitutions: true,
    bounds: [
      [-165, -48],
      [165, 72]
    ],
    legend: [
      { label: "合作机构", color: "#4E86D8", description: "当前收录的海外节点" },
      { label: "长期合作节点", color: "#2F6B3B", description: "重点合作或研究窗口" },
      { label: "当前高亮对象", color: "#D0A25F", description: "已选中的机构节点" }
    ],
    emptyHint: "当前筛选没有命中海外合作机构，可切换国家范围或清空搜索后继续浏览。"
  }
];

export const ATLAS_INSTITUTIONS: AtlasItem[] = [
  {
    id: "inst-chengdu-base",
    name: "成都大熊猫繁育研究基地",
    kind: "breeding_base",
    kindLabel: "繁育基地",
    region: "china",
    status: "captive",
    country: "中国",
    city: "成都",
    province: "四川",
    coordinates: [104.148, 30.739],
    description: "国内最重要的繁育与展示节点之一，承担繁育、研究、公众教育与国际传播等复合职能。",
    updatedAt: "2026-03-05",
    badge: "国内圈养网络",
    detailHref: "/atlas",
    mode: "china_captive",
    featured: true,
    tags: ["繁育", "研究", "公众教育"],
    note: "西南圈养网络的核心枢纽"
  },
  {
    id: "inst-shenshuping",
    name: "卧龙神树坪基地",
    kind: "breeding_base",
    kindLabel: "繁育基地",
    region: "china",
    status: "captive",
    country: "中国",
    city: "卧龙",
    province: "四川",
    coordinates: [103.126, 31.045],
    description: "承担繁育扩群、野化适应与保育展示任务，是圈养体系与野外保护地联系最紧密的基地之一。",
    updatedAt: "2026-03-05",
    badge: "国内圈养网络",
    detailHref: "/atlas",
    mode: "china_captive",
    featured: true,
    tags: ["野化", "繁育", "转运"],
    note: "兼具圈养与野化过渡语义"
  },
  {
    id: "inst-bifengxia",
    name: "雅安碧峰峡基地",
    kind: "breeding_base",
    kindLabel: "繁育基地",
    region: "china",
    status: "captive",
    country: "中国",
    city: "雅安",
    province: "四川",
    coordinates: [102.978, 30.042],
    description: "承担圈养种群管理、幼年个体监测与公众展示，是四川西线的重要保育节点。",
    updatedAt: "2026-03-05",
    badge: "国内圈养网络",
    detailHref: "/atlas",
    mode: "china_captive",
    tags: ["幼年个体", "监测", "展示"],
    note: "与成都、卧龙共同构成西南基地带"
  },
  {
    id: "inst-dujiangyan",
    name: "都江堰中华大熊猫苑",
    kind: "breeding_base",
    kindLabel: "繁育基地",
    region: "china",
    status: "captive",
    country: "中国",
    city: "都江堰",
    province: "四川",
    coordinates: [103.627, 31.019],
    description: "承担救护、康复与科普传播任务，是公众进入熊猫保育体系的高频认知入口。",
    updatedAt: "2026-02-26",
    badge: "国内圈养网络",
    detailHref: "/atlas",
    mode: "china_captive",
    tags: ["救护", "康复", "科普"],
    note: "公共教育与救护功能并重"
  },
  {
    id: "inst-beijing-zoo",
    name: "北京动物园",
    kind: "zoo",
    kindLabel: "动物园",
    region: "china",
    status: "captive",
    country: "中国",
    city: "北京",
    province: "北京",
    coordinates: [116.333, 39.938],
    description: "作为首都展示节点，这里承担公众教育、城市传播与圈养个体展示功能。",
    updatedAt: "2026-02-18",
    badge: "城市展示节点",
    detailHref: "/atlas",
    mode: "china_captive",
    tags: ["展示", "公众教育", "城市节点"],
    note: "北方城市窗口"
  },
  {
    id: "inst-qinling-park",
    name: "秦岭四宝科学公园",
    kind: "research_center",
    kindLabel: "研究机构",
    region: "china",
    status: "captive",
    country: "中国",
    city: "西安",
    province: "陕西",
    coordinates: [108.944, 34.343],
    description: "以区域生态研究、科普传播与珍稀物种展示为主，强化秦岭区域的生态叙事。",
    updatedAt: "2026-02-12",
    badge: "研究合作节点",
    detailHref: "/atlas",
    mode: "china_captive",
    tags: ["秦岭", "研究", "区域保育"],
    note: "西北研究节点"
  },
  {
    id: "inst-chongqing-zoo",
    name: "重庆动物园",
    kind: "zoo",
    kindLabel: "动物园",
    region: "china",
    status: "captive",
    country: "中国",
    city: "重庆",
    province: "重庆",
    coordinates: [106.505, 29.502],
    description: "承担城市展示与公众教育任务，在西南城市带中构成高可见度的熊猫展示窗口。",
    updatedAt: "2026-01-25",
    badge: "城市展示节点",
    detailHref: "/atlas",
    mode: "china_captive",
    tags: ["展示", "西南城市", "公众教育"],
    note: "国内城市传播节点"
  },
  {
    id: "inst-smithsonian",
    name: "Smithsonian National Zoo",
    kind: "zoo",
    kindLabel: "合作动物园",
    region: "overseas",
    status: "captive",
    country: "美国",
    city: "华盛顿",
    coordinates: [-77.049, 38.929],
    description: "作为长期合作展示窗口，适合在图谱中阅读北美公众传播与国际研究交流的关系。",
    updatedAt: "2026-02-20",
    badge: "海外合作网络",
    detailHref: "/atlas",
    mode: "overseas_captive",
    featured: true,
    tags: ["北美", "长期合作", "研究交流"],
    note: "北美合作窗口"
  },
  {
    id: "inst-madrid",
    name: "Zoo Aquarium de Madrid",
    kind: "zoo",
    kindLabel: "合作动物园",
    region: "overseas",
    status: "captive",
    country: "西班牙",
    city: "马德里",
    coordinates: [-3.761, 40.409],
    description: "在欧洲合作网络中承担跨文化传播与展示窗口作用，适合从国家与城市层面阅读国际合作版图。",
    updatedAt: "2026-02-14",
    badge: "海外合作网络",
    detailHref: "/atlas",
    mode: "overseas_captive",
    tags: ["欧洲", "展示传播", "长期合作"],
    note: "欧洲合作节点"
  },
  {
    id: "inst-ueno",
    name: "Ueno Zoo",
    kind: "zoo",
    kindLabel: "合作动物园",
    region: "overseas",
    status: "captive",
    country: "日本",
    city: "东京",
    coordinates: [139.771, 35.716],
    description: "亚洲合作网络中的高关注城市节点，兼具城市传播与国际交流窗口属性。",
    updatedAt: "2026-03-01",
    badge: "海外合作网络",
    detailHref: "/atlas",
    mode: "overseas_captive",
    featured: true,
    tags: ["亚洲", "城市节点", "公众传播"],
    note: "亚洲高关注合作点"
  },
  {
    id: "inst-pairi-daiza",
    name: "Pairi Daiza",
    kind: "zoo",
    kindLabel: "合作动物园",
    region: "overseas",
    status: "captive",
    country: "比利时",
    city: "Brugelette",
    coordinates: [3.885, 50.587],
    description: "以沉浸式展示与跨国传播见长，是欧洲北线的重要合作机构。",
    updatedAt: "2026-01-28",
    badge: "海外合作网络",
    detailHref: "/atlas",
    mode: "overseas_captive",
    tags: ["欧洲", "沉浸式展示", "驻留"],
    note: "欧洲北线合作节点"
  },
  {
    id: "inst-vienna",
    name: "Schonbrunn Zoo",
    kind: "research_center",
    kindLabel: "研究合作机构",
    region: "overseas",
    status: "captive",
    country: "奥地利",
    city: "维也纳",
    coordinates: [16.303, 48.184],
    description: "承担合作研究、公众传播与驻留管理功能，连接中欧研究与展示网络。",
    updatedAt: "2026-01-18",
    badge: "海外研究合作",
    detailHref: "/atlas",
    mode: "overseas_captive",
    tags: ["中欧", "研究", "驻留"],
    note: "中欧研究节点"
  },
  {
    id: "inst-adelaide",
    name: "Adelaide Zoo",
    kind: "zoo",
    kindLabel: "合作动物园",
    region: "overseas",
    status: "captive",
    country: "澳大利亚",
    city: "阿德莱德",
    coordinates: [138.608, -34.915],
    description: "在南半球合作网络中承担展示与传播窗口作用，适合在全球视图中表达跨半球驻留关系。",
    updatedAt: "2026-01-11",
    badge: "海外合作网络",
    detailHref: "/atlas",
    mode: "overseas_captive",
    tags: ["南半球", "展示", "长期合作"],
    note: "跨半球合作节点"
  }
];

export const ATLAS_CHANGES: AtlasChangeEntry[] = [
  {
    id: "change-wild-snapshot-20260305",
    title: "中国野生分布快照同步到 2026/03/05",
    summary: "山系分布网格与保护地背景完成刷新，可用于当前版本的野生分布阅读。",
    date: "2026-03-05",
    kind: "sync",
    mode: "china_wild"
  },
  {
    id: "change-chengdu-roster-20260303",
    title: "国内圈养机构名录完成季度复核",
    summary: "繁育基地、动物园与研究机构标签已同步更新，便于在国内圈养模式下快速筛选。",
    date: "2026-03-03",
    kind: "agreement",
    mode: "china_captive",
    focusItemId: "inst-chengdu-base"
  },
  {
    id: "change-ueno-20260301",
    title: "东京合作节点补录最新驻留说明",
    summary: "海外合作网络新增机构说明，可从城市维度继续阅读亚洲合作关系。",
    date: "2026-03-01",
    kind: "travel",
    mode: "overseas_captive",
    focusItemId: "inst-ueno"
  },
  {
    id: "change-global-notes-20260224",
    title: "全球总览的图例与数据说明完成统一整理",
    summary: "全球总览现在可在同一屏内组织野生分布、国内机构与海外合作网络。",
    date: "2026-02-24",
    kind: "sync",
    mode: "all"
  },
  {
    id: "change-smithsonian-20260220",
    title: "北美合作窗口更新年度说明",
    summary: "北美合作节点的驻留与研究说明完成新一轮同步，便于在全球网络中阅读状态变化。",
    date: "2026-02-20",
    kind: "travel",
    mode: "overseas_captive",
    focusItemId: "inst-smithsonian"
  }
];

export const ATLAS_TIMELINE_CHANGES: AtlasChangeEntry[] = [
  {
    id: "timeline-global-atlas-20260305",
    title: "全球图谱的图例、快照与模式说明完成统一整理",
    summary: "全球总览现在能在固定地图舞台上同时表达中国野生核心、国内圈养机构与海外合作网络。",
    date: "2026-03-05",
    kind: "sync",
    mode: "all"
  },
  {
    id: "timeline-wild-20260305",
    title: "中国野生分布快照同步到 2026 年 3 月版本",
    summary: "山系分布网格与保护地背景同步刷新，适合直接回看最新的中国野生模式。",
    date: "2026-03-05",
    kind: "sync",
    mode: "china_wild"
  },
  {
    id: "timeline-chengdu-20260303",
    title: "成都基地完成季度名录复核",
    summary: "国内圈养模式同步更新繁育基地、动物园与研究机构的标签与说明，便于按机构类型切换阅读。",
    date: "2026-03-03",
    kind: "agreement",
    mode: "china_captive",
    focusItemId: "inst-chengdu-base"
  },
  {
    id: "timeline-ueno-20260301",
    title: "东京合作节点补录最新驻留说明",
    summary: "海外合作模式增加了亚洲重点机构的驻留说明，用于从城市维度理解国际合作结构。",
    date: "2026-03-01",
    kind: "travel",
    mode: "overseas_captive",
    focusItemId: "inst-ueno"
  },
  {
    id: "timeline-smithsonian-20260220",
    title: "华盛顿合作窗口完成年度状态复核",
    summary: "海外合作网络补录了北美重点机构的年度说明，便于从全球网络角度查看合作状态。",
    date: "2026-02-20",
    kind: "travel",
    mode: "overseas_captive",
    focusItemId: "inst-smithsonian"
  },
  {
    id: "timeline-beijing-20260218",
    title: "北京城市展示节点状态更新",
    summary: "中国圈养模式强化了城市展示节点的标签说明，用于区分基地、动物园与研究机构。",
    date: "2026-02-18",
    kind: "agreement",
    mode: "china_captive",
    focusItemId: "inst-beijing-zoo"
  },
  {
    id: "timeline-wolong-20251205",
    title: "卧龙基地补录野化适应说明",
    summary: "中国圈养网络新增与野外保护地联系最紧密节点的说明，帮助理解圈养与野生之间的过渡关系。",
    date: "2025-12-05",
    kind: "sync",
    mode: "china_captive",
    focusItemId: "inst-shenshuping"
  },
  {
    id: "timeline-madrid-20250905",
    title: "马德里合作节点并入年度名录版本",
    summary: "海外模式同步了欧洲合作节点的年度记录，便于回看不同快照之间的网络变化。",
    date: "2025-09-05",
    kind: "agreement",
    mode: "overseas_captive",
    focusItemId: "inst-madrid"
  }
];

export const ATLAS_EXTENSION_CARDS: AtlasExtensionCard[] = [
  {
    kicker: "中国野生专题",
    title: "继续下钻山系、保护地与栖息地关系",
    body: "从野生分布区进入更细的山系与保护地叙事，补足地图之外的生态背景。",
    href: "/"
  },
  {
    kicker: "熊猫档案",
    title: "从机构网络跳转到个体图鉴",
    body: "继续查看机构中的代表个体与相关档案，把空间网络延展为对象阅读。",
    href: "/atlas"
  },
  {
    kicker: "亲缘关系",
    title: "把对象阅读继续展开为谱系关系",
    body: "从图谱中的机构与个体继续进入亲缘关系工作台，连接空间和谱系两种阅读维度。",
    href: "/lineage"
  },
  {
    kicker: "时间与变化",
    title: "持续积累快照、变动与合作记录",
    body: "为后续的到馆、回国、状态更新与合作变更预留稳定的时间层入口。",
    href: "/global-distribution"
  }
];
