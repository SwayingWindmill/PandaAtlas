import type { PandaListItem, PandaStatus } from "@/lib/types";

export type AtlasAgeStage = "cub" | "juvenile" | "adult" | "senior" | "unknown";
export type AtlasSortOption = "recommended" | "popular" | "latest" | "youngest" | "oldest" | "name_asc";

export interface AtlasPandaCard {
  id: string;
  slug: string;
  href: string;
  recordCode: string;
  nameZh: string;
  nameEn: string | null;
  image: string;
  summary: string;
  tags: string[];
  topics: string[];
  badge: string;
  featured: boolean;
  popularity: number;
  gender: PandaListItem["gender"];
  genderLabel: string;
  status: PandaStatus;
  statusLabel: string;
  birthDate: string | null;
  ageYears: number | null;
  ageLabel: string;
  ageStage: AtlasAgeStage;
  ageStageLabel: string;
  location: string;
  locationShort: string;
  searchText: string;
}

interface CuratedProfile {
  image: string;
  summary: string;
  tags: string[];
  badge: string;
  popularity: number;
  featured?: boolean;
}

const CURATED_PROFILES: Record<string, CuratedProfile> = {
  "he-hua": {
    image: "/atlas/stitch-he-hua.jpg",
    summary: "以圆润体态与慢节奏动作被许多人记住，是成都基地最具辨识度的明星个体之一。",
    tags: ["明星熊猫", "温和", "高关注度"],
    badge: "重点观察",
    popularity: 100,
    featured: true,
  },
  "fu-bao": {
    image: "/atlas/stitch-fu-bao.jpg",
    summary: "成长记录完整、公众关注度高，适合作为青年个体档案的典型入口。",
    tags: ["明星熊猫", "青年档案", "高关注度"],
    badge: "热门档案",
    popularity: 96,
    featured: true,
  },
  "meng-lan": {
    image: "/atlas/stitch-meng-lan.jpg",
    summary: "以好奇和行动力闻名，适合从活跃型个体的视角继续浏览相关档案。",
    tags: ["活跃", "爱探索", "高关注度"],
    badge: "行为样本",
    popularity: 94,
    featured: true,
  },
  "yun-chuan": {
    image: "/home/archive-mei-lan.jpg",
    summary: "行为节律稳定，对丰容设施利用率高，适合长期观察与日常记录。",
    tags: ["稳定", "青年档案", "基地观察"],
    badge: "持续跟踪",
    popularity: 88,
    featured: true,
  },
  "jin-hu": {
    image: "/home/archive-bao-bao.jpg",
    summary: "对新环境反应积极，采食和活动节律平稳，适合作为青年成体对照样本。",
    tags: ["活跃", "适应良好", "青年成体"],
    badge: "行为样本",
    popularity: 82,
  },
  "qing-shan": {
    image: "/home/archive-tian-tian.jpg",
    summary: "记录完整、节律规律，适合从科研观察视角理解个体日常行为与基地管理。",
    tags: ["稳定", "科研监测", "秦岭种群"],
    badge: "科研记录",
    popularity: 80,
  },
  "xin-bao": {
    image: "/home/archive-xiao-qi-ji.jpg",
    summary: "日间活动窗口清晰，运动量较高，适合放在活跃型青年个体专题中浏览。",
    tags: ["高活动", "青年档案", "日常监测"],
    badge: "动态观察",
    popularity: 78,
  },
  "bi-li": {
    image: "/pandas/he-hua/gallery-4.jpg",
    summary: "高龄档案价值突出，健康记录与行为监测信息适合长期保育阅读。",
    tags: ["高龄", "重点监测", "保育档案"],
    badge: "高龄档案",
    popularity: 72,
  },
  "zhen-zhen": {
    image: "/pandas/he-hua/gallery-2.jpg",
    summary: "长期参与国际合作保育项目，兼具跨区域传播与繁育档案的阅读价值。",
    tags: ["国际合作", "稳定", "繁育档案"],
    badge: "合作保育",
    popularity: 74,
  },
  "xi-yue": {
    image: "/pandas/he-hua/gallery-3.jpg",
    summary: "已归档个体，适合在历史视角下回看完整生平记录与科研线索。",
    tags: ["历史档案", "科研回溯", "纪念个体"],
    badge: "历史记录",
    popularity: 60,
  },
  "hua-mei": {
    image: "/pandas/he-hua/gallery-5.jpg",
    summary: "代表性历史个体之一，在谱系研究与国际传播语境里都具有典型意义。",
    tags: ["历史档案", "谱系研究", "标志个体"],
    badge: "代表个体",
    popularity: 66,
  },
  "wild-sample-001": {
    image: "/home/hero-panda.jpg",
    summary: "来自野外监测样本库，用于分布建模和栖息地评估，是研究型档案入口。",
    tags: ["野外监测", "研究样本", "生态关联"],
    badge: "野外样本",
    popularity: 58,
  },
};

