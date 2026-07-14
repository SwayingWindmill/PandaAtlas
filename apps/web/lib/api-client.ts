import type {
  CompleteGeoJsonFeatureCollection,
  DistributionFeatureProperties,
  DistributionLayer,
  DistributionSnapshot,
  DistributionSnapshotList,
  HabitatFeatureProperties,
  OverviewStats,
  PaginatedPandasResponse,
  PandaDetail,
  PandaLineageResponse,
  PandaListItem
} from "@/lib/types";
import {
  TRUSTED_PANDA_DETAILS,
  TRUSTED_PANDA_REFERENCES
} from "@/lib/generated/trusted-identity-aliases";
import { DEFAULT_LINEAGE_FOCUS_ID, LINEAGE_PANDAS } from "@/lib/lineage-data";

const DEFAULT_BBOX = "100,25,110,36";

type FallbackPandaSeed = Omit<
  PandaDetail,
  "birthplace" | "identity" | "conclusions" | "sources"
> & {
  birthplace?: string | null;
};

const FALLBACK_PANDA_DETAILS: FallbackPandaSeed[] = [
  {
    id: "1d08f72f-7550-42e9-a4d5-bd74bc505955",
    slug: "he-hua",
    name_zh: "和花",
    name_en: "He Hua",
    gender: "female",
    status: "alive",
    birth_date: "2020-07-04",
    current_location: "成都大熊猫繁育研究基地",
    cover_image_url: null,
    intro: "性格温和、社交活跃，常在互动区参与行为训练。",
    tags: ["明星", "社交", "人工繁育"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-ms", name: "岷山片区", province: "四川" }],
    media: []
  },
  {
    id: "e2f0ff4a-4a98-413a-a0d2-64e12d68db43",
    slug: "meng-lan",
    name_zh: "萌兰",
    name_en: "Meng Lan",
    gender: "male",
    status: "alive",
    birth_date: "2015-07-04",
    current_location: "北京动物园",
    cover_image_url: null,
    intro: "以攀爬与探索行为闻名，展区活动频率高。",
    tags: ["活跃", "攀爬", "高人气"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-ql", name: "秦岭片区", province: "陕西" }],
    media: []
  },
  {
    id: "8a2af4f3-197f-4f48-81af-c2d711f4b067",
    slug: "wild-sample-001",
    name_zh: "野外样本 001",
    name_en: "Wild Sample 001",
    gender: "unknown",
    status: "unknown",
    birth_date: null,
    current_location: "龙门山片区",
    cover_image_url: null,
    intro: "来自野外监测样本库，用于分布建模和栖息地评估。",
    tags: ["野外", "监测", "样本"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-lm", name: "龙门山片区", province: "四川" }],
    media: []
  },
  {
    id: "31d1f8be-7b95-4f0d-8f65-1e030fd22d71",
    slug: "fu-bao",
    name_zh: "福宝",
    name_en: "Fu Bao",
    gender: "female",
    status: "alive",
    birth_date: "2020-07-20",
    current_location: "中国保护大熊猫研究中心卧龙神树坪基地",
    cover_image_url: null,
    intro: "外放适应训练记录完整，行为习性稳定。",
    tags: ["外放训练", "年轻个体", "适应中"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-wl", name: "卧龙片区", province: "四川" }],
    media: []
  },
  {
    id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    slug: "bi-li",
    name_zh: "比力",
    name_en: "Bi Li",
    gender: "male",
    status: "alive",
    birth_date: "1990-09-16",
    current_location: "都江堰中华大熊猫苑",
    cover_image_url: null,
    intro: "高龄个体，行为监测周期和健康档案较为完整。",
    tags: ["高龄", "重点监测", "保育"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-dj", name: "都江堰片区", province: "四川" }],
    media: []
  },
  {
    id: "53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7",
    slug: "jin-hu",
    name_zh: "金虎",
    name_en: "Jin Hu",
    gender: "female",
    status: "alive",
    birth_date: "2018-08-11",
    current_location: "雅安碧峰峡基地",
    cover_image_url: null,
    intro: "对新环境响应积极，采食和活动节律稳定。",
    tags: ["活跃", "年轻成体", "适应良好"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-ya", name: "邛崃山片区", province: "四川" }],
    media: []
  },
  {
    id: "6f61fd4f-1c4d-4db0-8f10-67ea58f98f80",
    slug: "qing-shan",
    name_zh: "青山",
    name_en: "Qing Shan",
    gender: "male",
    status: "alive",
    birth_date: "2017-05-02",
    current_location: "秦岭四宝科学公园",
    cover_image_url: null,
    intro: "行为节律规律，摄食记录与体重波动平稳。",
    tags: ["稳定", "科研监测", "秦岭种群"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-ql", name: "秦岭片区", province: "陕西" }],
    media: []
  },
  {
    id: "7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e",
    slug: "xi-yue",
    name_zh: "曦月",
    name_en: "Xi Yue",
    gender: "female",
    status: "deceased",
    birth_date: "2010-03-14",
    current_location: "历史档案",
    cover_image_url: null,
    intro: "已归档个体，保留完整生平记录供科研回溯。",
    tags: ["历史档案", "科研回溯"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-ms", name: "岷山片区", province: "四川" }],
    media: []
  },
  {
    id: "89264f73-d0e2-44e0-aad6-8d8fca58f879",
    slug: "yun-chuan",
    name_zh: "云川",
    name_en: "Yun Chuan",
    gender: "male",
    status: "alive",
    birth_date: "2019-06-16",
    current_location: "成都大熊猫繁育研究基地",
    cover_image_url: null,
    intro: "采食偏好稳定，对丰容设施利用率高。",
    tags: ["青年个体", "丰容活跃", "行为稳定"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-ms", name: "岷山片区", province: "四川" }],
    media: []
  },
  {
    id: "95f8e2e0-a8f1-45e5-8b4f-bdb7235d7ce2",
    slug: "xin-bao",
    name_zh: "鑫宝",
    name_en: "Xin Bao",
    gender: "male",
    status: "alive",
    birth_date: "2020-09-02",
    current_location: "都江堰中华大熊猫苑",
    cover_image_url: null,
    intro: "日间活动窗口明显，运动水平较高。",
    tags: ["青年个体", "高活动", "日常监测"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-dj", name: "都江堰片区", province: "四川" }],
    media: []
  },
  {
    id: "a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f",
    slug: "zhen-zhen",
    name_zh: "珍珍",
    name_en: "Zhen Zhen",
    gender: "female",
    status: "alive",
    birth_date: "2007-08-03",
    current_location: "海外合作保育中心",
    cover_image_url: null,
    intro: "长期参与国际合作保育项目，繁育记录完备。",
    tags: ["国际合作", "繁育档案", "稳定"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-intl", name: "合作保育片区", province: null }],
    media: []
  },
  {
    id: "b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df",
    slug: "hua-mei",
    name_zh: "华美",
    name_en: "Hua Mei",
    gender: "female",
    status: "deceased",
    birth_date: "1999-08-21",
    current_location: "历史档案",
    cover_image_url: null,
    intro: "代表性历史个体之一，档案用于种群谱系研究。",
    tags: ["历史档案", "谱系研究", "标志个体"],
    father_id: null,
    mother_id: null,
    habitats: [{ id: "h-ms", name: "岷山片区", province: "四川" }],
    media: []
  }
];

const FALLBACK_PANDA_DETAIL_OVERRIDES: Record<string, Partial<PandaDetail>> = {
  "he-hua": {
    name_zh: "和花",
    current_location: "成都大熊猫繁育研究基地",
    intro: "性格温和、互动感强，是成都基地最受关注的明星个体之一。",
    tags: ["明星熊猫", "温和", "人工繁育"],
    habitats: [{ id: "h-ms", name: "岷山片区", province: "四川" }],
  },
  "meng-lan": {
    name_zh: "萌兰",
    current_location: "北京动物园",
    intro: "以活跃和爱探索著称，展区中的行为表现一直有很高的人气。",
    tags: ["活跃", "爱探索", "高关注度"],
    habitats: [{ id: "h-ql", name: "秦岭片区", province: "陕西" }],
  },
  "wild-sample-001": {
    name_zh: "野外样本 001",
    current_location: "龙门山片区",
    intro: "来自野外监测样本库，用于分布建模和栖息地评估。",
    tags: ["野外监测", "研究样本", "生态关联"],
    habitats: [{ id: "h-lm", name: "龙门山片区", province: "四川" }],
  },
  "fu-bao": {
    name_zh: "福宝",
    current_location: "中国保护大熊猫研究中心卧龙神树坪基地",
    intro: "外放适应训练记录完整，行为习性稳定，是青年个体中的代表样本。",
    tags: ["青年档案", "适应训练", "高关注度"],
    habitats: [{ id: "h-wl", name: "卧龙片区", province: "四川" }],
  },
  "bi-li": {
    name_zh: "比力",
    current_location: "都江堰中华大熊猫苑",
    intro: "高龄个体，健康记录和行为监测周期较长，适合保育档案回看。",
    tags: ["高龄", "重点监测", "保育档案"],
    habitats: [{ id: "h-dj", name: "都江堰片区", province: "四川" }],
  },
  "jin-hu": {
    name_zh: "金虎",
    current_location: "雅安碧峰峡基地",
    intro: "对新环境反应积极，采食与活动节律平稳，适合青年成体观察。",
    tags: ["活跃", "青年成体", "适应良好"],
    habitats: [{ id: "h-ya", name: "邛崃山片区", province: "四川" }],
  },
  "qing-shan": {
    name_zh: "青山",
    current_location: "秦岭四宝科学公园",
    intro: "行为节律规律，摄食记录和体重波动平稳，适合长期科研观察。",
    tags: ["稳定", "科研监测", "秦岭种群"],
    habitats: [{ id: "h-ql", name: "秦岭片区", province: "陕西" }],
  },
  "xi-yue": {
    name_zh: "曦月",
    current_location: "历史档案",
    intro: "已归档个体，保留较完整的生平记录和相关科研线索。",
    tags: ["历史档案", "科研回溯"],
    habitats: [{ id: "h-ms", name: "岷山片区", province: "四川" }],
  },
  "yun-chuan": {
    name_zh: "云川",
    current_location: "成都大熊猫繁育研究基地",
    intro: "采食偏好稳定，对丰容设施利用率高，适合日常行为档案记录。",
    tags: ["青年档案", "行为稳定", "基地观察"],
    habitats: [{ id: "h-ms", name: "岷山片区", province: "四川" }],
  },
  "xin-bao": {
    name_zh: "鑫宝",
    current_location: "都江堰中华大熊猫苑",
    intro: "日间活动窗口明显，运动量较高，适合放入活跃型青年个体专题。",
    tags: ["青年档案", "高活动", "日常监测"],
    habitats: [{ id: "h-dj", name: "都江堰片区", province: "四川" }],
  },
  "zhen-zhen": {
    name_zh: "珍珍",
    current_location: "海外合作保育中心",
    intro: "长期参与国际合作保育项目，繁育与迁移记录较完整。",
    tags: ["国际合作", "繁育档案", "稳定"],
    habitats: [{ id: "h-intl", name: "合作保育片区", province: null }],
  },
  "hua-mei": {
    name_zh: "华美",
    current_location: "历史档案",
    intro: "代表性历史个体之一，相关档案常用于谱系研究和国际传播回顾。",
    tags: ["历史档案", "谱系研究", "标志个体"],
    habitats: [{ id: "h-ms", name: "岷山片区", province: "四川" }],
  },
};

const FALLBACK_PANDA_PROFILE_OVERRIDES: Record<string, Partial<PandaDetail>> = {
  "he-hua": {
    birthplace: "Chengdu Research Base",
    father_id: "89264f73-d0e2-44e0-aad6-8d8fca58f879",
    mother_id: "53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7"
  },
  "meng-lan": {
    birthplace: "Beijing Zoo",
    father_id: "6f61fd4f-1c4d-4db0-8f10-67ea58f98f80",
    mother_id: "a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f"
  },
  "wild-sample-001": {
    birthplace: "Longmen Mountains"
  },
  "fu-bao": {
    birthplace: "Everland Panda World",
    father_id: "e2f0ff4a-4a98-413a-a0d2-64e12d68db43",
    mother_id: "7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e"
  },
  "bi-li": {
    birthplace: "Dujiangyan Panda Valley"
  },
  "jin-hu": {
    birthplace: "Bifengxia Base",
    father_id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    mother_id: "7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e"
  },
  "qing-shan": {
    birthplace: "Qinling Science Park",
    father_id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    mother_id: "7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e"
  },
  "xi-yue": {
    birthplace: "Chengdu Research Base",
    father_id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    mother_id: "b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df"
  },
  "yun-chuan": {
    birthplace: "Chengdu Research Base",
    father_id: "6f61fd4f-1c4d-4db0-8f10-67ea58f98f80",
    mother_id: "a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f"
  },
  "xin-bao": {
    birthplace: "Dujiangyan Panda Valley",
    father_id: "89264f73-d0e2-44e0-aad6-8d8fca58f879",
    mother_id: "53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7"
  },
  "zhen-zhen": {
    birthplace: "San Diego Zoo",
    father_id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    mother_id: "b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df"
  },
  "hua-mei": {
    birthplace: "San Diego Zoo"
  }
};

function normalizeFallbackPandaDetail(detail: FallbackPandaSeed): PandaDetail {
  const override = FALLBACK_PANDA_DETAIL_OVERRIDES[detail.slug];
  const profileOverride = FALLBACK_PANDA_PROFILE_OVERRIDES[detail.slug];
  if (!override) {
    return {
      ...detail,
      ...profileOverride,
      birthplace: profileOverride?.birthplace ?? detail.birthplace ?? null,
      identity: null,
      conclusions: [],
      sources: []
    };
  }

  return {
    ...detail,
    ...override,
    ...profileOverride,
    birthplace: profileOverride?.birthplace ?? detail.birthplace ?? null,
    tags: override.tags ?? detail.tags,
    habitats: override.habitats ?? detail.habitats,
    identity: null,
    conclusions: [],
    sources: []
  };
}

function toListItem(detail: PandaDetail): PandaListItem {
  return {
    id: detail.id,
    slug: detail.slug,
    name_zh: detail.name_zh,
    name_en: detail.name_en,
    gender: detail.gender,
    status: detail.status,
    birth_date: detail.birth_date,
    current_location: detail.current_location,
    cover_image_url: detail.cover_image_url
  };
}

const NORMALIZED_FALLBACK_PANDA_DETAILS = [
  ...FALLBACK_PANDA_DETAILS.map(normalizeFallbackPandaDetail),
  ...TRUSTED_PANDA_DETAILS
];

const FALLBACK_PANDA_LIST: PandaListItem[] = NORMALIZED_FALLBACK_PANDA_DETAILS.map(toListItem);

const FALLBACK_PANDAS: PaginatedPandasResponse = {
  items: FALLBACK_PANDA_LIST,
  meta: {
    page: 1,
    page_size: FALLBACK_PANDA_LIST.length,
    total: FALLBACK_PANDA_LIST.length
  }
};

const FALLBACK_PANDA_DETAIL_INDEX = new Map<string, PandaDetail>();
for (const item of NORMALIZED_FALLBACK_PANDA_DETAILS) {
  FALLBACK_PANDA_DETAIL_INDEX.set(item.id, item);
  FALLBACK_PANDA_DETAIL_INDEX.set(item.slug, item);
}

const FALLBACK_SNAPSHOTS: DistributionSnapshot[] = [
  { snapshot_date: "2025-09-05", version: "mock-v1", notes: "Quarterly survey" },
  { snapshot_date: "2025-12-05", version: "mock-v2", notes: "Winter update" },
  { snapshot_date: "2026-03-05", version: "mock-v3", notes: "Latest sample" }
];

const FALLBACK_DISTRIBUTION: CompleteGeoJsonFeatureCollection<DistributionFeatureProperties> = {
  type: "FeatureCollection",
  meta: {
    truncated: false,
    limit: 5000,
    requested_zoom: null
  },
  features: [
    {
      type: "Feature",
      id: "cell-001",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[[103.5, 31.2], [103.9, 31.2], [103.9, 31.6], [103.5, 31.6], [103.5, 31.2]]]]
      },
      properties: {
        layer: "wild",
        density: 14.2,
        cell_code: "QXL-001",
        snapshot_date: "2026-03-05"
      }
    },
    {
      type: "Feature",
      id: "cell-002",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[[104.2, 30.8], [104.6, 30.8], [104.6, 31.1], [104.2, 31.1], [104.2, 30.8]]]]
      },
      properties: {
        layer: "wild",
        density: 10.6,
        cell_code: "MS-004",
        snapshot_date: "2025-12-05"
      }
    },
    {
      type: "Feature",
      id: "cell-003",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[[103.2, 30.5], [103.6, 30.5], [103.6, 30.9], [103.2, 30.9], [103.2, 30.5]]]]
      },
      properties: {
        layer: "wild",
        density: 8.8,
        cell_code: "LM-011",
        snapshot_date: "2025-09-05"
      }
    },
    {
      type: "Feature",
      id: "cell-004",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[[104.6, 31.2], [104.9, 31.2], [104.9, 31.5], [104.6, 31.5], [104.6, 31.2]]]]
      },
      properties: {
        layer: "captive",
        density: 6.1,
        cell_code: "CD-010",
        snapshot_date: "2026-03-05"
      }
    }
  ]
};

