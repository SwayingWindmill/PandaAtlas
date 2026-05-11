import type {
  AtlasChangeEntry,
  AtlasInstitutionTypeFilter,
  AtlasItem,
  AtlasMode,
  AtlasModeMeta,
  AtlasRegionFilter,
  AtlasStatusFilter
} from "@/lib/panda-atlas";
import { ATLAS_INSTITUTIONS, ATLAS_MODES } from "@/lib/panda-atlas";
import type {
  DistributionFeatureProperties,
  DistributionSnapshot,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  HabitatFeatureProperties,
  OverviewStats
} from "@/lib/types";

export interface ModeMetric {
  label: string;
  value: string;
  note: string;
}

export interface SummaryBarItem {
  label: string;
  value: string;
  hint: string;
  tone: "wild" | "domestic" | "overseas" | "muted";
}

export const REGION_OPTIONS: Array<{ value: AtlasRegionFilter; label: string }> = [
  { value: "all", label: "全部区域" },
  { value: "china", label: "中国" },
  { value: "overseas", label: "海外" }
];

export const STATUS_OPTIONS: Array<{ value: AtlasStatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "wild", label: "野生" },
  { value: "captive", label: "圈养" }
];

export const TYPE_OPTIONS: Array<{ value: AtlasInstitutionTypeFilter; label: string }> = [
  { value: "all", label: "全部类型" },
  { value: "reserve", label: "保护地" },
  { value: "breeding_base", label: "繁育基地" },
  { value: "zoo", label: "动物园" },
  { value: "research_center", label: "研究机构" }
];

const fullDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit"
});

const numberFormatter = new Intl.NumberFormat("zh-CN");

function uniqueSortedSnapshotDates(values: Array<string | null | undefined>): string[] {
  const snapshotDates = new Set<string>();

  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      snapshotDates.add(value);
    }
  }

  return [...snapshotDates].sort((left, right) => left.localeCompare(right));
}

function collectDistributionSnapshotDates(
  featureCollection: GeoJsonFeatureCollection<DistributionFeatureProperties>
): string[] {
  return uniqueSortedSnapshotDates(
    featureCollection.features.map((feature) =>
      typeof feature.properties.snapshot_date === "string" ? feature.properties.snapshot_date : null
    )
  );
}

