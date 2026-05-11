import type { ComponentType } from "react";
import {
  BookOpen,
  CalendarDays,
  Clock3,
  Heart,
  Leaf,
  MapPinned,
  PawPrint,
  Users
} from "lucide-react";
import type { PandaDetail, PandaListItem } from "@/lib/types";

type IconType = ComponentType<{ className?: string }>;

export interface HeroStat {
  label: string;
  value: string;
  icon: IconType;
}

export interface DetailField {
  label: string;
  value: string;
  helper: string;
}

export interface TimelineItem {
  time: string;
  title: string;
  note: string;
}

export interface GalleryItem {
  src: string;
  alt: string;
  caption: string;
  detail: string;
  large?: boolean;
}

export interface TraitItem {
  title: string;
  body: string;
  icon: IconType;
}

export interface FamilyItem {
  name: string;
  relation: string;
  blurb: string;
  image: string;
  href: string;
}

export interface ReadingItem {
  category: string;
  title: string;
  summary: string;
  image: string;
  href: string;
}

export interface RecommendItem {
  name: string;
  summary: string;
  meta: string;
  image: string;
  href: string;
}

export interface FeaturedMediaItem {
  src: string;
  alt: string;
  title: string;
  duration: string;
}

export interface PandaProfileExperience {
  nameZh: string;
  nameEn: string;
  eyebrow: string;
  summary: string;
  heroImage: string;
  heroAlt: string;
  heroMeta: string;
  heroTags: string[];
  heroStats: HeroStat[];
  recordCode: string;
  basicFields: DetailField[];
  storyQuote: string;
  storyParagraphs: string[];
  timeline: TimelineItem[];
  gallery: GalleryItem[];
  featuredMedia: FeaturedMediaItem;
  traits: TraitItem[];
  family: FamilyItem[];
  readings: ReadingItem[];
  recommendations: RecommendItem[];
}

interface PandaProfileBuildInput {
  panda: PandaDetail;
  atlasItems: PandaListItem[];
  canonicalSlug: string;
}

interface PresentationPreset {
  image: string;
  summary?: string;
  tags?: string[];
  temperament?: string;
  weight?: string;
  location?: string;
}

const PRESENTATION_PRESETS: Record<string, PresentationPreset> = {
  "he-hua": {
    image: "/pandas/he-hua/hero.jpg",
    summary:
      "一只因温和气质、圆润体态和极高辨识度而被许多人记住的年轻雌性大熊猫，也是成都基地最具公众认知度的个体之一。",
    tags: ["明星熊猫", "慢节奏", "温和", "高辨识度"],
    temperament: "温和、慢节奏",
    weight: "95.5 kg",
    location: "成都大熊猫繁育研究基地"
  },
  "meng-lan": {
    image: "/home/archive-xiao-qi-ji.jpg",
    summary: "以攀爬能力和探索欲闻名，是公众辨识度极高的雄性大熊猫。",
    tags: ["高人气", "爱攀爬", "活跃"],
    temperament: "活跃、好奇",
    location: "北京动物园"
  },
  "fu-bao": {
    image: "/home/archive-bao-bao.jpg",
    summary: "兼具国际关注度与成长记录价值，是典型的青年个体样本。",
    tags: ["青年个体", "高关注", "成长档案"],
    temperament: "适应良好、好奇",
    location: "卧龙神树坪基地"
  },
  "yun-chuan": {
    image: "/home/archive-mei-lan.jpg",
    summary: "行为节律稳定，对环境设施利用率高，适合做长期观察记录。",
    tags: ["青年个体", "稳定", "观察样本"],
    temperament: "稳定、观察型",
    location: "成都大熊猫繁育研究基地"
  },
  "jin-hu": {
    image: "/home/archive-bao-bao.jpg",
    summary: "对新环境响应积极，采食和活动节律平稳，适合做适应性观察。",
    tags: ["活跃", "适应良好", "母系线"],
    temperament: "适应良好、平稳",
    location: "雅安碧峰峡基地"
  },
  "qing-shan": {
    image: "/home/archive-tian-tian.jpg",
    summary: "研究记录完整、行为节律稳定，是公共图鉴里很适合继续深挖的个体。",
    tags: ["稳定", "科研记录", "关系连接"],
    temperament: "稳定、规律",
    location: "秦岭科学公园"
  },
  "xin-bao": {
    image: "/home/archive-xiao-qi-ji.jpg",
    summary: "日间活动窗口明显，运动量较高，适合放入活跃型青年个体专题。",
    tags: ["高活动", "青年个体", "监测样本"],
    temperament: "活跃、外向",
    location: "都江堰熊猫谷"
  },
  "bi-li": {
    image: "/pandas/he-hua/family-father.jpg",
    summary: "高龄档案价值突出，健康记录与行为监测信息适合长期保育阅读。",
    tags: ["高龄", "重点监测", "谱系锚点"],
    temperament: "稳重、耐受",
    location: "都江堰熊猫谷"
  },
  "zhen-zhen": {
    image: "/pandas/he-hua/gallery-2.jpg",
    summary: "长期参与国际合作保育项目，兼具跨区域传播与繁育档案价值。",
    tags: ["国际合作", "繁育档案", "稳定"],
    temperament: "稳定、成熟",
    location: "国际合作保育中心"
  },
  "xi-yue": {
    image: "/pandas/he-hua/gallery-3.jpg",
    summary: "已归档个体，适合在历史视角下回看完整生平记录与谱系线索。",
    tags: ["历史档案", "谱系参考", "纪念个体"],
    temperament: "档案型",
    location: "历史档案"
  },
  "hua-mei": {
    image: "/pandas/he-hua/gallery-5.jpg",
    summary: "代表性历史个体之一，在谱系研究与国际传播语境里都具有典型意义。",
    tags: ["历史档案", "谱系研究", "标志个体"],
    temperament: "历史锚点",
    location: "历史档案"
  }
};