const FALLBACK_HABITATS: CompleteGeoJsonFeatureCollection<HabitatFeatureProperties> = {
  type: "FeatureCollection",
  meta: {
    truncated: false,
    limit: 2000,
    requested_zoom: null
  },
  features: [
    {
      type: "Feature",
      id: "habitat-001",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[[103.2, 30.9], [104, 30.9], [104, 31.7], [103.2, 31.7], [103.2, 30.9]]]]
      },
      properties: {
        name: "岷山片区",
        province: "四川",
        level: "national"
      }
    }
  ]
};

const FALLBACK_STATS: OverviewStats = {
  total_pandas: FALLBACK_PANDA_LIST.length,
  active_habitats: 3,
  latest_snapshot_date: "2026-03-05",
  wild_distribution_cells: 2,
  featured_pandas: FALLBACK_PANDA_LIST.filter((item) => item.slug !== "wild-sample-001").length
};

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  return query.toString();
}

type ParsedBBox = [number, number, number, number];

function parseBBox(value: string): ParsedBBox | null {
  const values = value.split(",").map((item) => Number(item.trim()));
  if (
    values.length !== 4 ||
    values.some((item) => !Number.isFinite(item)) ||
    values[0] >= values[2] ||
    values[1] >= values[3]
  ) {
    return null;
  }
  return values as ParsedBBox;
}