export function formatDateLabel(value: string | null | undefined): string {
  if (!value) {
    return "待更新";
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return fullDateFormatter.format(date);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return shortDateFormatter.format(date);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function buildAvailableSnapshotDates(
  snapshots: DistributionSnapshot[],
  distribution: GeoJsonFeatureCollection<DistributionFeatureProperties>,
  latestSnapshotDate?: string | null
): string[] {
  return uniqueSortedSnapshotDates([
    ...snapshots.map((item) => item.snapshot_date),
    ...collectDistributionSnapshotDates(distribution),
    latestSnapshotDate
  ]);
}

export function resolveInitialSnapshotDate(
  snapshots: DistributionSnapshot[],
  distribution: GeoJsonFeatureCollection<DistributionFeatureProperties>,
  latestSnapshotDate?: string | null
): string {
  const distributionDates = collectDistributionSnapshotDates(distribution);
  const snapshotDates = uniqueSortedSnapshotDates(snapshots.map((item) => item.snapshot_date));

  return (
    distributionDates[distributionDates.length - 1] ??
    snapshotDates[snapshotDates.length - 1] ??
    latestSnapshotDate ??
    ""
  );
}

export function filterDistributionBySnapshot(
  distribution: GeoJsonFeatureCollection<DistributionFeatureProperties>,
  snapshotDate: string
): GeoJsonFeatureCollection<DistributionFeatureProperties> {
  if (!snapshotDate) {
    return distribution;
  }

  return {
    ...distribution,
    features: distribution.features.filter((feature) => feature.properties.snapshot_date === snapshotDate)
  };
}

export function getModeMeta(mode: AtlasMode): AtlasModeMeta {
  return ATLAS_MODES.find((item) => item.value === mode) ?? ATLAS_MODES[0]!;
}

export function atlasModeLabel(mode: AtlasMode): string {
  return getModeMeta(mode).label;
}

export function atlasViewLabel(mode: AtlasMode): string {
  switch (mode) {
    case "china_wild":
      return "中国野生模式";
    case "china_captive":
      return "中国圈养模式";
    case "overseas_captive":
      return "海外圈养模式";
    default:
      return "全球总览模式";
  }
}

export function modeSurfaceHint(mode: AtlasMode): string {
  switch (mode) {
    case "china_wild":
      return "面状分布";
    case "china_captive":
      return "国内节点";
    case "overseas_captive":
      return "海外节点";
    default:
      return "野生核心 + 国内 + 海外";
  }
}

export function modeNarrative(mode: AtlasMode): string {
  switch (mode) {
    case "china_wild":
      return "以山地森林与保护地为线索，阅读大熊猫野生分布的空间结构。";
    case "china_captive":
      return "以基地、动物园与研究机构为节点，理解国内圈养与保育网络。";
    case "overseas_captive":
      return "按国家与城市观察海外驻留与国际合作网络。";
    default:
      return "在一张地图里并置中国野生核心、国内保育机构与海外合作节点。";
  }
}

export function itemLocationLabel(item: AtlasItem): string {
  return [item.province, item.country, item.city].filter(Boolean).join(" / ");
}

export function itemStatusLabel(item: AtlasItem): string {
  if (item.kind === "wild_region") {
    return "野生核心分布";
  }

  if (item.region === "overseas") {
    return "海外合作驻留";
  }

  return "国内圈养保育";
}

export function detailTypeLabel(item: AtlasItem): string {
  if (item.kind === "wild_region") {
    return "野生分布区";
  }

  if (item.region === "overseas") {
    return "海外合作机构";
  }

  return "国内圈养机构";
}

export function itemTone(item: AtlasItem): "wild" | "domestic" | "overseas" {
  if (item.kind === "wild_region") {
    return "wild";
  }

  return item.region === "china" ? "domestic" : "overseas";
}

export function itemBadgeClass(item: AtlasItem): string {
  switch (itemTone(item)) {
    case "wild":
      return "border-[#A9C4A8] bg-[#EBF3E8] text-[#2F6B3B]";
    case "domestic":
      return "border-[#E6C39B] bg-[#F8EAD9] text-[#A8692C]";
    case "overseas":
      return "border-[#C4D5F0] bg-[#EAF1FA] text-[#3F6FAE]";
  }
}

export function detailFacts(item: AtlasItem, snapshotDate: string): ModeMetric[] {
  if (item.kind === "wild_region") {
    return [
      { label: "保护地类型", value: item.badge, note: "用于区分核心分布与保护地关系" },
      {
        label: "区域范围",
        value: item.province ?? "中国山地森林系统",
        note: "建议结合地图与快照继续阅读"
      },
      {
        label: "生态特征",
        value: item.tags.join(" / "),
        note: item.note ?? "山地森林中的野生分布对象"
      },
      { label: "当前快照", value: formatDateLabel(snapshotDate), note: "地图与时间轴联动日期" }
    ];
  }

  if (item.region === "overseas") {
    return [
      { label: "合作属性", value: item.kindLabel, note: "国际合作与驻留节点" },
      { label: "国家 / 城市", value: `${item.country} / ${item.city}`, note: "空间定位" },
      { label: "最近更新", value: formatDateLabel(item.updatedAt), note: "机构名录更新时间" },
      {
        label: "关键标签",
        value: item.tags.join(" / "),
        note: item.note ?? "适合结合最近变化继续阅读"
      }
    ];
  }

  return [
    { label: "机构类型", value: item.kindLabel, note: "国内圈养与保育网络" },
    { label: "所在城市", value: `${item.province ?? item.country} / ${item.city}`, note: "空间定位" },
    { label: "最近更新", value: formatDateLabel(item.updatedAt), note: "机构名录更新时间" },
    {
      label: "关键标签",
      value: item.tags.join(" / "),
      note: item.note ?? "可继续查看关联个体与时间变化"
    }
  ];
}

export function buildModeMetrics(
  mode: AtlasMode,
  overviewStats: OverviewStats,
  wildRegionCount: number,
  domesticCount: number,
  overseasCount: number,
  totalWildRegions: number,
  snapshotDate: string
): ModeMetric[] {
  const countryCount = new Set(
    ATLAS_INSTITUTIONS.filter((item) => item.region === "overseas").map((item) => item.country)
  ).size;

  switch (mode) {
    case "china_wild":
      return [
        {
          label: "野生片区",
          value: String(Math.max(wildRegionCount, totalWildRegions, 1)),
          note: "当前可读区域"
        },
        {
          label: "野生个体估算",
          value: formatNumber(Math.max(overviewStats.total_pandas, 1864)),
          note: "全国尺度"
        },
        {
          label: "当前快照",
          value: formatDateLabel(snapshotDate),
          note: "地图时间"
        }
      ];
    case "china_captive":
      return [
        { label: "国内机构", value: String(domesticCount), note: "当前筛选命中" },
        {
          label: "繁育基地",
          value: String(ATLAS_INSTITUTIONS.filter((item) => item.region === "china" && item.kind === "breeding_base").length),
          note: "基地与救护节点"
        },
        { label: "当前快照", value: formatDateLabel(snapshotDate), note: "地图时间" }
      ];
    case "overseas_captive":
      return [
        { label: "海外机构", value: String(overseasCount), note: "当前筛选命中" },
        { label: "覆盖国家", value: String(countryCount), note: "国际合作范围" },
        { label: "当前快照", value: formatDateLabel(snapshotDate), note: "地图时间" }
      ];
    default:
      return [
        {
          label: "野生片区",
          value: String(Math.max(wildRegionCount, totalWildRegions, 1)),
          note: "自然分布核心"
        },
        { label: "国内机构", value: String(domesticCount), note: "圈养与保育网络" },
        { label: "海外机构", value: String(overseasCount), note: "国际合作网络" }
      ];
  }
}

export function buildSummaryBarItems(
  mode: AtlasMode,
  wildRegionCount: number,
  domesticCount: number,
  overseasCount: number,
  snapshotDate: string
): SummaryBarItem[] {
  switch (mode) {
    case "china_wild":
      return [
        { label: "野生", value: String(wildRegionCount), hint: "自然分布核心", tone: "wild" },
        { label: "快照", value: formatShortDate(snapshotDate), hint: "当前地图时间", tone: "muted" },
        { label: "模式", value: "中国野生", hint: "面状分布阅读", tone: "wild" }
      ];
    case "china_captive":
      return [
        { label: "国内", value: String(domesticCount), hint: "圈养与保育机构", tone: "domestic" },
        { label: "快照", value: formatShortDate(snapshotDate), hint: "当前地图时间", tone: "muted" },
        { label: "模式", value: "中国圈养", hint: "国内机构网络", tone: "domestic" }
      ];
    case "overseas_captive":
      return [
        { label: "海外", value: String(overseasCount), hint: "国际合作机构", tone: "overseas" },
        { label: "快照", value: formatShortDate(snapshotDate), hint: "当前地图时间", tone: "muted" },
        { label: "模式", value: "海外圈养", hint: "全球合作节点", tone: "overseas" }
      ];
    default:
      return [
        { label: "野生", value: String(wildRegionCount), hint: "自然分布核心", tone: "wild" },
        { label: "国内", value: String(domesticCount), hint: "圈养与保育机构", tone: "domestic" },
        { label: "海外", value: String(overseasCount), hint: "国际合作机构", tone: "overseas" }
      ];
  }
}

export function matchesRegion(item: AtlasItem, regionFilter: AtlasRegionFilter): boolean {
  return regionFilter === "all" ? true : item.region === regionFilter;
}

export function matchesStatus(item: AtlasItem, statusFilter: AtlasStatusFilter): boolean {
  return statusFilter === "all" ? true : item.status === statusFilter;
}

export function matchesType(item: AtlasItem, typeFilter: AtlasInstitutionTypeFilter): boolean {
  if (typeFilter === "all") {
    return true;
  }

  if (item.kind === "wild_region") {
    return typeFilter === "reserve";
  }

  return item.kind === typeFilter;
}

export function matchesSearch(item: AtlasItem, query: string): boolean {
  if (!query.trim()) {
    return true;
  }

  const haystack = [
    item.name,
    item.kindLabel,
    item.country,
    item.city,
    item.province ?? "",
    item.description,
    item.badge,
    item.note ?? "",
    ...item.tags
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.trim().toLowerCase());
}

export function closestSnapshotDate(targetDate: string, dates: string[]): string | null {
  if (dates.length === 0) {
    return null;
  }

  const orderedDates = [...dates].sort((left, right) => left.localeCompare(right));
  let fallback = orderedDates[0] ?? null;

  for (const current of orderedDates) {
    if (current <= targetDate) {
      fallback = current;
      continue;
    }

    break;
  }

  return fallback;
}

export function collectCoordinatePairs(value: unknown, pairs: Array<[number, number]>) {
  if (!Array.isArray(value)) {
    return;
  }

  if (value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    pairs.push([value[0], value[1]]);
    return;
  }

  for (const item of value) {
    collectCoordinatePairs(item, pairs);
  }
}

export function geometryToBounds(
  geometry: { coordinates: unknown } | null | undefined
): [[number, number], [number, number]] | null {
  if (!geometry) {
    return null;
  }

  const pairs: Array<[number, number]> = [];
  collectCoordinatePairs(geometry.coordinates, pairs);

  if (pairs.length === 0) {
    return null;
  }

  const lngs = pairs.map((item) => item[0]);
  const lats = pairs.map((item) => item[1]);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ];
}

export function geometryToCenter(geometry: { coordinates: unknown } | null | undefined): [number, number] {
  const bounds = geometryToBounds(geometry);

  if (!bounds) {
    return [104.5, 31.2];
  }

  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

export function buildHabitatFeatureCollection(
  habitats: GeoJsonFeatureCollection<HabitatFeatureProperties>
): GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }> {
  return {
    type: "FeatureCollection",
    features: habitats.features.map((feature, index) => {
      const atlasId = `wild-region:${String(feature.id ?? index + 1)}`;
      return {
        ...feature,
        id: atlasId,
        properties: {
          ...feature.properties,
          atlas_id: atlasId
        }
      };
    })
  };
}

export function filterVisibleHabitats(
  habitats: GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }>,
  visibleItems: AtlasItem[]
): GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }> {
  const visibleWildIds = new Set(
    visibleItems.filter((item) => item.kind === "wild_region").map((item) => item.id)
  );

  return {
    ...habitats,
    features: habitats.features.filter((feature) => visibleWildIds.has(feature.properties.atlas_id))
  };
}