const LOCATION_SHORTCUTS: Array<{ match: string; label: string }> = [
  { match: "成都大熊猫繁育研究基地", label: "成都基地" },
  { match: "卧龙", label: "卧龙基地" },
  { match: "北京动物园", label: "北京动物园" },
  { match: "都江堰", label: "都江堰熊猫苑" },
  { match: "雅安碧峰峡", label: "碧峰峡基地" },
  { match: "秦岭四宝", label: "秦岭四宝公园" },
  { match: "海外合作保育中心", label: "海外合作中心" },
  { match: "历史档案", label: "历史档案" },
  { match: "龙门山", label: "龙门山片区" },
];

function buildRecordCode(item: PandaListItem): string {
  if (item.birth_date) {
    const [year, month] = item.birth_date.split("-");
    if (year && month) {
      return `PA-${year}-${month}`;
    }
  }

  return `PA-${item.id.slice(0, 4).toUpperCase()}`;
}

function genderLabel(gender: PandaListItem["gender"]): string {
  if (gender === "male") {
    return "雄性";
  }
  if (gender === "female") {
    return "雌性";
  }
  return "性别待补录";
}

function statusLabel(status: PandaStatus): string {
  if (status === "alive") {
    return "存活";
  }
  if (status === "deceased") {
    return "已故";
  }
  return "状态待补录";
}

function calculateAgeYears(birthDate: string | null): number | null {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function resolveAgeStage(ageYears: number | null): AtlasAgeStage {
  if (ageYears === null) {
    return "unknown";
  }
  if (ageYears <= 1) {
    return "cub";
  }
  if (ageYears <= 5) {
    return "juvenile";
  }
  if (ageYears <= 17) {
    return "adult";
  }
  return "senior";
}

function ageStageLabel(stage: AtlasAgeStage): string {
  if (stage === "cub") {
    return "幼年";
  }
  if (stage === "juvenile") {
    return "青年";
  }
  if (stage === "adult") {
    return "成年";
  }
  if (stage === "senior") {
    return "高龄";
  }
  return "阶段待补录";
}

function ageLabel(ageYears: number | null): string {
  if (ageYears === null) {
    return "年龄待补录";
  }
  return `${ageYears} 岁`;
}

function simplifyLocation(location: string | null): string {
  const normalized = (location ?? "").trim();
  if (!normalized) {
    return "基地待补录";
  }

  const matched = LOCATION_SHORTCUTS.find((item) => normalized.includes(item.match));
  return matched?.label ?? normalized;
}

function fallbackSummary(item: PandaListItem, stageLabelValue: string, location: string): string {
  const archiveStatus = item.status === "deceased" ? "历史归档" : "持续收录";
  const stageText = stageLabelValue === "阶段待补录" ? "个体" : `${stageLabelValue}个体`;
  return `${location}的${stageText}，当前以${archiveStatus}记录为主，适合继续补充行为和影像资料。`;
}

function fallbackTags(item: PandaListItem, stageLabelValue: string, locationShort: string): string[] {
  const tags = [stageLabelValue, genderLabel(item.gender), locationShort];
  if (item.status === "deceased") {
    tags.unshift("历史档案");
  }
  return tags.filter((value, index, array) => value !== "阶段待补录" && array.indexOf(value) === index);
}

export function buildAtlasPandaCard(item: PandaListItem): AtlasPandaCard {
  const curated = CURATED_PROFILES[item.slug];
  const ageYears = calculateAgeYears(item.birth_date);
  const stage = resolveAgeStage(ageYears);
  const stageLabelValue = ageStageLabel(stage);
  const locationShort = simplifyLocation(item.current_location);
  const tags = (curated?.tags ?? fallbackTags(item, stageLabelValue, locationShort)).slice(0, 4);
  const summary = curated?.summary ?? fallbackSummary(item, stageLabelValue, locationShort);
  const badge = curated?.badge ?? (item.status === "deceased" ? "历史记录" : "馆藏档案");

  return {
    id: item.id,
    slug: item.slug,
    href: `/atlas/${item.slug || item.id}`,
    recordCode: buildRecordCode(item),
    nameZh: item.name_zh,
    nameEn: item.name_en,
    image: curated?.image ?? "/home/hero-panda.jpg",
    summary,
    tags,
    topics: [...new Set([...tags, locationShort, stageLabelValue].filter(Boolean))],
    badge,
    featured: curated?.featured ?? false,
    popularity: curated?.popularity ?? 40,
    gender: item.gender,
    genderLabel: genderLabel(item.gender),
    status: item.status,
    statusLabel: statusLabel(item.status),
    birthDate: item.birth_date,
    ageYears,
    ageLabel: ageLabel(ageYears),
    ageStage: stage,
    ageStageLabel: stageLabelValue,
    location: item.current_location ?? "基地待补录",
    locationShort,
    searchText: [item.name_zh, item.name_en ?? "", item.slug, item.current_location ?? "", summary, ...tags, ...(item.search_terms ?? [])]
      .join(" ")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  };
}
