"use client";

import Link from "next/link";
import {
  startTransition,
  type CSSProperties,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap
} from "maplibre-gl";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Database,
  FileText,
  Globe2,
  LocateFixed,
  Minus,
  PlaneTakeoff,
  Plus,
  Search,
  Trees,
  X
} from "lucide-react";
import { SiteHeader, siteShellClassName } from "@/components/site/site-header";
import { getDistribution } from "@/lib/api-client";
import {
  ATLAS_DATA_SOURCE,
  ATLAS_DATA_STATUS,
  ATLAS_EXTENSION_CARDS,
  ATLAS_INSTITUTIONS,
  ATLAS_MODES,
  ATLAS_SEARCH_PLACEHOLDER,
  ATLAS_TIMELINE_CHANGES,
  type AtlasChangeEntry,
  type AtlasInstitutionTypeFilter,
  type AtlasItem,
  type AtlasMode,
  type AtlasRegionFilter,
  type AtlasStatusFilter
} from "@/lib/panda-atlas";
import type {
  DistributionFeatureProperties,
  DistributionLayer,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  HabitatFeatureProperties,
  OverviewStats
} from "@/lib/types";
import type { Route } from "next";

interface PandaAtlasExplorerProps {
  initialDistribution: GeoJsonFeatureCollection<DistributionFeatureProperties>;
  initialHabitats: GeoJsonFeatureCollection<HabitatFeatureProperties>;
  initialStats: OverviewStats;
  defaultBBox: string;
  initialSnapshotDate: string;
  availableSnapshotDates: string[];
  initialPandas: AtlasPandaSearchEntry[];
}

interface HoverCard {
  x: number;
  y: number;
  title: string;
  subtitle: string;
}

interface AtlasPandaSearchEntry {
  id: string;
  slug: string;
  name: string;
  location: string;
  href: string;
  badge: string;
  summary: string;
  searchText: string;
}

type SearchSuggestionGroup = "region" | "institution" | "panda" | "location";

interface SearchSuggestion {
  id: string;
  group: SearchSuggestionGroup;
  title: string;
  subtitle: string;
  badge: string;
  atlasItem?: AtlasItem;
  panda?: AtlasPandaSearchEntry;
  queryValue?: string;
}

interface StatsBarItem {
  label: string;
  value: string;
  hint: string;
  tone: "wild" | "domestic" | "overseas" | "time" | "mode";
}

const shellClassName = siteShellClassName;

const themeVars = {
  "--atlas-shell": "#f7f6f2",
  "--atlas-ink": "#233126",
  "--atlas-muted": "#6d7c6e",
  "--atlas-line": "rgba(63,125,72,0.1)",
  "--atlas-panel": "rgba(250,248,243,0.92)",
  "--atlas-green": "#3f7d47",
  "--atlas-green-deep": "#284f34",
  "--atlas-green-soft": "rgba(63,125,71,0.1)",
  "--atlas-orange": "#c98747",
  "--atlas-orange-soft": "rgba(201,135,71,0.14)",
  "--atlas-blue": "#4e86d8",
  "--atlas-blue-soft": "#d9e2e8",
  "--atlas-shadow": "0 24px 54px rgba(31, 48, 32, 0.12)"
} as CSSProperties;

const REGION_OPTIONS: Array<{ value: AtlasRegionFilter; label: string }> = [
  { value: "all", label: "全部区域" },
  { value: "china", label: "中国" },
  { value: "overseas", label: "海外" }
];

const STATUS_OPTIONS: Array<{ value: AtlasStatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "wild", label: "野生" },
  { value: "captive", label: "圈养" }
];

const TYPE_OPTIONS: Array<{ value: AtlasInstitutionTypeFilter; label: string }> = [
  { value: "all", label: "全部类型" },
  { value: "breeding_base", label: "基地" },
  { value: "zoo", label: "动物园" },
  { value: "research_center", label: "研究机构" },
  { value: "reserve", label: "保护地" }
];

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const monthDayFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit"
});

const numberFormatter = new Intl.NumberFormat("zh-CN");

const EMPTY_FEATURES: GeoJsonFeatureCollection<Record<string, unknown>> = {
  type: "FeatureCollection",
  features: []
};

const WILD_FILL: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["coalesce", ["to-number", ["get", "density"]], 0],
  0,
  "#e8f0e4",
  4,
  "#c8ddc0",
  8,
  "#8fb287",
  14,
  "#4e7b59"
];

const CAPTIVE_FILL: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["coalesce", ["to-number", ["get", "density"]], 0],
  0,
  "#f7ebda",
  3,
  "#efcfab",
  6,
  "#d8924b",
  10,
  "#b96f26"
];

function tileUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png";
}

function tileAttribution(): string {
  return "(c) OpenStreetMap contributors (c) CARTO";
}

function asGeoJsonData<TProperties extends Record<string, unknown>>(
  featureCollection: GeoJsonFeatureCollection<TProperties>
): FeatureCollection<Geometry, GeoJsonProperties> {
  return featureCollection as unknown as FeatureCollection<Geometry, GeoJsonProperties>;
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) {
    return "待更新";
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatMonthDayLabel(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return monthDayFormatter.format(date);
}

function collectCoordinatePairs(value: unknown, pairs: Array<[number, number]>) {
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

function geometryToBounds(
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

  const lngs = pairs.map((pair) => pair[0]);
  const lats = pairs.map((pair) => pair[1]);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ];
}

function geometryToCenter(geometry: { coordinates: unknown } | null | undefined): [number, number] {
  const bounds = geometryToBounds(geometry);
  if (!bounds) {
    return [104.5, 31.2];
  }

  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

function buildHabitatFeatureCollection(
  habitats: GeoJsonFeatureCollection<HabitatFeatureProperties>
): GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }> {
  return {
    type: "FeatureCollection",
    features: habitats.features.map((feature, index) => {
      const id = `habitat:${String(feature.id ?? `item-${index + 1}`)}`;

      return {
        ...feature,
        id,
        properties: {
          ...feature.properties,
          atlas_id: id
        }
      };
    })
  };
}

function buildHabitatItems(
  habitats: GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }>,
  latestSnapshot: string
): AtlasItem[] {
  if (habitats.features.length === 0) {
    return [
      {
        id: "habitat:fallback",
        name: "中国野生分布核心区",
        kind: "wild_region",
        kindLabel: "核心分布区",
        region: "china",
        status: "wild",
        country: "中国",
        city: "山地森林系统",
        coordinates: [104.2, 31.1],
        description: "用于在地图缺少完整数据时维持中国野生分布模式的阅读框架。",
        updatedAt: latestSnapshot,
        badge: "野生分布",
        detailHref: "/atlas",
        mode: "china_wild",
        featured: true,
        tags: ["野生", "保护地", "山地森林"],
        note: "演示级野生分布占位对象"
      }
    ];
  }

  return habitats.features.map((feature, index) => {
    const name =
      typeof feature.properties.name === "string" && feature.properties.name.length > 0
        ? feature.properties.name
        : `野生分布区 ${index + 1}`;

    const province =
      typeof feature.properties.province === "string" && feature.properties.province.length > 0
        ? feature.properties.province
        : undefined;

    const level =
      typeof feature.properties.level === "string" && feature.properties.level.length > 0
        ? feature.properties.level
        : "core";

    return {
      id: feature.properties.atlas_id,
      name,
      kind: "wild_region",
      kindLabel: "核心分布区",
      region: "china",
      status: "wild",
      country: "中国",
      city: province ?? "中国山地森林",
      province,
      coordinates: geometryToCenter(feature.geometry),
      description: `${name}${province ? ` 位于 ${province}` : ""}，适合在当前视图中阅读分布格局与保护地关联。`,
      updatedAt: latestSnapshot,
      badge: level === "national" ? "国家级保护地" : "野生分布",
      detailHref: "/atlas",
      mode: "china_wild",
      featured: index === 0,
      tags: ["野生", province ?? "中国", level === "national" ? "国家级" : "核心区"],
      note: "点选后可聚焦当前区域"
    };
  });
}

function buildPointCollection(items: AtlasItem[]): GeoJsonFeatureCollection<Record<string, unknown>> {
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
        country: item.country,
        city: item.city,
        featured: item.featured ? 1 : 0
      }
    }))
  };
}

function buildSelectionCollection(
  selectedItem: AtlasItem | null,
  habitatById: Map<string, GeoJsonFeature<HabitatFeatureProperties & { atlas_id: string }>>
): GeoJsonFeatureCollection<Record<string, unknown>> {
  if (!selectedItem) {
    return EMPTY_FEATURES;
  }

  if (selectedItem.kind === "wild_region") {
    const habitat = habitatById.get(selectedItem.id);
    if (!habitat) {
      return EMPTY_FEATURES;
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          ...habitat,
          properties: {
            ...habitat.properties,
            selected: true
          }
        }
      ]
    };
  }

  return buildPointCollection([selectedItem]);
}