function collectGeometryPositions(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) {
    return [];
  }
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  ) {
    return [[value[0], value[1]]];
  }
  return value.flatMap(collectGeometryPositions);
}

function geometryIntersectsBBox(coordinates: unknown, bbox: ParsedBBox | null): boolean {
  if (!bbox) {
    return true;
  }
  const positions = collectGeometryPositions(coordinates);
  if (positions.length === 0) {
    return false;
  }
  const longitudes = positions.map(([longitude]) => longitude);
  const latitudes = positions.map(([, latitude]) => latitude);
  return !(
    Math.max(...longitudes) < bbox[0] ||
    Math.min(...longitudes) > bbox[2] ||
    Math.max(...latitudes) < bbox[1] ||
    Math.min(...latitudes) > bbox[3]
  );
}

function sortDatesAsc(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function findFallbackPandaDetail(idOrSlug: string): PandaDetail | undefined {
  return FALLBACK_PANDA_DETAIL_INDEX.get(idOrSlug);
}

export interface PandaReference {
  id: string;
  slug: string;
}

function findFallbackReference(idOrSlug: string): PandaReference | null {
  const trustedReference = TRUSTED_PANDA_REFERENCES[idOrSlug];
  if (trustedReference) {
    return trustedReference;
  }

  const detail = findFallbackPandaDetail(idOrSlug);
  if (!detail) {
    return null;
  }

  return {
    id: detail.id,
    slug: detail.slug
  };
}

function findResolvedReference(idOrSlug: string, items: PandaListItem[]): PandaReference | null {
  const normalized = idOrSlug.trim();
  if (!normalized) {
    return null;
  }

  const matchedItem = items.find((item) => item.slug === normalized || item.id === normalized);
  if (matchedItem) {
    return {
      id: matchedItem.id,
      slug: matchedItem.slug
    };
  }

  return findFallbackReference(normalized);
}

function findFallbackPandaDetailForReference(
  reference: PandaReference | null | undefined,
  rawIdOrSlug?: string
): PandaDetail | undefined {
  if (reference) {
    return findFallbackPandaDetail(reference.id) ?? findFallbackPandaDetail(reference.slug);
  }

  return rawIdOrSlug ? findFallbackPandaDetail(rawIdOrSlug) : undefined;
}

class ApiRequestError extends Error {
  constructor(readonly status: number) {
    super(`Request failed with ${status}`);
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    next: { revalidate: 60 },
    ...init
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status);
  }

  return (await response.json()) as T;
}