const RECOMMENDATION_ORDER = [
  "he-hua",
  "meng-lan",
  "fu-bao",
  "yun-chuan",
  "jin-hu",
  "qing-shan",
  "xin-bao",
  "bi-li"
];

function statusLabel(status: PandaDetail["status"]): string {
  if (status === "alive") {
    return "存活";
  }
  if (status === "deceased") {
    return "已故";
  }
  return "未知";
}

function genderLabel(gender: PandaDetail["gender"]): string {
  if (gender === "male") {
    return "雄性";
  }
  if (gender === "female") {
    return "雌性";
  }
  return "未知";
}

function calcAgeLabel(birthDate: string | null): string {
  if (!birthDate) {
    return "待补录";
  }

  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) {
    return "待补录";
  }

  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return `${Math.max(age, 0)} 岁`;
}

function formatDateLabel(date: string | null): string {
  if (!date) {
    return "待补录";
  }

  const [year, month, day] = date.split("-");
  if (!year || !month || !day) {
    return date;
  }
  return `${year}.${month}.${day}`;
}

function buildRecordCode(panda: PandaDetail): string {
  if (panda.birth_date) {
    const [year, month] = panda.birth_date.split("-");
    if (year && month) {
      return `PA-${year}-${month}`;
    }
  }
  return `PA-${panda.id.slice(0, 8).toUpperCase()}`;
}

function resolveMediaUrl(media: PandaDetail["media"][number]): string | null {
  const candidate = (media.signed_url ?? media.storage_path ?? "").trim();
  if (!candidate) {
    return null;
  }
  if (candidate.startsWith("http://") || candidate.startsWith("https://") || candidate.startsWith("/")) {
    return candidate;
  }
  return null;
}

function displayName(panda: Pick<PandaDetail, "slug" | "name_zh" | "name_en">): {
  nameZh: string;
  nameEn: string;
} {
  return {
    nameZh: panda.name_zh || panda.slug,
    nameEn: panda.name_en ?? panda.slug
  };
}

function displayLocation(panda: Pick<PandaDetail, "slug" | "current_location">): string {
  return PRESENTATION_PRESETS[panda.slug]?.location ?? panda.current_location ?? "待补录";
}