export function buildHabitatItems(
  habitats: GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }>,
  snapshotDate: string
): AtlasItem[] {
  if (habitats.features.length === 0) {
    return [
      {
        id: "wild-region:fallback",
        name: "中国野生核心分布区",
        kind: "wild_region",
        kindLabel: "野生分布区",
        region: "china",
        status: "wild",
        country: "中国",
        city: "山地森林系统",
        coordinates: [104.5, 31.2],
        description: "用于在缺少完整矢量时维持中国野生模式的阅读框架，帮助用户理解自然分布核心仍位于中国山地森林系统。",
        updatedAt: snapshotDate,
        badge: "野生分布",
        detailHref: "/atlas",
        mode: "china_wild",
        featured: true,
        tags: ["野生", "保护地", "山地森林"],
        note: "点击后可继续通过右侧抽屉阅读当前区域"
      }
    ];
  }

  return habitats.features.map((feature, index) => {
    const name =
      typeof feature.properties.name === "string" && feature.properties.name.trim().length > 0
        ? feature.properties.name
        : `野生分布区 ${index + 1}`;

    const province =
      typeof feature.properties.province === "string" && feature.properties.province.trim().length > 0
        ? feature.properties.province
        : undefined;

    const level =
      typeof feature.properties.level === "string" && feature.properties.level.trim().length > 0
        ? feature.properties.level
        : "core";

    return {
      id: feature.properties.atlas_id,
      name,
      kind: "wild_region",
      kindLabel: "野生分布区",
      region: "china",
      status: "wild",
      country: "中国",
      city: province ?? "中国山地森林",
      province,
      coordinates: geometryToCenter(feature.geometry),
      description: `${name}${province ? ` 位于 ${province}` : ""}，适合结合保护地网络和时间快照继续阅读野生分布结构。`,
      updatedAt: snapshotDate,
      badge: level === "national" ? "国家级保护地" : "野生分布",
      detailHref: "/atlas",
      mode: "china_wild",
      featured: index === 0,
      tags: ["野生", province ?? "中国", level === "national" ? "国家级" : "核心区"],
      note: "建议继续查看时间轴中的快照变化"
    };
  });
}