export interface DistributionQueryOptions {
  bbox?: string;
  snapshot_date?: string;
  layer?: DistributionLayer;
  zoom?: number;
}

export interface DistributionResponse {
  data: CompleteGeoJsonFeatureCollection<DistributionFeatureProperties>;
  source: "api" | "fallback";
}

export interface HabitatQueryOptions {
  bbox?: string;
  level?: string;
}

const ATLAS_PAGE_SIZE = 100;

async function fetchPandaPage(page: number, pageSize: number): Promise<PaginatedPandasResponse> {
  const query = buildQuery({ page, page_size: pageSize });
  return fetchJson<PaginatedPandasResponse>(`/api/v1/pandas?${query}`);
}

export async function listPandas(): Promise<PaginatedPandasResponse> {
  try {
    return await fetchPandaPage(1, 20);
  } catch {
    return FALLBACK_PANDAS;
  }
}

export async function listAtlasPandas(): Promise<PaginatedPandasResponse> {
  try {
    const firstPage = await fetchPandaPage(1, ATLAS_PAGE_SIZE);
    const pageCount = Math.ceil(firstPage.meta.total / ATLAS_PAGE_SIZE);
    const additionalPages = pageCount > 1
      ? await Promise.all(
          Array.from({ length: pageCount - 1 }, (_, index) =>
            fetchPandaPage(index + 2, ATLAS_PAGE_SIZE)
          )
        )
      : [];

    const byId = new Map<string, PandaListItem>();
    for (const item of [firstPage, ...additionalPages].flatMap((page) => page.items)) {
      byId.set(item.id, item);
    }

    const items = [...byId.values()].sort((a, b) => {
      const dateCompare = (b.birth_date ?? "").localeCompare(a.birth_date ?? "");
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return a.name_zh.localeCompare(b.name_zh);
    });

    return {
      items,
      meta: {
        page: 1,
        page_size: items.length,
        total: firstPage.meta.total
      }
    };
  } catch {
    return FALLBACK_PANDAS;
  }
}