function imageForSlug(slug: string): string {
  return PRESENTATION_PRESETS[slug]?.image ?? "/home/hero-panda.jpg";
}

function buildFamilyCards(panda: PandaDetail, atlasItems: PandaListItem[]): FamilyItem[] {
  const byId = new Map(atlasItems.map((item) => [item.id, item]));
  const relations: Array<{ label: string; item: PandaListItem | undefined }> = [
    { label: "父亲", item: panda.father_id ? byId.get(panda.father_id) : undefined },
    { label: "母亲", item: panda.mother_id ? byId.get(panda.mother_id) : undefined }
  ];

  return relations.flatMap((relation) => {
    if (!relation.item) {
      return [];
    }

    const names = displayName(relation.item);
    const location = displayLocation(relation.item);

    return [
      {
        name: names.nameZh,
        relation: relation.label,
        blurb: `现居或归档地点为 ${location}，可继续查看该个体的完整图鉴档案。`,
        image: imageForSlug(relation.item.slug),
        href: `/atlas/${relation.item.slug}`
      }
    ];
  });
}

function buildRecommendations(
  panda: PandaDetail,
  atlasItems: PandaListItem[]
): RecommendItem[] {
  const bySlug = new Map(atlasItems.map((item) => [item.slug, item]));
  const recommendations: RecommendItem[] = [];

  for (const slug of RECOMMENDATION_ORDER) {
    if (slug === panda.slug) {
      continue;
    }

    const item = bySlug.get(slug);
    if (!item) {
      continue;
    }

    const names = displayName(item);
    recommendations.push({
      name: names.nameZh,
      summary: `继续查看 ${names.nameZh} 的个体档案，比较其与当前个体在基地、年龄阶段与公众叙事上的差异。`,
      meta: `${displayLocation(item)} · ${genderLabel(item.gender)}`,
      image: imageForSlug(item.slug),
      href: `/atlas/${item.slug}`
    });

    if (recommendations.length === 3) {
      break;
    }
  }

  return recommendations;
}

function buildGenericReadings(panda: PandaDetail): ReadingItem[] {
  const names = displayName(panda);
  return [
    {
      category: "档案方法",
      title: `如何理解 ${names.nameZh} 的个体档案结构`,
      summary: "从基础身份字段、地点信息到家族关系，把一页详情读成一条可持续扩展的记录链。",
      image: "/home/knowledge-scroll.jpg",
      href: "/atlas"
    },
    {
      category: "基地观察",
      title: `${displayLocation(panda)} 的日常记录如何影响公众认知`,
      summary: "基地观察、个体故事与公众传播之间并不是割裂的，它们共同决定了图鉴页的阅读方式。",
      image: "/home/knowledge-bamboo.jpg",
      href: "/atlas"
    },
    {
      category: "谱系浏览",
      title: "从个体详情页进入谱系视角",
      summary: "当父母与谱系锚点可以点击时，详情页就不再是孤立的单页，而是关系浏览入口。",
      image: "/home/story-video.jpg",
      href: `/lineage?focus=${panda.slug}`
    }
  ];
}

function buildGenericGallery(panda: PandaDetail, nameZh: string): GalleryItem[] {
  const primaryImage =
    panda.cover_image_url ??
    panda.media.map(resolveMediaUrl).find((value): value is string => Boolean(value)) ??
    imageForSlug(panda.slug);

  return [
    {
      src: primaryImage,
      alt: `${nameZh} 主影像`,
      caption: "主记录",
      detail: "当前详情页优先使用可用的个体主图建立第一视觉。 "
    },
    {
      src: imageForSlug("meng-lan"),
      alt: `${nameZh} 环境观察`,
      caption: "环境观察",
      detail: "用更宽松的图像节奏承接档案阅读。"
    },
    {
      src: imageForSlug("fu-bao"),
      alt: `${nameZh} 行为片段`,
      caption: "行为片段",
      detail: "保留自然观察视角，而不是只停留在字段介绍。",
      large: true
    },
    {
      src: imageForSlug("qing-shan"),
      alt: `${nameZh} 体态特征`,
      caption: "体态特征",
      detail: "方便在视觉层面建立识别记忆。"
    },
    {
      src: imageForSlug("jin-hu"),
      alt: `${nameZh} 日常片段`,
      caption: "日常片段",
      detail: "为后续扩展成长观察和时间线留出空间。"
    }
  ];
}