function matchesSearch(item: AtlasItem, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    item.name,
    item.kindLabel,
    item.country,
    item.city,
    item.province ?? "",
    item.description,
    item.note ?? "",
    item.badge,
    ...item.tags
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function matchesType(item: AtlasItem, type: AtlasInstitutionTypeFilter): boolean {
  if (type === "all") {
    return true;
  }

  if (item.kind === "wild_region") {
    return type === "reserve";
  }

  return item.kind === type;
}

function modeForItem(item: AtlasItem): AtlasMode {
  return item.mode;
}

function matchesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

function itemChipClass(item: AtlasItem): string {
  if (item.kind === "wild_region") {
    return "bg-[rgba(47,107,59,0.08)] text-[var(--atlas-green-deep)]";
  }

  if (item.region === "overseas") {
    return "bg-[var(--atlas-blue-soft)] text-[var(--atlas-blue)]";
  }

  return "bg-[var(--atlas-orange-soft)] text-[var(--atlas-orange)]";
}

function atlasModeLabel(mode: AtlasMode): string {
  return ATLAS_MODES.find((item) => item.value === mode)?.label ?? "地图视图";
}

function itemLocationLabel(item: AtlasItem): string {
  const area = item.province ?? (item.region === "china" ? "中国区域" : "海外");
  return [area, item.country, item.city].filter((value) => value.length > 0).join(" / ");
}

function itemStatusLabel(item: AtlasItem): string {
  if (item.kind === "wild_region") {
    return "野生核心分布";
  }

  if (item.region === "overseas") {
    return "海外合作驻留";
  }

  return "国内圈养保育";
}

function selectedItemSectionLabel(item: AtlasItem): string {
  if (item.kind === "wild_region") {
    return "当前选中野生区域";
  }

  if (item.region === "overseas") {
    return "当前选中海外机构";
  }

  return "当前选中国内机构";
}

function detailItemTypeLabel(item: AtlasItem): string {
  if (item.kind === "wild_region") {
    return "野生分布区";
  }

  if (item.region === "overseas") {
    return "海外合作机构";
  }

  return "国内圈养机构";
}

function detailKeyFacts(item: AtlasItem): Array<{ label: string; value: string }> {
  if (item.kind === "wild_region") {
    return [
      { label: "保护地类型", value: item.badge },
      { label: "区域范围", value: item.province ?? "中国山地森林" },
      { label: "生态特征", value: item.tags.slice(0, 3).join(" / ") || "山地森林 / 竹林 / 栖息地网络" },
      { label: "保护说明", value: item.note ?? "当前区域适合继续下钻保护地与栖息地阅读。" }
    ];
  }

  if (item.region === "overseas") {
    return [
      { label: "国家 / 城市", value: `${item.country} / ${item.city}` },
      { label: "当前驻留状态", value: itemStatusLabel(item) },
      { label: "合作属性", value: item.tags.slice(0, 3).join(" / ") || "国际合作 / 驻留 / 展示" },
      { label: "最近更新时间", value: formatDateLabel(item.updatedAt) }
    ];
  }

  return [
    { label: "机构类型", value: item.kindLabel },
    { label: "所在城市", value: `${item.province ?? item.country} / ${item.city}` },
    { label: "功能定位", value: item.tags.slice(0, 3).join(" / ") || "繁育 / 研究 / 展示" },
    { label: "当前状态", value: itemStatusLabel(item) }
  ];
}

function sidebarModeSummary(mode: AtlasMode): string {
  switch (mode) {
    case "china_wild":
      return "以中国野生分布区为主，重点阅读山系与保护地。";
    case "china_captive":
      return "以国内圈养与保育机构为主，查看基地、动物园与研究节点。";
    case "overseas_captive":
      return "以海外圈养机构为主，按国家与城市读取国际合作网络。";
    default:
      return "先看中国野生核心，再读国内与海外机构网络。";
  }
}

function modeSwitcherHint(mode: AtlasMode): string {
  switch (mode) {
    case "china_wild":
      return "野生面状分布";
    case "china_captive":
      return "国内圈养网络";
    case "overseas_captive":
      return "海外合作节点";
    default:
      return "野生 + 国内 + 海外";
  }
}

function statsBarDotClass(tone: StatsBarItem["tone"]): string {
  switch (tone) {
    case "wild":
      return "bg-[var(--atlas-green-deep)]";
    case "domestic":
      return "bg-[var(--atlas-orange)]";
    case "overseas":
      return "bg-[var(--atlas-blue)]";
    default:
      return "bg-[rgba(58,68,60,0.42)]";
  }
}

function latestDate(items: AtlasItem[]): string | null {
  const values = items.map((item) => item.updatedAt).sort((a, b) => a.localeCompare(b));
  return values[values.length - 1] ?? null;
}

function closestSnapshotDate(targetDate: string, dates: string[]): string | null {
  if (dates.length === 0) {
    return null;
  }

  const sortedDates = [...dates].sort((a, b) => a.localeCompare(b));
  let fallback = sortedDates[0] ?? null;

  for (const value of sortedDates) {
    if (value <= targetDate) {
      fallback = value;
      continue;
    }
    break;
  }

  return fallback;
}

function metricCards(
  mode: AtlasMode,
  stats: OverviewStats,
  visibleWildCount: number,
  domesticCount: number,
  overseasCount: number,
  totalWildRegions: number,
  selectedSnapshotDate: string
) {
  const wildPopulation = stats.total_pandas >= 100 ? stats.total_pandas : 1864;
  const countryCount = new Set(
    ATLAS_INSTITUTIONS.filter((item) => item.region === "overseas").map((item) => item.country)
  ).size;
  const domesticBaseCount = ATLAS_INSTITUTIONS.filter((item) => item.kind === "breeding_base").length;
  const featuredOverseas = ATLAS_INSTITUTIONS.filter((item) => item.region === "overseas" && item.featured).length;

  switch (mode) {
    case "china_wild":
      return [
        { label: "野生个体", value: numberFormatter.format(wildPopulation), hint: "自然分布核心" },
        { label: "核心片区", value: String(Math.max(totalWildRegions, visibleWildCount, 1)), hint: "点选后可下钻" },
        { label: "最近快照", value: formatMonthDayLabel(selectedSnapshotDate), hint: "时间入口" }
      ];
    case "china_captive":
      return [
        { label: "国内机构", value: String(domesticCount), hint: "当前筛选命中" },
        { label: "重点基地", value: String(domesticBaseCount), hint: "繁育与救护" },
        { label: "最近快照", value: formatMonthDayLabel(selectedSnapshotDate), hint: "状态更新" }
      ];
    case "overseas_captive":
      return [
        { label: "合作机构", value: String(overseasCount), hint: "当前筛选命中" },
        { label: "覆盖国家", value: String(countryCount), hint: "国际网络" },
        { label: "重点节点", value: String(featuredOverseas), hint: "长期合作" }
      ];
    default:
      return [
        { label: "野生大熊猫", value: numberFormatter.format(wildPopulation), hint: "自然分布核心" },
        { label: "合作机构", value: String(domesticCount + overseasCount), hint: "圈养与合作网络" },
        { label: "覆盖国家", value: String(countryCount), hint: "海外合作版图" }
      ];
  }
}

function statsBarItems(
  mode: AtlasMode,
  visibleWildCount: number,
  domesticCount: number,
  overseasCount: number,
  selectedSnapshotDate: string
): StatsBarItem[] {
  switch (mode) {
    case "china_wild":
      return [
        { label: "分布区", value: String(visibleWildCount), hint: "自然分布核心", tone: "wild" },
        { label: "快照", value: formatMonthDayLabel(selectedSnapshotDate), hint: "当前地图时间", tone: "time" },
        { label: "模式", value: "野生", hint: "中国野生视图", tone: "mode" }
      ];
    case "china_captive":
      return [
        { label: "机构", value: String(domesticCount), hint: "圈养与保育机构", tone: "domestic" },
        { label: "快照", value: formatMonthDayLabel(selectedSnapshotDate), hint: "当前地图时间", tone: "time" },
        { label: "模式", value: "中国", hint: "国内圈养网络", tone: "mode" }
      ];
    case "overseas_captive":
      return [
        {
          label: "国家",
          value: String(new Set(ATLAS_INSTITUTIONS.filter((item) => item.region === "overseas").map((item) => item.country)).size),
          hint: "国际合作覆盖",
          tone: "overseas"
        },
        { label: "机构", value: String(overseasCount), hint: "海外圈养节点", tone: "overseas" },
        { label: "模式", value: "全球", hint: "海外圈养网络", tone: "mode" }
      ];
    default:
      return [
        { label: "野生", value: String(visibleWildCount), hint: "自然分布核心", tone: "wild" },
        { label: "国内", value: String(domesticCount), hint: "圈养与保育机构", tone: "domestic" },
        { label: "海外", value: String(overseasCount), hint: "国际合作机构", tone: "overseas" }
      ];
  }
}

function changeIcon(change: AtlasChangeEntry) {
  if (change.kind === "sync") {
    return <Database className="h-4 w-4" />;
  }

  if (change.kind === "travel") {
    return <PlaneTakeoff className="h-4 w-4" />;
  }

  return <FileText className="h-4 w-4" />;
}

function changeIconClass(change: AtlasChangeEntry): string {
  if (change.kind === "sync") {
    return "bg-[var(--atlas-green-soft)] text-[var(--atlas-green)]";
  }

  if (change.kind === "travel") {
    return "bg-[var(--atlas-blue-soft)] text-[var(--atlas-blue)]";
  }

  return "bg-[var(--atlas-orange-soft)] text-[var(--atlas-orange)]";
}

export function PandaAtlasExplorer({
  initialDistribution,
  initialHabitats,
  initialStats,
  defaultBBox,
  initialSnapshotDate,
  availableSnapshotDates,
  initialPandas
}: PandaAtlasExplorerProps) {
  const initialHabitatCollection = useMemo(() => buildHabitatFeatureCollection(initialHabitats), [initialHabitats]);
  const habitatItems = useMemo(
    () => buildHabitatItems(initialHabitatCollection, initialStats.latest_snapshot_date || initialSnapshotDate),
    [initialHabitatCollection, initialSnapshotDate, initialStats.latest_snapshot_date]
  );
  const habitatById = useMemo(
    () => new Map(initialHabitatCollection.features.map((feature) => [feature.properties.atlas_id, feature])),
    [initialHabitatCollection]
  );
  const searchableItems = useMemo(() => [...habitatItems, ...ATLAS_INSTITUTIONS], [habitatItems]);
  const searchableById = useMemo(() => new Map(searchableItems.map((item) => [item.id, item])), [searchableItems]);
  const visibleSnapshotDates = useMemo(() => {
    const base = availableSnapshotDates.filter((item) => item.length > 0).slice(-4);
    const values = new Set<string>([...base, initialSnapshotDate]);
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [availableSnapshotDates, initialSnapshotDate]);

  const [activeMode, setActiveMode] = useState<AtlasMode>("global");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery.trim());
  const [regionFilter, setRegionFilter] = useState<AtlasRegionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<AtlasStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AtlasInstitutionTypeFilter>("all");
  const [selectedItem, setSelectedItem] = useState<AtlasItem | null>(null);
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState(initialSnapshotDate);
  const [distribution, setDistribution] = useState(initialDistribution);
  const [isMapBusy, setIsMapBusy] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hoverCard, setHoverCard] = useState<HoverCard | null>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(ATLAS_TIMELINE_CHANGES[0]?.id ?? null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const skipInitialFetchRef = useRef(true);
  const pendingFocusItemIdRef = useRef<string | null>(null);
  const focusItemOnMapRef = useRef<(item: AtlasItem) => void>(() => undefined);
  const distributionDataRef = useRef<GeoJsonFeatureCollection<Record<string, unknown>>>(EMPTY_FEATURES);
  const habitatDataRef = useRef<GeoJsonFeatureCollection<Record<string, unknown>>>(EMPTY_FEATURES);
  const domesticDataRef = useRef<GeoJsonFeatureCollection<Record<string, unknown>>>(EMPTY_FEATURES);
  const overseasDataRef = useRef<GeoJsonFeatureCollection<Record<string, unknown>>>(EMPTY_FEATURES);
  const selectionDataRef = useRef<GeoJsonFeatureCollection<Record<string, unknown>>>(EMPTY_FEATURES);
  const searchableByIdRef = useRef(searchableById);
  const habitatByIdRef = useRef(habitatById);
  const activeModeRef = useRef(activeMode);

  const activeModeMeta = ATLAS_MODES.find((item) => item.value === activeMode) ?? ATLAS_MODES[0];

  const searchResults = useMemo(() => {
    if (!deferredSearch) {
      return [] as Array<{ group: SearchSuggestionGroup; label: string; items: SearchSuggestion[] }>;
    }

    const regions = searchableItems
      .filter((item) => item.kind === "wild_region" && matchesSearch(item, deferredSearch))
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        group: "region" as const,
        title: item.name,
        subtitle: `${item.kindLabel} · ${item.country}${item.city ? ` / ${item.city}` : ""}`,
        badge: item.badge,
        atlasItem: item
      }));

    const institutions = searchableItems
      .filter((item) => item.kind !== "wild_region" && matchesSearch(item, deferredSearch))
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        group: "institution" as const,
        title: item.name,
        subtitle: `${item.kindLabel} · ${item.country}${item.city ? ` / ${item.city}` : ""}`,
        badge: item.badge,
        atlasItem: item
      }));

    const pandas = initialPandas
      .filter((item) => matchesText(item.searchText, deferredSearch))
      .slice(0, 4)
      .map((item) => ({
        id: `panda:${item.id}`,
        group: "panda" as const,
        title: item.name,
        subtitle: `${item.location} · ${item.summary}`,
        badge: item.badge,
        panda: item
      }));

    const locationMap = new Map<string, SearchSuggestion>();
    for (const item of searchableItems) {
      const label = `${item.country}${item.city ? ` / ${item.city}` : ""}`;
      if (!matchesText(label, deferredSearch) && !(item.province && matchesText(item.province, deferredSearch))) {
        continue;
      }
      if (!locationMap.has(label)) {
        locationMap.set(label, {
          id: `location:${label}`,
          group: "location",
          title: label,
          subtitle: item.kind === "wild_region" ? "区域 / 山系" : "国家 / 城市",
          badge: item.region === "overseas" ? "海外位置" : "中国位置",
          atlasItem: item,
          queryValue: item.city || item.country
        });
      }
    }

    const grouped: Array<{ group: SearchSuggestionGroup; label: string; items: SearchSuggestion[] }> = [];
    const groups: Array<{ group: SearchSuggestionGroup; label: string; items: SearchSuggestion[] }> = [
      { group: "region", label: "区域", items: regions },
      { group: "institution", label: "机构", items: institutions },
      { group: "panda", label: "熊猫个体", items: pandas },
      { group: "location", label: "国家 / 城市", items: [...locationMap.values()].slice(0, 4) }
    ];

    for (const group of groups) {
      if (group.items.length > 0) {
        grouped.push(group);
      }
    }

    return grouped;
  }, [deferredSearch, initialPandas, searchableItems]);

  const visibleWildItems = useMemo(() => {
    if (!activeModeMeta.showHabitats) {
      return [];
    }

    return habitatItems.filter((item) => {
      if (regionFilter !== "all" && item.region !== regionFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (!matchesType(item, typeFilter)) {
        return false;
      }
      return matchesSearch(item, deferredSearch);
    });
  }, [activeModeMeta.showHabitats, deferredSearch, habitatItems, regionFilter, statusFilter, typeFilter]);

  const visibleDomesticInstitutions = useMemo(() => {
    if (!activeModeMeta.showDomesticInstitutions) {
      return [];
    }

    return ATLAS_INSTITUTIONS.filter((item) => {
      if (item.region !== "china") {
        return false;
      }
      if (regionFilter !== "all" && item.region !== regionFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (!matchesType(item, typeFilter)) {
        return false;
      }
      return matchesSearch(item, deferredSearch);
    });
  }, [activeModeMeta.showDomesticInstitutions, deferredSearch, regionFilter, statusFilter, typeFilter]);

  const visibleOverseasInstitutions = useMemo(() => {
    if (!activeModeMeta.showOverseasInstitutions) {
      return [];
    }

    return ATLAS_INSTITUTIONS.filter((item) => {
      if (item.region !== "overseas") {
        return false;
      }
      if (regionFilter !== "all" && item.region !== regionFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (!matchesType(item, typeFilter)) {
        return false;
      }
      return matchesSearch(item, deferredSearch);
    });
  }, [activeModeMeta.showOverseasInstitutions, deferredSearch, regionFilter, statusFilter, typeFilter]);

  const visibleItemIds = useMemo(
    () => new Set([...visibleWildItems, ...visibleDomesticInstitutions, ...visibleOverseasInstitutions].map((item) => item.id)),
    [visibleDomesticInstitutions, visibleOverseasInstitutions, visibleWildItems]
  );

  const visibleHabitatFeatures = useMemo<GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }>>(() => {
    if (!activeModeMeta.showHabitats || visibleWildItems.length === 0) {
      return EMPTY_FEATURES as GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }>;
    }

    const ids = new Set(visibleWildItems.map((item) => item.id));
    return {
      type: "FeatureCollection",
      features: initialHabitatCollection.features.filter((feature) => ids.has(feature.properties.atlas_id))
    };
  }, [activeModeMeta.showHabitats, initialHabitatCollection.features, visibleWildItems]);

  const domesticSourceData = useMemo(
    () => buildPointCollection(visibleDomesticInstitutions),
    [visibleDomesticInstitutions]
  );
  const overseasSourceData = useMemo(
    () => buildPointCollection(visibleOverseasInstitutions),
    [visibleOverseasInstitutions]
  );
  const selectionSourceData = useMemo(
    () => buildSelectionCollection(selectedItem, habitatById),
    [habitatById, selectedItem]
  );

  const showWildBackdrop = visibleWildItems.length > 0 && activeModeMeta.showHabitats;
  const showCaptiveBackdrop = activeMode === "china_captive" && visibleDomesticInstitutions.length > 0;
  const distributionSourceData = showWildBackdrop || showCaptiveBackdrop ? distribution : EMPTY_FEATURES;

  const summaryMetrics = metricCards(
    activeMode,
    initialStats,
    visibleWildItems.length,
    visibleDomesticInstitutions.length,
    visibleOverseasInstitutions.length,
    habitatItems.length,
    selectedSnapshotDate
  );
  const bottomStats = statsBarItems(
    activeMode,
    visibleWildItems.length,
    visibleDomesticInstitutions.length,
    visibleOverseasInstitutions.length,
    selectedSnapshotDate
  );
  const activeChanges = ATLAS_TIMELINE_CHANGES.filter(
    (item) => item.mode === "all" || item.mode === activeMode
  ).slice(0, 2);
  const timelineChanges = useMemo(() => [...ATLAS_TIMELINE_CHANGES].sort((a, b) => b.date.localeCompare(a.date)), []);
  const selectedTimelineChange =
    timelineChanges.find((item) => item.id === selectedChangeId) ??
    timelineChanges[0] ??
    null;
  const totalSearchResultCount = searchResults.reduce((total, group) => total + group.items.length, 0);
  const showLoadingSkeleton = !isMapReady || isMapBusy;
  const latestAvailableSnapshotDate =
    initialStats.latest_snapshot_date || visibleSnapshotDates[visibleSnapshotDates.length - 1] || selectedSnapshotDate;

  const visibleObjectCount =
    visibleWildItems.length + visibleDomesticInstitutions.length + visibleOverseasInstitutions.length;

  const fitMapToBounds = (bounds: LngLatBoundsLike) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.fitBounds(bounds, {
      padding: window.innerWidth < 1024 ? 28 : 72,
      duration: 850
    });
  };

  const focusItemOnMap = (item: AtlasItem) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (item.kind === "wild_region") {
      const feature = habitatById.get(item.id);
      const bounds = geometryToBounds(feature?.geometry);
      if (bounds) {
        fitMapToBounds(bounds);
        return;
      }
    }

    map.flyTo({
      center: item.coordinates,
      zoom: activeMode === "global" ? 4.1 : 5.2,
      essential: true,
      duration: 850
    });
  };
  focusItemOnMapRef.current = focusItemOnMap;

  const selectItem = (item: AtlasItem) => {
    setSelectedItem(item);
    focusItemOnMap(item);
  };

  const activateAtlasItem = (item: AtlasItem) => {
    const nextMode = modeForItem(item);
    if (nextMode !== activeModeRef.current) {
      pendingFocusItemIdRef.current = item.id;
      startTransition(() => {
        setActiveMode(nextMode);
      });
      return;
    }

    selectItem(item);
  };

  const resetMapView = (clearSelection: boolean) => {
    if (clearSelection) {
      setSelectedItem(null);
    }
    fitMapToBounds(activeModeMeta.bounds);
  };

  const activateHistoryChange = (change: AtlasChangeEntry) => {
    setSelectedChangeId(change.id);

    const nextMode = change.mode === "all" ? "global" : change.mode;
    const nextSnapshotDate = closestSnapshotDate(change.date, visibleSnapshotDates);
    if (nextSnapshotDate) {
      setSelectedSnapshotDate(nextSnapshotDate);
    }

    if (change.focusItemId) {
      const focusItem = searchableById.get(change.focusItemId);
      if (focusItem) {
        pendingFocusItemIdRef.current = focusItem.id;
      }
    } else {
      pendingFocusItemIdRef.current = null;
      setSelectedItem(null);
    }

    if (nextMode !== activeModeRef.current) {
      startTransition(() => {
        setActiveMode(nextMode);
      });
      return;
    }

    if (change.focusItemId) {
      const focusItem = searchableById.get(change.focusItemId);
      if (focusItem) {
        selectItem(focusItem);
        return;
      }
    }

    resetMapView(true);
  };

  useEffect(() => {
    if (selectedItem && !visibleItemIds.has(selectedItem.id)) {
      setSelectedItem(null);
    }
  }, [selectedItem, visibleItemIds]);

  useEffect(() => {
    setHoverCard(null);
    fitMapToBounds(activeModeMeta.bounds);
    const pendingItemId = pendingFocusItemIdRef.current;
    if (!pendingItemId) {
      setSelectedItem(null);
      return;
    }

    const pendingItem = searchableById.get(pendingItemId);
    pendingFocusItemIdRef.current = null;
    if (!pendingItem) {
      setSelectedItem(null);
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setSelectedItem(pendingItem);
      focusItemOnMapRef.current(pendingItem);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [activeModeMeta.bounds, searchableById]);

  useEffect(() => {
    let cancelled = false;
    const requestedLayer: DistributionLayer | null = activeModeMeta.distributionLayer;

    if (!requestedLayer) {
      setDistribution(EMPTY_FEATURES as GeoJsonFeatureCollection<DistributionFeatureProperties>);
      setMapError(null);
      return;
    }

    if (skipInitialFetchRef.current && requestedLayer === "wild" && selectedSnapshotDate === initialSnapshotDate) {
      skipInitialFetchRef.current = false;
      return;
    }

    skipInitialFetchRef.current = false;
    setIsMapBusy(true);
    setMapError(null);

    void getDistribution({
      bbox: defaultBBox,
      layer: requestedLayer,
      snapshot_date: selectedSnapshotDate,
      zoom: 6
    })
      .then((nextDistribution) => {
        if (!cancelled) {
          setDistribution(nextDistribution);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapError("地图数据暂时未能刷新，当前继续显示最近可用快照。");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsMapBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeModeMeta.distributionLayer, defaultBBox, initialSnapshotDate, selectedSnapshotDate]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    async function bootstrap() {
      if (!mapContainerRef.current || mapRef.current) {
        return;
      }

      const maplibregl = await import("maplibre-gl");
      if (!mapContainerRef.current || disposed) {
        return;
      }

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            basemap: {
              type: "raster",
              tiles: [tileUrl()],
              tileSize: 256,
              attribution: tileAttribution()
            },
            distribution: {
              type: "geojson",
              data: asGeoJsonData(distributionDataRef.current)
            },
            habitats: {
              type: "geojson",
              data: asGeoJsonData(habitatDataRef.current)
            },
            domestic: {
              type: "geojson",
              data: asGeoJsonData(domesticDataRef.current)
            },
            overseas: {
              type: "geojson",
              data: asGeoJsonData(overseasDataRef.current)
            },
            selection: {
              type: "geojson",
              data: asGeoJsonData(selectionDataRef.current)
            }
          },
          layers: [
            { id: "basemap", type: "raster", source: "basemap" },
            {
              id: "distribution-fill",
              type: "fill",
              source: "distribution",
              paint: {
                "fill-color": WILD_FILL,
                "fill-opacity": 0.26
              }
            },
            {
              id: "distribution-outline",
              type: "line",
              source: "distribution",
              paint: {
                "line-color": "#56755e",
                "line-width": 1.2,
                "line-opacity": 0.6
              }
            },
            {
              id: "habitats-fill",
              type: "fill",
              source: "habitats",
              paint: {
                "fill-color": "#d8e7d0",
                "fill-opacity": 0.24
              }
            },
            {
              id: "habitats-outline",
              type: "line",
              source: "habitats",
              paint: {
                "line-color": "#6f876d",
                "line-width": 1.2,
                "line-dasharray": [3, 2],
                "line-opacity": 0.82
              }
            },
            {
              id: "domestic-halo",
              type: "circle",
              source: "domestic",
              paint: {
                "circle-radius": ["case", ["==", ["get", "featured"], 1], 11, 8],
                "circle-color": "rgba(217, 137, 54, 0.18)"
              }
            },
            {
              id: "domestic-circles",
              type: "circle",
              source: "domestic",
              paint: {
                "circle-radius": ["case", ["==", ["get", "featured"], 1], 6.5, 5.3],
                "circle-color": "#d98936",
                "circle-stroke-width": 1.8,
                "circle-stroke-color": "#fffaf1"
              }
            },
            {
              id: "overseas-halo",
              type: "circle",
              source: "overseas",
              paint: {
                "circle-radius": ["case", ["==", ["get", "featured"], 1], 11, 8],
                "circle-color": "rgba(78, 134, 216, 0.16)"
              }
            },
            {
              id: "overseas-circles",
              type: "circle",
              source: "overseas",
              paint: {
                "circle-radius": ["case", ["==", ["get", "featured"], 1], 6.5, 5.3],
                "circle-color": "#4e86d8",
                "circle-stroke-width": 1.8,
                "circle-stroke-color": "#f8fbff"
              }
            },
            {
              id: "selection-fill",
              type: "fill",
              source: "selection",
              paint: {
                "fill-color": "#d8e1cb",
                "fill-opacity": 0.28
              }
            },
            {
              id: "selection-line",
              type: "line",
              source: "selection",
              paint: {
                "line-color": "#2f6b3b",
                "line-width": 2.5,
                "line-opacity": 0.92
              }
            },
            {
              id: "selection-circle",
              type: "circle",
              source: "selection",
              paint: {
                "circle-radius": 13,
                "circle-color": "rgba(47,107,59,0.12)",
                "circle-stroke-width": 2.6,
                "circle-stroke-color": "#2f6b3b"
              }
            }
          ]
        },
        center: [20, 26],
        zoom: 1.8,
        minZoom: 1.2,
        maxZoom: 8.5,
        dragRotate: false,
        touchPitch: false
      });

      mapRef.current = map;
      map.touchZoomRotate.disableRotation();

      map.on("load", () => {
        setIsMapReady(true);
        map.fitBounds(ATLAS_MODES[0].bounds, {
          padding: window.innerWidth < 1024 ? 28 : 72,
          duration: 0
        });
      });

      const handleMouseMove = (event: {
        point?: { x: number; y: number };
        features?: Array<{ properties?: Record<string, unknown> }>;
      }) => {
        const feature = event.features?.[0];
        if (!feature?.properties || !event.point) {
          setHoverCard(null);
          return;
        }

        const atlasId = typeof feature.properties.atlas_id === "string" ? feature.properties.atlas_id : null;
        if (!atlasId) {
          setHoverCard(null);
          return;
        }

        const item = searchableByIdRef.current.get(atlasId);
        if (!item) {
          setHoverCard(null);
          return;
        }

        setHoverCard({
          x: event.point.x,
          y: event.point.y,
          title: item.name,
          subtitle: `${item.kindLabel} · ${item.country}${item.city ? ` / ${item.city}` : ""}`
        });
      };

      const handleClick = (event: { features?: Array<{ properties?: Record<string, unknown> }> }) => {
        const feature = event.features?.[0];
        if (!feature?.properties) {
          return;
        }

        const atlasId = typeof feature.properties.atlas_id === "string" ? feature.properties.atlas_id : null;
        if (!atlasId) {
          return;
        }

        const item = searchableByIdRef.current.get(atlasId);
        if (!item) {
          return;
        }

        setSelectedItem(item);

        if (item.kind === "wild_region") {
          const habitat = habitatByIdRef.current.get(item.id);
          const bounds = geometryToBounds(habitat?.geometry);
          if (bounds) {
            map.fitBounds(bounds, {
              padding: window.innerWidth < 1024 ? 28 : 72,
              duration: 850
            });
            return;
          }
        }

        map.flyTo({
          center: item.coordinates,
          zoom: activeModeRef.current === "global" ? 4.1 : 5.2,
          essential: true,
          duration: 850
        });
      };

      for (const layerId of ["domestic-circles", "overseas-circles", "habitats-fill"]) {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
          setHoverCard(null);
        });
        map.on("mousemove", layerId, handleMouseMove);
        map.on("click", layerId, handleClick);
      }

      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    void bootstrap();

    return () => {
      disposed = true;
      setIsMapReady(false);
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const distributionSource = map.getSource("distribution") as GeoJSONSource | undefined;
    const habitatSource = map.getSource("habitats") as GeoJSONSource | undefined;
    const domesticSource = map.getSource("domestic") as GeoJSONSource | undefined;
    const overseasSource = map.getSource("overseas") as GeoJSONSource | undefined;
    const selectionSource = map.getSource("selection") as GeoJSONSource | undefined;

    distributionSource?.setData(asGeoJsonData(distributionSourceData));
    habitatSource?.setData(asGeoJsonData(visibleHabitatFeatures));
    domesticSource?.setData(asGeoJsonData(domesticSourceData));
    overseasSource?.setData(asGeoJsonData(overseasSourceData));
    selectionSource?.setData(asGeoJsonData(selectionSourceData));

    const habitatFillOpacity = activeMode === "china_wild" ? 0.3 : activeMode === "global" ? 0.24 : 0.12;
    const habitatLineColor = activeMode === "china_wild" ? "#5f7d5e" : activeMode === "global" ? "#6f876d" : "#869986";
    const habitatLineOpacity = activeMode === "china_wild" ? 0.92 : activeMode === "global" ? 0.82 : 0.42;

    map.setPaintProperty("distribution-fill", "fill-color", activeMode === "china_captive" ? CAPTIVE_FILL : WILD_FILL);
    map.setPaintProperty(
      "distribution-fill",
      "fill-opacity",
      activeMode === "china_captive" ? 0.18 : activeMode === "china_wild" ? 0.34 : 0.26
    );
    map.setPaintProperty("distribution-outline", "line-color", activeMode === "china_captive" ? "#c17a32" : "#56755e");
    map.setPaintProperty("habitats-fill", "fill-color", activeMode === "china_wild" ? "#d4e5cd" : "#d8e7d0");
    map.setPaintProperty("habitats-fill", "fill-opacity", habitatFillOpacity);
    map.setPaintProperty("habitats-outline", "line-color", habitatLineColor);
    map.setPaintProperty("habitats-outline", "line-opacity", habitatLineOpacity);
  }, [activeMode, distributionSourceData, domesticSourceData, overseasSourceData, selectionSourceData, visibleHabitatFeatures]);

  const currentObjectDate =
    selectedItem?.kind === "wild_region" ? selectedSnapshotDate : selectedItem?.updatedAt ?? latestDate([...visibleDomesticInstitutions, ...visibleOverseasInstitutions]);

  const emptyState =
    visibleObjectCount === 0 &&
    (!distributionSourceData.features || distributionSourceData.features.length === 0);

  distributionDataRef.current = distributionSourceData as GeoJsonFeatureCollection<Record<string, unknown>>;
  habitatDataRef.current = visibleHabitatFeatures as GeoJsonFeatureCollection<Record<string, unknown>>;
  domesticDataRef.current = domesticSourceData;
  overseasDataRef.current = overseasSourceData;
  selectionDataRef.current = selectionSourceData;
  searchableByIdRef.current = searchableById;
  habitatByIdRef.current = habitatById;
  activeModeRef.current = activeMode;

  return (
    <main className="min-h-screen bg-[var(--atlas-shell)] text-[var(--atlas-ink)]" style={themeVars}>
      <SiteHeader
        activeHref="/map"
        statusLabel="当前数据快照"
        statusValue={formatDateLabel(latestAvailableSnapshotDate)}
      />

      <section className={`${shellClassName} py-5 lg:py-7`}>
        <div className="grid gap-8 xl:gap-10 lg:grid-cols-[minmax(360px,392px)_minmax(0,1fr)]">
          <aside className="self-start lg:pr-8 lg:border-r lg:border-[rgba(63,125,72,0.1)]">
              <div className="flex h-full flex-col px-1 py-2 lg:px-0 lg:py-1">
                <section className="space-y-4">
                  <div className="inline-flex min-h-[34px] w-fit items-center rounded-full border border-[rgba(47,107,59,0.1)] bg-[rgba(47,107,59,0.05)] px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--atlas-green-deep)]">
                    Global Overview
                  </div>
                  <h1 className="text-[2.25rem] leading-[1.12] text-[var(--atlas-ink)] lg:text-[2.72rem]" style={{ fontFamily: "var(--font-display)" }}>
                    全球熊猫分布图谱
                  </h1>
                  <p className="text-[15px] leading-7 text-[var(--atlas-muted)]">
                    以中国野生分布为核心，串联国内圈养与海外合作网络。
                  </p>
                  <p className="text-[15px] leading-7 text-[var(--atlas-muted)]">
                    先建立整体认知，再通过点选对象进入区域、机构与驻留状态的细节阅读。
                  </p>
                </section>

                <section className="mt-6 border-t border-[rgba(63,125,72,0.09)] pt-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">主模式切换</p>
                      <p className="mt-1 text-[13px] leading-6 text-[var(--atlas-muted)]">在同一张地图里切换空间语义，而不是切换页面。</p>
                    </div>
                    <span className="inline-flex min-h-[34px] items-center rounded-full bg-[rgba(255,255,255,0.62)] px-3 py-1.5 text-[12px] leading-5 text-[var(--atlas-muted)]">
                      {activeModeMeta.label}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] bg-[rgba(233,237,229,0.72)] p-1.5">
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {ATLAS_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() =>
                            startTransition(() => {
                              setActiveMode(mode.value);
                            })
                          }
                          className={`rounded-[1.15rem] px-4 py-3 text-left transition-colors ${
                            mode.value === activeMode
                              ? "bg-[rgba(250,248,243,0.96)] text-[var(--atlas-green-deep)]"
                              : "bg-transparent text-[var(--atlas-muted)] hover:bg-[rgba(255,255,255,0.52)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                                mode.value === activeMode
                                  ? "bg-[var(--atlas-green-deep)] text-white"
                                  : "bg-[rgba(40,79,52,0.06)] text-[var(--atlas-muted)]"
                              }`}
                            >
                              {mode.value === "global" || mode.value === "overseas_captive" ? (
                                <Globe2 className="h-4 w-4" />
                              ) : mode.value === "china_wild" ? (
                                <Trees className="h-4 w-4" />
                              ) : (
                                <Building2 className="h-4 w-4" />
                              )}
                            </span>
                            {mode.value === activeMode ? (
                              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--atlas-green-deep)]">当前</span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-[15px] font-medium leading-6">{mode.label}</p>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--atlas-muted)]">{modeSwitcherHint(mode.value)}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-[rgba(63,125,72,0.09)] pt-6">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">搜索与筛选</p>
                      <p className="mt-1 text-[13px] leading-6 text-[var(--atlas-muted)]">搜索国家、城市、机构、熊猫个体与野生区域。</p>
                    </div>

                    <div className="mt-4 space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--atlas-muted)]" />
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={ATLAS_SEARCH_PLACEHOLDER}
                        className="h-[54px] w-full rounded-[1.2rem] border border-[rgba(63,125,72,0.09)] bg-[rgba(255,255,255,0.72)] pl-11 pr-4 text-[15px] leading-7 text-[var(--atlas-ink)] outline-none transition-shadow focus:shadow-[0_0_0_4px_rgba(47,107,59,0.08)]"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="grid gap-1.5 text-[13px] leading-6 text-[var(--atlas-muted)]">
                        <span>区域</span>
                        <div className="relative">
                          <select
                            value={regionFilter}
                            onChange={(event) => setRegionFilter(event.target.value as AtlasRegionFilter)}
                            className="h-[46px] w-full appearance-none rounded-[1rem] border border-[rgba(63,125,72,0.09)] bg-[rgba(255,255,255,0.72)] px-3 pr-9 text-[14px] leading-6 text-[var(--atlas-ink)] outline-none"
                          >
                            {REGION_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--atlas-muted)]" />
                        </div>
                      </label>

                      <label className="grid gap-1.5 text-[13px] leading-6 text-[var(--atlas-muted)]">
                        <span>生存状态</span>
                        <div className="relative">
                          <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as AtlasStatusFilter)}
                            className="h-[46px] w-full appearance-none rounded-[1rem] border border-[rgba(63,125,72,0.09)] bg-[rgba(255,255,255,0.72)] px-3 pr-9 text-[14px] leading-6 text-[var(--atlas-ink)] outline-none"
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--atlas-muted)]" />
                        </div>
                      </label>

                      <label className="grid gap-1.5 text-[13px] leading-6 text-[var(--atlas-muted)]">
                        <span>机构类型</span>
                        <div className="relative">
                          <select
                            value={typeFilter}
                            onChange={(event) => setTypeFilter(event.target.value as AtlasInstitutionTypeFilter)}
                            className="h-[46px] w-full appearance-none rounded-[1rem] border border-[rgba(63,125,72,0.09)] bg-[rgba(255,255,255,0.72)] px-3 pr-9 text-[14px] leading-6 text-[var(--atlas-ink)] outline-none"
                          >
                            {TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--atlas-muted)]" />
                        </div>
                      </label>
                    </div>
                    </div>

                    {searchResults.length > 0 ? (
                      <div className="mt-4 border-t border-[rgba(63,125,72,0.09)] pt-4">
                        <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--atlas-muted)]">搜索联想</p>
                        <span className="text-[13px] leading-6 text-[var(--atlas-muted)]">{totalSearchResultCount} 条</span>
                        </div>
                        <div className="mt-3 space-y-3">
                        {searchResults.map((group) => (
                          <div key={group.group} className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--atlas-muted)]">{group.label}</p>
                            <div className="divide-y divide-[rgba(63,125,72,0.08)] overflow-hidden rounded-[1rem] border border-[rgba(63,125,72,0.08)] bg-[rgba(255,255,255,0.56)]">
                              {group.items.map((item) =>
                                item.panda ? (
                                  <Link
                                    key={item.id}
                                    href={item.panda.href as Route}
                                    className="flex items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.52)]"
                                  >
                                    <div>
                                      <p className="text-[14px] font-medium leading-6 text-[var(--atlas-ink)]">{item.title}</p>
                                      <p className="mt-1 text-[13px] leading-6 text-[var(--atlas-muted)]">{item.subtitle}</p>
                                    </div>
                                    <span className="rounded-full bg-[rgba(58,68,60,0.05)] px-3 py-1.5 text-[12px] font-semibold leading-5 text-[var(--atlas-ink)]">
                                      {item.badge}
                                    </span>
                                  </Link>
                                ) : (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      if (item.queryValue) {
                                        setSearchQuery(item.queryValue);
                                      }
                                      if (item.atlasItem) {
                                        activateAtlasItem(item.atlasItem);
                                      }
                                    }}
                                    className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.52)]"
                                  >
                                    <div>
                                      <p className="text-[14px] font-medium leading-6 text-[var(--atlas-ink)]">{item.title}</p>
                                      <p className="mt-1 text-[13px] leading-6 text-[var(--atlas-muted)]">{item.subtitle}</p>
                                    </div>
                                    <span
                                      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold leading-5 ${
                                        item.atlasItem ? itemChipClass(item.atlasItem) : "bg-[rgba(58,68,60,0.05)] text-[var(--atlas-ink)]"
                                      }`}
                                    >
                                      {item.badge}
                                    </span>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="mt-6 border-t border-[rgba(63,125,72,0.09)] pt-6">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">当前选中对象</p>
                    <h2 className="mt-2 text-[1.12rem] leading-[1.32] text-[var(--atlas-ink)]" style={{ fontFamily: "var(--font-display)" }}>
                      {selectedItem ? selectedItem.name : "尚未选中对象"}
                    </h2>
                  </div>

                  <div className="mt-4 rounded-[1.35rem] border border-[rgba(63,125,72,0.09)] bg-[rgba(255,255,255,0.62)] px-4 py-4">
                    {showLoadingSkeleton ? (
                      <div className="space-y-3">
                        <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(63,125,71,0.14)]" />
                        <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(63,125,71,0.1)]" />
                        <div className="h-4 w-4/5 animate-pulse rounded-full bg-[rgba(63,125,71,0.1)]" />
                      </div>
                    ) : selectedItem ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[rgba(47,107,59,0.08)] px-3 py-1.5 text-[12px] leading-5 text-[var(--atlas-green-deep)]">
                            {selectedItemSectionLabel(selectedItem)}
                          </span>
                          <span className="rounded-full bg-[rgba(58,68,60,0.05)] px-3 py-1.5 text-[12px] leading-5 text-[var(--atlas-muted)]">
                            右侧详情已展开
                          </span>
                        </div>
                        <p className="mt-3 text-[14px] leading-7 text-[var(--atlas-muted)]">
                          该对象的完整阅读已切换到右侧滑出栏。左侧继续保留模式阅读、筛选与快照语义，不再堆叠对象卡片。
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[14px] leading-7 text-[var(--atlas-muted)]">
                          点击地图中的分布区或机构后，右侧将滑出详情栏。左侧保持当前模式信息不跳变，只承担索引与阅读控制。
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-[rgba(47,107,59,0.08)] px-3 py-1.5 text-[12px] leading-5 text-[var(--atlas-green-deep)]">面状对象 · 野生分布区</span>
                          <span className="rounded-full bg-[rgba(78,134,216,0.12)] px-3 py-1.5 text-[12px] leading-5 text-[var(--atlas-blue)]">点状对象 · 圈养与合作机构</span>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <section className="mt-6 border-t border-[rgba(63,125,72,0.09)] pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">当前模式概览</p>
                      <h2 className="mt-2 text-[1.16rem] leading-[1.32] text-[var(--atlas-ink)]" style={{ fontFamily: "var(--font-display)" }}>
                        {activeModeMeta.label}
                      </h2>
                    </div>
                    <span className="inline-flex min-h-[34px] items-center rounded-full bg-[rgba(255,255,255,0.62)] px-3 py-1.5 text-[12px] leading-5 text-[var(--atlas-muted)]">
                      {formatDateLabel(selectedSnapshotDate)}
                    </span>
                  </div>

                  <p className="mt-3 text-[14px] leading-7 text-[var(--atlas-muted)]">{sidebarModeSummary(activeMode)}</p>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--atlas-muted)]">{activeModeMeta.description}</p>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {summaryMetrics.map((metric) => (
                      <div key={metric.label} className="border-t border-[rgba(63,125,72,0.14)] pt-3">
                        <p className="text-[1rem] font-semibold leading-6 text-[var(--atlas-ink)]">{metric.value}</p>
                        <p className="mt-1 text-[12px] font-medium leading-5 text-[var(--atlas-muted)]">{metric.label}</p>
                        <p className="mt-1 text-[12px] leading-5 text-[var(--atlas-muted)]">{metric.hint}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-6 border-t border-[rgba(63,125,72,0.09)] pt-6">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">辅助信息</p>
                        <span className="text-[13px] leading-6 text-[var(--atlas-muted)]">{visibleObjectCount} 个对象</span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {showLoadingSkeleton
                          ? Array.from({ length: 3 }).map((_, index) => (
                              <div key={index} className="flex items-start gap-3">
                                <span className="mt-1 h-3 w-3 animate-pulse rounded-full bg-[rgba(63,125,71,0.16)]" />
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(63,125,71,0.12)]" />
                                  <div className="h-3 w-full animate-pulse rounded-full bg-[rgba(63,125,71,0.08)]" />
                                </div>
                              </div>
                            ))
                          : activeModeMeta.legend.map((item) => (
                              <div key={item.label} className="flex items-start gap-3">
                                <span className="mt-1.5 h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <div>
                                  <p className="text-[14px] font-medium leading-6 text-[var(--atlas-ink)]">{item.label}</p>
                                  <p className="text-[13px] leading-6 text-[var(--atlas-muted)]">{item.description}</p>
                                </div>
                              </div>
                            ))}
                      </div>
                    </div>

                    <div className="border-t border-[rgba(63,125,72,0.09)] pt-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">时间快照</p>
                        {isMapBusy ? <span className="text-[13px] leading-6 text-[var(--atlas-muted)]">同步中</span> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {visibleSnapshotDates.map((snapshotDate) => (
                          <button
                            key={snapshotDate}
                            type="button"
                            onClick={() => setSelectedSnapshotDate(snapshotDate)}
                            className={`inline-flex min-h-[36px] items-center rounded-full px-3 py-1.5 text-[13px] leading-5 transition-colors ${
                              snapshotDate === selectedSnapshotDate
                                ? "bg-[rgba(221,235,217,0.92)] text-[var(--atlas-green-deep)]"
                                : "bg-[rgba(255,255,255,0.68)] text-[var(--atlas-muted)]"
                            }`}
                          >
                            {formatDateLabel(snapshotDate)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-[rgba(63,125,72,0.09)] pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">最近变化</p>
                          <p className="mt-1 text-[13px] leading-6 text-[var(--atlas-muted)]">从时间轴进入最近的结构变动。</p>
                        </div>
                        <Link href={"/map#history-timeline" as Route} className="text-[13px] font-medium leading-6 text-[var(--atlas-green-deep)]">
                          查看近年分布变动 →
                        </Link>
                      </div>

                      <div className="mt-3 space-y-3">
                        {activeChanges.map((change, index) => (
                          <button
                            key={change.id}
                            type="button"
                            onClick={() => activateHistoryChange(change)}
                            className={`flex w-full gap-3 text-left transition-colors hover:text-[var(--atlas-green-deep)] ${
                              index < activeChanges.length - 1 ? "border-b border-dashed border-[rgba(63,125,72,0.12)] pb-3" : ""
                            }`}
                          >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${changeIconClass(change)}`}>
                              {changeIcon(change)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[14px] font-medium leading-6 text-[var(--atlas-ink)]">{change.title}</p>
                              <p className="mt-1 text-[13px] leading-6 text-[var(--atlas-muted)]">{formatDateLabel(change.date)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-[rgba(63,125,72,0.09)] pt-5 text-[13px] leading-6 text-[var(--atlas-muted)]">
                      <div className="flex items-start gap-3">
                        <Database className="mt-0.5 h-4 w-4 shrink-0 text-[var(--atlas-muted)]" />
                        <div>
                          <p className="font-medium text-[var(--atlas-ink)]">数据更新时间：{formatDateLabel(initialStats.latest_snapshot_date || selectedSnapshotDate)}</p>
                          <p className="mt-1">{ATLAS_DATA_STATUS}</p>
                          <p className="mt-2">{ATLAS_DATA_SOURCE}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </aside>

            <section className="relative overflow-hidden rounded-[2.2rem] border border-[rgba(63,125,72,0.1)] bg-[linear-gradient(180deg,#edf2ec,#e4e9df)]">
              <div className="pointer-events-none absolute inset-[10px] rounded-[1.82rem] border border-[rgba(255,255,255,0.24)]" />
              <div className="relative h-[58vh] min-h-[520px] lg:h-[70vh] lg:min-h-[640px] lg:max-h-[720px]">
                <div ref={mapContainerRef} className="absolute inset-0" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(255,255,255,0.72),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(223,233,220,0.48),transparent_24%),linear-gradient(180deg,rgba(248,247,242,0.08),rgba(229,236,230,0.22))]" />
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_-110px_140px_rgba(231,236,229,0.22)]" />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,rgba(248,247,242,0.18),transparent)]" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-[linear-gradient(270deg,rgba(248,247,242,0.18),transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(248,247,242,0.84),rgba(248,247,242,0))]" />
                {showLoadingSkeleton ? (
                  <div className="pointer-events-none absolute inset-0 z-[1] bg-[rgba(243,245,241,0.18)]">
                    <div className="absolute left-6 top-6 h-11 w-44 animate-pulse rounded-full bg-[rgba(248,247,242,0.78)]" />
                    <div className="absolute right-6 top-6 h-11 w-56 animate-pulse rounded-full bg-[rgba(248,247,242,0.78)]" />
                    <div className="absolute bottom-6 left-1/2 h-20 w-[min(94%,540px)] -translate-x-1/2 animate-pulse rounded-[30px] bg-[rgba(248,247,242,0.76)]" />
                  </div>
                ) : null}

                <div className="absolute left-6 top-6 z-10 space-y-2.5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.58)] bg-[rgba(248,247,242,0.72)] px-4 py-2 text-[13px] leading-6 text-[var(--atlas-ink)] shadow-[0_12px_22px_rgba(31,48,32,0.06)] backdrop-blur-sm">
                    {activeMode === "global" || activeMode === "overseas_captive" ? (
                      <Globe2 className="h-4 w-4 text-[var(--atlas-green-deep)]" />
                    ) : activeMode === "china_wild" ? (
                      <Trees className="h-4 w-4 text-[var(--atlas-green-deep)]" />
                    ) : (
                      <Building2 className="h-4 w-4 text-[var(--atlas-green-deep)]" />
                    )}
                    <span>{activeModeMeta.label}</span>
                  </div>
                  <div className="rounded-full border border-[rgba(255,255,255,0.58)] bg-[rgba(248,247,242,0.68)] px-4 py-2 text-[12px] leading-5 text-[var(--atlas-muted)] shadow-[0_10px_18px_rgba(31,48,32,0.05)] backdrop-blur-sm">
                    {selectedItem ? "对象详情已从右侧展开" : "地图主舞台"}
                  </div>
                </div>

                <div className="absolute right-6 top-6 z-10 flex flex-col items-end gap-2">
                  <div className="rounded-full border border-[rgba(255,255,255,0.58)] bg-[rgba(248,247,242,0.72)] px-4 py-2 text-[13px] leading-6 text-[var(--atlas-muted)] shadow-[0_12px_22px_rgba(31,48,32,0.06)] backdrop-blur-sm">
                    当前视图 · {activeModeMeta.label}模式 · {formatDateLabel(selectedSnapshotDate)}
                  </div>
                  {mapError ? (
                    <div className="max-w-[280px] rounded-[18px] border border-[rgba(217,137,54,0.16)] bg-[rgba(255,247,238,0.92)] px-3 py-2 text-[13px] leading-6 text-[var(--atlas-orange)] shadow-[0_14px_26px_rgba(31,48,32,0.08)]">
                      {mapError}
                    </div>
                  ) : null}
                </div>

                {hoverCard ? (
                  <div
                    className="pointer-events-none absolute z-20 rounded-[18px] border border-[color:var(--atlas-line)] bg-[rgba(255,255,255,0.94)] px-3 py-2 text-[13px] leading-6 shadow-[0_16px_34px_rgba(29,41,31,0.12)]"
                    style={{
                      left: Math.min(Math.max(hoverCard.x + 18, 18), 860),
                      top: Math.max(hoverCard.y - 12, 18)
                    }}
                  >
                    <p className="font-medium text-[var(--atlas-ink)]">{hoverCard.title}</p>
                    <p className="mt-1 text-[var(--atlas-muted)]">{hoverCard.subtitle}</p>
                  </div>
                ) : null}

                <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-3">
                  <div className="flex flex-col gap-2 rounded-[1.3rem] border border-[rgba(255,255,255,0.82)] bg-[rgba(248,247,242,0.68)] p-2 shadow-[0_12px_22px_rgba(31,48,32,0.06)] backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => mapRef.current?.zoomIn({ duration: 400 })}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(255,255,255,0.82)] bg-[rgba(255,255,255,0.44)] text-[var(--atlas-ink)] transition-colors hover:bg-white"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mapRef.current?.zoomOut({ duration: 400 })}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(255,255,255,0.82)] bg-[rgba(255,255,255,0.44)] text-[var(--atlas-ink)] transition-colors hover:bg-white"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetMapView(true)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[rgba(255,255,255,0.82)] bg-[rgba(248,247,242,0.78)] px-4 py-2 text-[14px] leading-6 text-[var(--atlas-ink)] shadow-[0_12px_24px_rgba(31,48,32,0.08)] backdrop-blur-sm transition-colors hover:bg-white"
                  >
                    <LocateFixed className="h-4 w-4" />
                    <span className="hidden sm:inline">返回全局</span>
                  </button>
                </div>

                <div className="absolute bottom-6 left-1/2 z-10 w-[min(92%,640px)] -translate-x-1/2 rounded-[1.6rem] border border-[rgba(255,255,255,0.78)] bg-[linear-gradient(180deg,rgba(248,247,242,0.82),rgba(244,242,237,0.8))] p-2.5 shadow-[0_14px_28px_rgba(31,48,32,0.08)] backdrop-blur-sm">
                  <div className="grid overflow-hidden rounded-[1.2rem] sm:grid-cols-3">
                    {bottomStats.map((item) => (
                      <div key={item.label} className="border-r border-[rgba(63,125,72,0.08)] px-4 py-3 text-center last:border-r-0">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${statsBarDotClass(item.tone)}`} />
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--atlas-muted)]">{item.label}</p>
                        </div>
                        <p className="mt-2 text-[1.02rem] font-semibold leading-6 text-[var(--atlas-ink)]">{item.value}</p>
                        <p className="mt-1 text-[12px] leading-5 text-[var(--atlas-muted)]">{item.hint}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {emptyState ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
                    <div className="max-w-md rounded-[28px] border border-[color:var(--atlas-line)] bg-[rgba(255,255,255,0.92)] p-6 text-center shadow-[0_20px_44px_rgba(26,36,27,0.12)] backdrop-blur-md">
                      <p className="text-[1.15rem] leading-[1.35] text-[var(--atlas-ink)]" style={{ fontFamily: "var(--font-display)" }}>
                        当前筛选没有匹配对象
                      </p>
                      <p className="mt-3 text-[15px] leading-7 text-[var(--atlas-muted)]">{activeModeMeta.emptyHint}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setRegionFilter("all");
                          setStatusFilter("all");
                          setTypeFilter("all");
                          setSearchQuery("");
                        }}
                        className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-[var(--atlas-green)] px-4 py-2 text-[14px] leading-6 text-white"
                      >
                        重置筛选
                      </button>
                    </div>
                  </div>
                ) : null}

                {selectedItem ? (
                  <>
                    <button
                      type="button"
                      aria-label="关闭对象详情"
                      onClick={() => setSelectedItem(null)}
                      className="absolute inset-0 z-[18] bg-[rgba(21,30,22,0.16)] lg:bg-[rgba(21,30,22,0.06)]"
                    />
                    <aside className="absolute inset-x-0 bottom-0 z-[19] max-h-[78%] overflow-hidden rounded-t-[1.8rem] border-t border-[rgba(63,125,72,0.12)] bg-[rgba(250,248,243,0.98)] shadow-[0_-22px_46px_rgba(20,30,23,0.18)] lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[360px] lg:rounded-none lg:rounded-r-[2rem] lg:border-t-0 lg:border-l lg:shadow-[-18px_0_42px_rgba(20,30,23,0.14)]">
                      <div className="flex h-full flex-col">
                        <div className="flex items-start justify-between gap-4 border-b border-[rgba(63,125,72,0.08)] px-5 py-4">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">
                              {selectedItemSectionLabel(selectedItem)}
                            </p>
                            <h2
                              className="mt-2 truncate text-[1.22rem] leading-[1.25] text-[var(--atlas-ink)]"
                              style={{ fontFamily: "var(--font-display)" }}
                            >
                              {selectedItem.name}
                            </h2>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-[rgba(63,125,72,0.08)] bg-white px-3 py-1.5 text-[12px] leading-5 text-[var(--atlas-muted)]">
                                {detailItemTypeLabel(selectedItem)}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold leading-5 ${itemChipClass(selectedItem)}`}
                              >
                                {selectedItem.badge}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedItem(null)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(63,125,72,0.08)] bg-white text-[var(--atlas-ink)]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-5">
                          <dl className="grid gap-0 text-[14px] leading-6">
                            {[
                              { label: "所属模式", value: atlasModeLabel(selectedItem.mode) },
                              { label: "区域 / 国家 / 城市", value: itemLocationLabel(selectedItem) },
                              { label: "当前状态", value: itemStatusLabel(selectedItem) },
                              { label: "更新时间", value: formatDateLabel(currentObjectDate) }
                            ].map((detail, index, list) => (
                              <div
                                key={detail.label}
                                className={`flex items-start justify-between gap-3 py-3 ${
                                  index < list.length - 1 ? "border-b border-dashed border-[color:var(--atlas-line)]" : ""
                                }`}
                              >
                                <dt className="text-[var(--atlas-muted)]">{detail.label}</dt>
                                <dd className="text-right text-[var(--atlas-ink)]">{detail.value}</dd>
                              </div>
                            ))}
                          </dl>

                          <section className="mt-5 border-t border-[rgba(63,125,72,0.08)] pt-5">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--atlas-muted)]">
                              简介
                            </p>
                            <p className="mt-3 text-[14px] leading-7 text-[var(--atlas-muted)]">{selectedItem.description}</p>
                            {selectedItem.note ? (
                              <p className="mt-2 text-[13px] leading-6 text-[var(--atlas-green-deep)]">{selectedItem.note}</p>
                            ) : null}
                          </section>

                          <section className="mt-5 border-t border-[rgba(63,125,72,0.08)] pt-5">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--atlas-muted)]">
                              关键属性
                            </p>
                            <div className="mt-3 divide-y divide-[rgba(63,125,72,0.08)]">
                              {detailKeyFacts(selectedItem).map((fact) => (
                                <div key={fact.label} className="py-3">
                                  <p className="text-[12px] font-semibold leading-5 text-[var(--atlas-muted)]">{fact.label}</p>
                                  <p className="mt-1 text-[14px] leading-6 text-[var(--atlas-ink)]">{fact.value}</p>
                                </div>
                              ))}
                            </div>
                          </section>

                          <section className="mt-5 border-t border-[rgba(63,125,72,0.08)] pt-5">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--atlas-muted)]">
                              相关标签
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedItem.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-[rgba(221,235,217,0.54)] px-3 py-1.5 text-[12px] leading-5 text-[var(--atlas-green-deep)]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </section>
                        </div>

                        <div className="border-t border-[rgba(63,125,72,0.08)] px-5 py-4">
                          <div className="grid gap-2">
                            <Link
                              href={selectedItem.detailHref as Route}
                              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[var(--atlas-green-deep)] px-4 py-2 text-[14px] leading-6 text-white shadow-[0_14px_28px_rgba(47,107,59,0.14)]"
                            >
                              查看详细页
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                              href={"/atlas" as Route}
                              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-[rgba(63,125,72,0.08)] bg-white px-4 py-2 text-[14px] leading-6 text-[var(--atlas-ink)]"
                            >
                              查看相关熊猫
                            </Link>
                            <Link
                              href={"/map#history-timeline" as Route}
                              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-[rgba(63,125,72,0.08)] bg-white px-4 py-2 text-[14px] leading-6 text-[var(--atlas-ink)]"
                            >
                              查看历史变化
                            </Link>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => focusItemOnMapRef.current(selectedItem)}
                                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-[rgba(63,125,72,0.08)] bg-[rgba(248,247,242,0.9)] px-4 py-2 text-[14px] leading-6 text-[var(--atlas-ink)]"
                              >
                                <LocateFixed className="h-4 w-4" />
                                在地图中定位
                              </button>
                              <button
                                type="button"
                                onClick={() => resetMapView(true)}
                                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-[rgba(63,125,72,0.08)] bg-[rgba(248,247,242,0.9)] px-4 py-2 text-[14px] leading-6 text-[var(--atlas-ink)]"
                              >
                                返回全局
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </aside>
                  </>
                ) : null}
              </div>
            </section>
        </div>
      </section>

      <section id="history-timeline" className={`${shellClassName} pb-8`}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">历史时间轴</p>
            <h2 className="mt-2 text-[1.45rem] text-[var(--atlas-ink)]" style={{ fontFamily: "var(--font-display)" }}>
              用时间维度补全全球熊猫分布图谱
            </h2>
          </div>
          <p className="max-w-[40rem] text-sm leading-7 text-[var(--atlas-muted)]">
            这里把快照更新、机构名录复核和合作节点变化串成一条可点击的时间轴。点击任一条目，都会同步地图模式、快照时间和关联对象。
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]">
          <section className="border-t border-[rgba(63,125,72,0.12)] px-5 py-5">
            {selectedTimelineChange ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${changeIconClass(selectedTimelineChange)}`}>
                    {changeIcon(selectedTimelineChange)}
                  </span>
                  <span className="rounded-full bg-[rgba(47,107,59,0.08)] px-3 py-1 text-[11px] text-[var(--atlas-green)]">
                    {formatDateLabel(selectedTimelineChange.date)}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--atlas-muted)]">
                    {selectedTimelineChange.mode === "all"
                      ? "全球总览"
                      : ATLAS_MODES.find((item) => item.value === selectedTimelineChange.mode)?.label ?? "地图视图"}
                  </p>
                  <h3 className="mt-2 text-[1.25rem] text-[var(--atlas-ink)]" style={{ fontFamily: "var(--font-display)" }}>
                    {selectedTimelineChange.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--atlas-muted)]">{selectedTimelineChange.summary}</p>
                </div>

                <dl className="mt-2 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-dashed border-[color:var(--atlas-line)] pb-2">
                    <dt className="text-[var(--atlas-muted)]">地图模式</dt>
                    <dd className="text-right text-[var(--atlas-ink)]">
                      {selectedTimelineChange.mode === "all"
                        ? "全球总览"
                        : ATLAS_MODES.find((item) => item.value === selectedTimelineChange.mode)?.label ?? "地图视图"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-dashed border-[color:var(--atlas-line)] pb-2">
                    <dt className="text-[var(--atlas-muted)]">对应快照</dt>
                    <dd className="text-right text-[var(--atlas-ink)]">
                      {formatDateLabel(closestSnapshotDate(selectedTimelineChange.date, visibleSnapshotDates))}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--atlas-muted)]">关联对象</dt>
                    <dd className="text-right text-[var(--atlas-ink)]">
                      {selectedTimelineChange.focusItemId
                        ? searchableById.get(selectedTimelineChange.focusItemId)?.name ?? "地图对象"
                        : "当前视图总览"}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => activateHistoryChange(selectedTimelineChange)}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--atlas-green)] px-4 py-2 text-sm text-white"
                >
                  在地图中查看
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </section>

          <section className="border-t border-[rgba(63,125,72,0.12)] px-5 py-5">
            <div className="space-y-3">
              {timelineChanges.map((change, index) => {
                const isActive = change.id === selectedTimelineChange?.id;

                return (
                  <button
                    key={change.id}
                    type="button"
                    onClick={() => activateHistoryChange(change)}
                    className={`grid w-full grid-cols-[auto_minmax(0,1fr)] gap-4 border-b border-dashed border-[rgba(63,125,72,0.12)] px-1 py-4 text-left transition-colors last:border-b-0 ${
                      isActive
                        ? "bg-[rgba(221,235,217,0.42)]"
                        : "bg-transparent hover:bg-[rgba(255,255,255,0.48)]"
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${changeIconClass(change)}`}>
                        {changeIcon(change)}
                      </span>
                      {index < timelineChanges.length - 1 ? (
                        <span className="mt-2 h-full min-h-8 w-px bg-[rgba(63,125,71,0.14)]" />
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--atlas-ink)]">{change.title}</p>
                          <p className="mt-2 text-xs leading-6 text-[var(--atlas-muted)]">{change.summary}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-[var(--atlas-muted)]">{formatDateLabel(change.date)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[rgba(47,107,59,0.08)] px-2.5 py-1 text-[10px] font-semibold text-[var(--atlas-green)]">
                          {change.mode === "all"
                            ? "全球总览"
                            : ATLAS_MODES.find((item) => item.value === change.mode)?.label ?? "地图视图"}
                        </span>
                        {change.focusItemId ? (
                          <span className="rounded-full bg-[rgba(78,134,216,0.1)] px-2.5 py-1 text-[10px] font-semibold text-[var(--atlas-blue)]">
                            {searchableById.get(change.focusItemId)?.name ?? "关联对象"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </section>

      <section className={`${shellClassName} pb-10 pt-2 lg:pb-14`}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">延伸内容</p>
            <h2 className="mt-2 text-[1.45rem] text-[var(--atlas-ink)]" style={{ fontFamily: "var(--font-display)" }}>
              地图是主入口，但不是唯一内容
            </h2>
          </div>
          <p className="max-w-[38rem] text-sm leading-7 text-[var(--atlas-muted)]">
            将野生分布、机构网络与历史变化继续扩展为可持续更新的图谱内容，而不是停留在单次浏览。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ATLAS_EXTENSION_CARDS.map((card) => (
            <Link
              key={card.title}
              href={card.href as Route}
              className="group border-t border-[rgba(63,125,72,0.12)] px-1 py-5 transition-colors"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--atlas-muted)]">{card.kicker}</p>
              <h3 className="mt-3 text-lg text-[var(--atlas-ink)]" style={{ fontFamily: "var(--font-display)" }}>
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--atlas-muted)]">{card.body}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--atlas-green)]">
                继续阅读
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}