export async function resolvePandaReference(idOrSlug: string): Promise<PandaReference | null> {
  const normalized = idOrSlug.trim();
  if (!normalized) {
    return null;
  }

  const generatedReference = TRUSTED_PANDA_REFERENCES[normalized];
  if (generatedReference) {
    return generatedReference;
  }

  try {
    const detail = await fetchJson<PandaDetail>(
      `/api/v1/pandas/${encodeURIComponent(normalized)}`
    );
    return { id: detail.id, slug: detail.slug };
  } catch {
    const atlas = await listAtlasPandas();
    return findResolvedReference(normalized, atlas.items);
  }
}

export async function getPandaDetail(
  idOrSlug: string,
  reference?: PandaReference | null
): Promise<PandaDetail | null> {
  const normalized = idOrSlug.trim();
  const resolvedReference = reference ?? (normalized ? await resolvePandaReference(normalized) : null);
  const requestRef = normalized || resolvedReference?.slug || resolvedReference?.id || idOrSlug;
  const fallback = findFallbackPandaDetailForReference(resolvedReference, normalized);

  try {
    const apiDetail = await fetchJson<PandaDetail>(
      `/api/v1/pandas/${encodeURIComponent(requestRef)}`
    );
    return apiDetail;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }
    return fallback ?? null;
  }
}