function buildGenericExperience(
  panda: PandaDetail,
  atlasItems: PandaListItem[]
): PandaProfileExperience {
  const preset = PRESENTATION_PRESETS[panda.slug];
  const names = displayName(panda);
  const location = displayLocation(panda);
  const birthplace = panda.birthplace ?? "待补录";
  const intro =
    panda.intro ??
    preset?.summary ??
    "当前页面已建立基础身份、地点与关系入口，后续还会继续补充更完整的故事与影像。";
  const heroTags = preset?.tags ?? panda.tags.slice(0, 4);
  const firstHabitat = panda.habitats[0];
  const family = buildFamilyCards(panda, atlasItems);
  const gallery = buildGenericGallery(panda, names.nameZh);
  const featuredMedia = {
    src: gallery[2]?.src ?? gallery[0].src,
    alt: gallery[2]?.alt ?? gallery[0].alt,
    title: `${names.nameZh} 的生活片段`,
    duration: "02:48"
  };

  return {
    nameZh: names.nameZh,
    nameEn: names.nameEn,
    eyebrow: "熊猫个体档案",
    summary: intro,
    heroImage: gallery[0].src,
    heroAlt: `${names.nameZh} 详情页主视觉`,
    heroMeta: `${genderLabel(panda.gender)} | ${calcAgeLabel(panda.birth_date)}`,
    heroTags: heroTags.length > 0 ? heroTags : [genderLabel(panda.gender), statusLabel(panda.status)],
    heroStats: [
      { label: "出生日期", value: formatDateLabel(panda.birth_date), icon: CalendarDays },
      { label: "出生地", value: birthplace, icon: MapPinned },
      { label: "现居住地", value: location, icon: MapPinned },
      { label: "状态", value: statusLabel(panda.status), icon: Heart },
      { label: "档案编号", value: buildRecordCode(panda), icon: BookOpen }
    ],
    recordCode: buildRecordCode(panda),
    basicFields: [
      { label: "英文名", value: names.nameEn, helper: "用于检索和国际合作档案" },
      { label: "性别", value: genderLabel(panda.gender), helper: "基础个体字段" },
      { label: "出生日期", value: formatDateLabel(panda.birth_date), helper: "按当前档案版本展示" },
      { label: "当前年龄", value: calcAgeLabel(panda.birth_date), helper: "按当前日期自动计算" },
      { label: "出生地", value: birthplace, helper: "来自 detail endpoint 的规范字段" },
      { label: "现居地", value: location, helper: "保留与基地或归档专题的后续联动空间" },
      {
        label: "关联栖息地",
        value: firstHabitat ? firstHabitat.name : "待补录",
        helper: firstHabitat?.province ? `所在省份：${firstHabitat.province}` : "后续可补充生态信息"
      },
      {
        label: "家族入口",
        value: family.length > 0 ? family.map((item) => `${item.relation}：${item.name}`).join(" / ") : "待补录",
        helper: family.length > 0 ? "已具备可点击的家族关系入口" : "关系网络仍在补录中"
      }
    ],
    storyQuote: `“${names.nameZh} 的公开档案已经能够连接基础身份、出生信息与家族关系，但仍会继续补录更完整的日常故事。”`,
    storyParagraphs: [
      intro,
      `${names.nameZh} 当前以 ${location} 为主要公开展示或归档地点，出生地字段为 ${birthplace}。这使页面不再只是堆字段，而是能把身份、地点与成长线索组织成更清晰的浏览链。`,
      family.length > 0
        ? `当前页面已经可以从 ${names.nameZh} 继续进入父母关系卡片和谱系浏览页，形成 profile -> lineage -> profile 的完整往返路径。`
        : `当前页面已经保留出家族关系入口位，待关系数据继续补录后可直接扩展为可点击的关系网络。`
    ],
    timeline: [
      {
        time: formatDateLabel(panda.birth_date),
        title: "出生记录",
        note: `${names.nameZh} 以 ${birthplace} 作为当前归档出生地进入公开档案系统。`
      },
      {
        time: "当前",
        title: "现居地记录",
        note: `当前档案地点为 ${location}。`
      },
      {
        time: "关系补录",
        title: "家族入口",
        note:
          family.length > 0
            ? `已建立 ${family.map((item) => `${item.relation}${item.name}`).join("、")} 的可点击卡片。`
            : "尚未建立公开可点击的家族卡片。"
      },
      {
        time: "持续更新",
        title: "资料扩充",
        note: "后续仍可补充更多影像、成长故事与生态专题关联。"
      }
    ],
    gallery,
    featuredMedia,
    traits: [
      { title: "资料状态", body: "当前以 canonical detail 数据为主，保留后续扩展影像和故事的空间。", icon: BookOpen },
      {
        title: "行为观察",
        body: preset?.temperament
          ? `当前整理出的性格关键词为 ${preset.temperament}。`
          : "可结合更多时间线节点继续补充活动节律与习性摘要。",
        icon: PawPrint
      },
      {
        title: "浏览建议",
        body:
          family.length > 0
            ? "建议继续查看家族卡片或切换到谱系页，从关系网络继续浏览。"
            : "建议继续查看图鉴列表、谱系关系和相关生态专题。",
        icon: Users
      }
    ],
    family,
    readings: buildGenericReadings(panda),
    recommendations: buildRecommendations(panda, atlasItems)
  };
}