export function buildPointFeatureCollection(items: AtlasItem[]): GeoJsonFeatureCollection<Record<string, unknown>> {
  return {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      id: item.id,
      geometry: {
        type: "Point",
        coordinates: item.coordinates
      },
      properties: {
        atlas_id: item.id,
        name: item.name,
        kind: item.kind,
        kind_label: item.kindLabel,
        region: item.region,
        featured: item.featured ? 1 : 0
      }
    }))
  };
}

export function buildSelectedPointCollection(
  selectedItem: AtlasItem | null
): GeoJsonFeatureCollection<Record<string, unknown>> {
  if (!selectedItem || selectedItem.kind === "wild_region") {
    return { type: "FeatureCollection", features: [] };
  }

  return buildPointFeatureCollection([selectedItem]);
}

export function buildSelectedRegionCollection(
  selectedItem: AtlasItem | null,
  habitatById: Map<string, GeoJsonFeature<HabitatFeatureProperties & { atlas_id: string }>>
): GeoJsonFeatureCollection<Record<string, unknown>> {
  if (!selectedItem || selectedItem.kind !== "wild_region") {
    return { type: "FeatureCollection", features: [] };
  }

  const region = habitatById.get(selectedItem.id);
  if (!region) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        ...region,
        properties: {
          ...region.properties,
          selected: true
        }
      }
    ]
  };
}