function buildFallbackLineageResponse(focusId?: string): PandaLineageResponse {
  const byId = new Map(LINEAGE_PANDAS.map((item) => [item.id, item]));
  const bySlug = new Map(LINEAGE_PANDAS.map((item) => [item.slug, item]));
  const requestedFocus = focusId ? byId.get(focusId) ?? bySlug.get(focusId) : undefined;
  const resolvedFocus =
    requestedFocus ??
    bySlug.get(DEFAULT_LINEAGE_FOCUS_ID) ??
    byId.get(DEFAULT_LINEAGE_FOCUS_ID) ??
    LINEAGE_PANDAS[0];
  const resolvedFocusId =
    resolvedFocus?.id ??
    (byId.has(DEFAULT_LINEAGE_FOCUS_ID) ? DEFAULT_LINEAGE_FOCUS_ID : LINEAGE_PANDAS[0]?.id ?? "");

  const nodes = LINEAGE_PANDAS.map((item) => ({
    id: item.id,
    slug: item.slug,
    name_zh: item.name_zh,
    name_en: item.name_en,
    gender: item.gender,
    status: "unknown" as const,
    birth_date: item.birth_date,
    current_location: item.current_location,
    cover_image_url: item.avatar_url,
    intro: item.intro,
    tags: item.highlights,
    father_id: item.father_id,
    mother_id: item.mother_id
  }));

  const edges = LINEAGE_PANDAS.flatMap((item) => {
    const parents = [item.father_id, item.mother_id].filter((value): value is string => Boolean(value));
    return parents.map((parentId) => ({
      parent_id: parentId,
      child_id: item.id
    }));
  });

  return {
    focus_id: resolvedFocusId,
    nodes,
    edges,
    meta: {
      ancestor_depth: 6,
      descendant_depth: 6
    }
  };
}