function buildHeHuaExperience(
  panda: PandaDetail,
  atlasItems: PandaListItem[]
): PandaProfileExperience {
  const generic = buildGenericExperience(panda, atlasItems);
  const location = displayLocation(panda);
  const birthplace = panda.birthplace ?? "待补录";

  return {
    ...generic,
    eyebrow: "重点个体档案",
    summary:
      "一只因温和气质、圆润体态和极高辨识度而被许多人记住的年轻雌性大熊猫，也是成都基地最具公众认知度的个体之一。",
    heroImage: "/pandas/he-hua/hero.jpg",
    heroAlt: "和花在草地上进食",
    heroTags: ["明星熊猫", "慢节奏", "温和", "爱爬高处", "高辨识度"],
    heroStats: [
      { label: "出生日期", value: formatDateLabel(panda.birth_date), icon: CalendarDays },
      { label: "出生地", value: birthplace, icon: MapPinned },
      { label: "现居住地", value: location, icon: MapPinned },
      { label: "性格特征", value: "温和、慢节奏", icon: Heart },
      { label: "档案编号", value: generic.recordCode, icon: BookOpen }
    ],
    basicFields: [
      { label: "中文名", value: "和花", helper: "公众常称‘花花’，辨识度极高的雌性个体。" },
      { label: "英文名", value: "He Hua", helper: "用于档案检索与国际传播场景。" },
      { label: "出生日期", value: formatDateLabel(panda.birth_date), helper: "按当前档案版本展示。" },
      { label: "当前年龄", value: calcAgeLabel(panda.birth_date), helper: "按当前日期自动计算。" },
      { label: "出生地", value: birthplace, helper: "来自 canonical detail payload。" },
      { label: "现居地", value: location, helper: "与图鉴、谱系和基地专题共享同一条 canonical 记录。" },
      {
        label: "家族入口",
        value:
          generic.family.length > 0
            ? generic.family.map((item) => `${item.relation}：${item.name}`).join(" / ")
            : "待补录",
        helper: generic.family.length > 0 ? "父母卡片可直接跳转至对应档案页。" : "关系网络仍在补录中。"
      },
      { label: "档案状态", value: statusLabel(panda.status), helper: "基础资料完整，影像与故事仍可继续扩展。" }
    ],
    storyQuote:
      "“被许多人亲切地称作‘花花’，她以平和的性格和极高辨识度的体态，成为很多人认识大熊猫的第一张面孔。”",
    storyParagraphs: [
      "和花出生于成都大熊猫繁育研究基地。与许多精力充沛、活泼好动的同龄熊猫不同，她更偏向安静、温和和慢节奏，常常以稳定的情绪和舒缓的动作节律出现在公众视野中。",
      `当前 canonical profile 已经能够稳定给出和花的出生地 ${birthplace}、现居地 ${location} 与可点击的家族入口，让详情页不再停留在孤立的明星故事层面。`,
      "在长期观察里，和花展现出较强的环境适应能力和稳定的社交气质。她不以夸张动作吸引目光，却凭借一种安静、松弛的生命状态，让这个页面更适合用自然专题而不是宠物介绍的方式来讲述。"
    ],
    timeline: [
      { time: "2020.07", title: "诞生", note: `出生地记录为 ${birthplace}，随后进入公开档案系统。` },
      { time: "2020.10", title: "首次亮相", note: "在育幼环境中首次公开亮相，因圆润体态和安静气质迅速获得大量关注。" },
      { time: "2021.03", title: "命名仪式", note: "正式命名为‘和花’，名称延续了温和、和美与自然生长的意象。" },
      { time: "当前", title: "资料联动", note: "现在可以从个体页直接跳到其父母档案与谱系浏览页。" }
    ],
    gallery: [
      { src: "/pandas/he-hua/gallery-1.jpg", alt: "和花近景肖像", caption: "表情特写", detail: "最能体现和花高辨识度面部轮廓的一张近景。" },
      { src: "/pandas/he-hua/gallery-2.jpg", alt: "和花在木架上活动", caption: "攀爬时刻", detail: "慢节奏并不代表没有探索欲，她同样会选择高处停留。" },
      { src: "/pandas/he-hua/gallery-3.jpg", alt: "和花趴在树干上休息", caption: "生活片段", detail: "适合作为视频封面与沉浸区主画面。", large: true },
      { src: "/pandas/he-hua/gallery-4.jpg", alt: "和花在自然环境中活动", caption: "环境互动", detail: "保留与周围环境的关系感，而不只是个体特写。" },
      { src: "/pandas/he-hua/gallery-5.jpg", alt: "和花进食画面", caption: "进食观察", detail: "适合补充日常行为和食物偏好的细节。" }
    ],
    featuredMedia: {
      src: "/pandas/he-hua/gallery-3.jpg",
      alt: "和花生活片段视频封面",
      title: "高处观察与休息片段",
      duration: "02:48"
    },
    traits: [
      { title: "最爱的食物", body: "新鲜的竹笋和切片苹果常被放在早间观察记录里，进食时状态尤其稳定。", icon: Leaf },
      { title: "独特习惯", body: "她喜欢在树干、木架或石面附近停留较长时间，再从高处缓慢观察周围环境。", icon: Clock3 },
      { title: "社交风格", body: "整体表现出较强的包容感与松弛气质，在同伴互动中更偏耐心和稳定。", icon: Users }
    ],
    readings: [
      {
        category: "栖息地科学",
        title: "大熊猫栖息地科学",
        summary: "从生境连续性、竹林结构与微气候出发，理解野外熊猫为何需要稳定的生态系统支持。",
        image: "/pandas/he-hua/reading-1.jpg",
        href: "/map"
      },
      {
        category: "基地动态",
        title: "成都基地的日常观察记录",
        summary: "把饲养、观察、公众展示与科研记录放在同一个时间维度里理解，才能看清一只熊猫的成长轨迹。",
        image: "/pandas/he-hua/reading-2.jpg",
        href: "/atlas"
      },
      {
        category: "谱系浏览",
        title: "从和花进入谱系视角",
        summary: "现在可以从详情页直接保留焦点进入谱系浏览，继续查看父母与相关个体。",
        image: "/pandas/he-hua/reading-3.jpg",
        href: `/lineage?focus=${panda.slug}`
      }
    ]
  };
}

export function buildPandaProfileExperience({
  panda,
  atlasItems
}: PandaProfileBuildInput): PandaProfileExperience {
  if (panda.slug === "he-hua") {
    return buildHeHuaExperience(panda, atlasItems);
  }

  return buildGenericExperience(panda, atlasItems);
}