export function buildNetworkFeatureCollection(
  mode: AtlasMode,
  domesticItems: AtlasItem[],
  overseasItems: AtlasItem[]
): GeoJsonFeatureCollection<Record<string, unknown>> {
  const anchor =
    domesticItems.find((item) => item.id === "inst-chengdu-base") ??
    domesticItems.find((item) => item.featured) ??
    domesticItems[0] ??
    ATLAS_INSTITUTIONS.find((item) => item.id === "inst-chengdu-base") ??
    null;

  if (!anchor) {
    return { type: "FeatureCollection", features: [] };
  }

  const features: GeoJsonFeature<Record<string, unknown>>[] = [];

  const pushLine = (item: AtlasItem, tone: "domestic" | "overseas") => {
    features.push({
      type: "Feature",
      id: `network:${anchor.id}:${item.id}`,
      geometry: {
        type: "LineString",
        coordinates: [anchor.coordinates, item.coordinates]
      },
      properties: {
        atlas_id: item.id,
        tone
      }
    });
  };

  if (mode === "global") {
    domesticItems
      .filter((item) => item.id !== anchor.id && item.featured)
      .forEach((item) => pushLine(item, "domestic"));
    overseasItems.forEach((item) => pushLine(item, "overseas"));
  }

  if (mode === "china_captive") {
    domesticItems
      .filter((item) => item.id !== anchor.id)
      .forEach((item) => pushLine(item, "domestic"));
  }

  if (mode === "overseas_captive") {
    overseasItems.forEach((item) => pushLine(item, "overseas"));
  }

  return {
    type: "FeatureCollection",
    features
  };
}

export function selectedEntityHint(item: AtlasItem | null): { title: string; body: string } {
  if (!item) {
    return {
      title: "尚未选中对象",
      body: "点击地图中的野生分布区或机构节点，右侧将以抽屉方式展开对象详情。"
    };
  }

  return {
    title: `${item.name} 已在右侧展开`,
    body: "左侧保留模式与索引信息；完整说明、属性和动作入口都放在右侧对象抽屉中。"
  };
}

export function changeTone(change: AtlasChangeEntry): "wild" | "domestic" | "overseas" {
  switch (change.mode) {
    case "china_wild":
      return "wild";
    case "china_captive":
      return "domestic";
    case "overseas_captive":
      return "overseas";
    default:
      return "wild";
  }
}