export async function getPandaLineage(
  focusId?: string,
  options: { ancestorDepth?: number; descendantDepth?: number; reference?: PandaReference | null } = {}
): Promise<PandaLineageResponse> {
  const ancestorDepth = options.ancestorDepth ?? 6;
  const descendantDepth = options.descendantDepth ?? 6;
  const normalizedFocus = focusId?.trim() ?? "";

  let resolvedReference = options.reference;
  if (!resolvedReference && normalizedFocus) {
    resolvedReference = await resolvePandaReference(normalizedFocus);
  }
  if (!resolvedReference) {
    resolvedReference = await resolvePandaReference(DEFAULT_LINEAGE_FOCUS_ID);
  }
  if (!resolvedReference) {
    const atlas = await listAtlasPandas();
    resolvedReference =
      findResolvedReference(DEFAULT_LINEAGE_FOCUS_ID, atlas.items) ??
      (atlas.items[0]
        ? {
            id: atlas.items[0].id,
            slug: atlas.items[0].slug
          }
        : null);
  }

  if (!resolvedReference) {
    return buildFallbackLineageResponse(normalizedFocus || focusId);
  }

  const requestFocus = normalizedFocus || resolvedReference.slug || resolvedReference.id;

  const query = buildQuery({
    ancestor_depth: ancestorDepth,
    descendant_depth: descendantDepth
  });

  try {
    return await fetchJson<PandaLineageResponse>(
      `/api/v1/pandas/${encodeURIComponent(requestFocus)}/lineage?${query}`,
      { cache: "no-store" }
    );
  } catch {
    return buildFallbackLineageResponse(resolvedReference.slug || resolvedReference.id);
  }
}

export async function getDistributionSnapshots(limit = 24): Promise<DistributionSnapshot[]> {
  try {
    const payload = await fetchJson<DistributionSnapshotList>(`/api/v1/map/snapshots?limit=${limit}`, {
      cache: "no-store"
    });
    const latestByDate = new Map<string, DistributionSnapshot>();
    for (const item of payload.items) {
      if (!latestByDate.has(item.snapshot_date)) {
        latestByDate.set(item.snapshot_date, item);
      }
    }
    return sortDatesAsc([...latestByDate.keys()])
      .map((snapshotDate) => latestByDate.get(snapshotDate))
      .filter((item): item is DistributionSnapshot => Boolean(item));
  } catch {
    return FALLBACK_SNAPSHOTS.slice(0, limit);
  }
}

export async function getDistributionWithSource(
  options: DistributionQueryOptions = {}
): Promise<DistributionResponse> {
  const query = buildQuery({
    bbox: options.bbox ?? DEFAULT_BBOX,
    snapshot_date: options.snapshot_date,
    layer: options.layer,
    zoom: options.zoom ?? 6
  });

  try {
    return {
      data: await fetchJson<CompleteGeoJsonFeatureCollection<DistributionFeatureProperties>>(
        `/api/v1/map/distribution?${query}`,
        { cache: "no-store" }
      ),
      source: "api"
    };
  } catch {
    const fallbackBBox = parseBBox(options.bbox ?? DEFAULT_BBOX);
    const filtered = FALLBACK_DISTRIBUTION.features.filter((feature) => {
      if (!geometryIntersectsBBox(feature.geometry.coordinates, fallbackBBox)) {
        return false;
      }
      if (options.layer && feature.properties.layer !== options.layer) {
        return false;
      }
      if (options.snapshot_date && feature.properties.snapshot_date !== options.snapshot_date) {
        return false;
      }
      return true;
    });
    return {
      data: {
        type: "FeatureCollection",
        features: filtered,
        meta: {
          ...FALLBACK_DISTRIBUTION.meta,
          requested_zoom: options.zoom ?? null
        }
      },
      source: "fallback"
    };
  }
}

export async function getDistribution(
  options: DistributionQueryOptions = {}
): Promise<CompleteGeoJsonFeatureCollection<DistributionFeatureProperties>> {
  const result = await getDistributionWithSource(options);
  return result.data;
}

export async function getHabitats(
  options: HabitatQueryOptions = {}
): Promise<CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>> {
  const query = buildQuery({
    bbox: options.bbox ?? DEFAULT_BBOX,
    level: options.level
  });

  try {
    return await fetchJson<CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>>(
      `/api/v1/map/habitats?${query}`,
      { cache: "no-store" }
    );
  } catch {
    const fallbackBBox = parseBBox(options.bbox ?? DEFAULT_BBOX);
    return {
      ...FALLBACK_HABITATS,
      features: FALLBACK_HABITATS.features.filter(
        (feature) =>
          geometryIntersectsBBox(feature.geometry.coordinates, fallbackBBox) &&
          (!options.level || feature.properties.level === options.level)
      )
    };
  }
}

export async function getOverviewStats(): Promise<OverviewStats> {
  try {
    return await fetchJson<OverviewStats>("/api/v1/stats/overview", { cache: "no-store" });
  } catch {
    return FALLBACK_STATS;
  }
}
