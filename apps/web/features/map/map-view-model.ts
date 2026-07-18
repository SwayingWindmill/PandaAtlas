import type { PublicMapDataset } from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";
import type {
  CompleteGeoJsonFeatureCollection,
  HabitatFeatureProperties,
  PandaDetail,
  PublicFacilitySummary,
  PublicSourceSummary,
} from "@/lib/types";
import type { StructuredMapMode, StructuredMapQueryState } from "@/features/map/map-query";

export type StructuredMapResultStatus = "current" | "historical";
export type StructuredMapPrecision = "facility" | "locality" | "province" | "country";

export interface StructuredMapHabitatInput {
  collection: CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>;
  source: "api" | "cached-release" | "unavailable";
  snapshotDate: string;
}

export interface StructuredMapResult {
  id: string;
  mode: StructuredMapMode;
  kind: "institution" | "residency" | "conservation_area";
  title: string;
  subtitle: string;
  countryCode: string;
  countryLabel: string;
  placeLabel: string;
  precision: StructuredMapPrecision;
  status: StructuredMapResultStatus;
  statusDetail: string;
  dateRange: string;
  lastVerified: string | null;
  sourceIds: string[];
  sources: PublicSourceSummary[];
  sourceLabel: string;
  profileHref: string | null;
  entityHref: string | null;
  visualizationKey: string | null;
  searchText: string;
}

export interface StructuredMapViewModel {
  allResults: StructuredMapResult[];
  results: StructuredMapResult[];
  selected: StructuredMapResult | null;
  validResultIds: Set<string>;
  countries: Array<{ code: string; label: string; count: number }>;
  counts: Record<StructuredMapMode, number>;
  habitatSource: StructuredMapHabitatInput["source"];
  hasPartialCoverage: boolean;
}

const countryNames = {
  CN: { zh: "中国", en: "China" },
  US: { zh: "美国", en: "United States" },
  UN: { zh: "国家未公开", en: "Country not published" },
} as const;

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[\s_\-:,.()'’]+/g, "")
    .trim();
}

function countryLabel(code: string, locale: PublicLocale): string {
  return countryNames[code as keyof typeof countryNames]?.[locale] ?? code;
}

function localizedPandaName(panda: PandaDetail, locale: PublicLocale): string {
  if (locale === "zh") return panda.name_zh;
  return panda.name_en ?? panda.name_zh;
}

function facilityName(facility: PublicFacilitySummary, locale: PublicLocale): string {
  const preferredLanguage = locale === "zh" ? "zh-Hans" : "en";
  return facility.names.find((name) => name.language === preferredLanguage)?.value
    ?? facility.names[0]?.value
    ?? facility.canonical_slug;
}

function entityName(
  names: Array<{ language: string; value: string }>,
  locale: PublicLocale,
  fallback: string,
): string {
  const preferredLanguage = locale === "zh" ? "zh-Hans" : "en";
  return names.find((name) => name.language === preferredLanguage)?.value
    ?? names[0]?.value
    ?? fallback;
}

function maxDate(values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function sourceSubset(sourceIds: string[], sourcesById: Map<string, PublicSourceSummary>): PublicSourceSummary[] {
  return [...new Set(sourceIds)].flatMap((id) => {
    const source = sourcesById.get(id);
    return source ? [source] : [];
  });
}

function dateRange(
  start: string,
  end: string | null,
  locale: PublicLocale,
): string {
  if (!end) return locale === "zh" ? `${start} 至今` : `${start} to present`;
  return `${start} – ${end}`;
}

function buildInstitutionResults(
  dataset: PublicMapDataset,
  sourcesById: Map<string, PublicSourceSummary>,
  locale: PublicLocale,
): StructuredMapResult[] {
  return dataset.facilities.map((facility) => {
    const linkedResidencies = dataset.pandas.flatMap((panda) =>
      panda.residencies
        .filter((residency) => residency.facility_id === facility.id)
        .map((residency) => ({ panda, residency })),
    );
    const currentPandas = dataset.pandas.filter((panda) => panda.current_place?.facility_id === facility.id);
    const institution = dataset.institutions.find((item) => item.facility_ids.includes(facility.id)) ?? null;
    const publishedPlace = dataset.places.find((item) => item.facility_ids.includes(facility.id)) ?? null;
    const sourceIds = [
      ...(institution?.source_ids ?? []),
      ...(publishedPlace?.source_ids ?? []),
      ...linkedResidencies.flatMap(({ residency }) => residency.source_ids),
    ];
    const sources = sourceSubset(sourceIds, sourcesById);
    const status: StructuredMapResultStatus = currentPandas.length ? "current" : "historical";
    const name = institution
      ? entityName(institution.names, locale, institution.canonical_slug)
      : facilityName(facility, locale);
    const locality = publishedPlace
      ? entityName(publishedPlace.names, locale, publishedPlace.locality ?? publishedPlace.canonical_slug)
      : facility.locality ?? countryLabel(facility.country_code ?? "UN", locale);
    const associatedNames = [...new Set(linkedResidencies.map(({ panda }) => localizedPandaName(panda, locale)))];
    const statusDetail = locale === "zh"
      ? currentPandas.length
        ? `${currentPandas.length} 只已审核个体现居于此`
        : `${linkedResidencies.length} 条已审核历史驻留`
      : currentPandas.length
        ? `${currentPandas.length} reviewed current resident${currentPandas.length === 1 ? "" : "s"}`
        : `${linkedResidencies.length} reviewed historical residenc${linkedResidencies.length === 1 ? "y" : "ies"}`;
    return {
      id: `institution:${facility.id}`,
      mode: "institutions",
      kind: "institution",
      title: name,
      subtitle: associatedNames.length
        ? associatedNames.join(locale === "zh" ? "、" : ", ")
        : locale === "zh" ? "暂无已发布个体关联" : "No published panda association",
      countryCode: publishedPlace?.country_code ?? facility.country_code ?? "UN",
      countryLabel: countryLabel(publishedPlace?.country_code ?? facility.country_code ?? "UN", locale),
      placeLabel: locality,
      precision: publishedPlace?.precision ?? (facility.locality ? "locality" : "country"),
      status,
      statusDetail,
      dateRange: locale === "zh" ? "按当前公开发布版本" : "As of the current public release",
      lastVerified: maxDate([
        institution?.last_verified_at,
        publishedPlace?.last_verified_at,
        ...linkedResidencies.map(({ residency }) => residency.last_verified_at),
      ]),
      sourceIds: [...new Set(sourceIds)],
      sources,
      sourceLabel: locale === "zh" ? "已审核机构、场所与驻留记录" : "Reviewed institution, place, and residency records",
      profileHref: null,
      entityHref: institution ? `/${locale}/institutions/${institution.canonical_slug}` : null,
      visualizationKey: facility.id,
      searchText: normalized([
        name,
        facility.canonical_slug,
        facility.locality ?? "",
        facility.country_code ?? "",
        ...facility.names.map((item) => item.value),
        ...associatedNames,
      ].join(" ")),
    };
  });
}

function buildIndividualResults(
  dataset: PublicMapDataset,
  sourcesById: Map<string, PublicSourceSummary>,
  locale: PublicLocale,
): StructuredMapResult[] {
  const facilitiesById = new Map(dataset.facilities.map((facility) => [facility.id, facility]));
  return dataset.pandas.flatMap((panda) =>
    panda.residencies.map((residency) => {
      const facility = residency.facility_id ? facilitiesById.get(residency.facility_id) ?? null : null;
      const placeEntity = residency.facility_id
        ? dataset.places.find((item) => item.facility_ids.includes(residency.facility_id!)) ?? null
        : null;
      const current = residency.end_date === null
        && (panda.current_place?.facility_id === residency.facility_id
          || (!residency.facility_id && panda.current_place?.coarse_location === residency.coarse_location));
      const place = facility
        ? facilityName(facility, locale)
        : residency.coarse_location ?? (locale === "zh" ? "地点未公开" : "Place not published");
      const sources = sourceSubset(residency.source_ids, sourcesById);
      const title = localizedPandaName(panda, locale);
      const countryCode = facility?.country_code ?? "UN";
      return {
        id: `residency:${panda.id}:${residency.id}`,
        mode: "individual" as const,
        kind: "residency" as const,
        title,
        subtitle: place,
        countryCode,
        countryLabel: countryLabel(countryCode, locale),
        placeLabel: facility?.locality ? `${place} · ${facility.locality}` : place,
        precision: facility ? "facility" as const : "country" as const,
        status: current ? "current" as const : "historical" as const,
        statusDetail: locale === "zh"
          ? `${residency.residency_type} · ${residency.status}`
          : `${residency.residency_type} · ${residency.status}`,
        dateRange: dateRange(residency.start_date, residency.end_date, locale),
        lastVerified: residency.last_verified_at,
        sourceIds: [...new Set(residency.source_ids)],
        sources,
        sourceLabel: locale === "zh" ? "已审核个体驻留记录" : "Reviewed individual residency record",
        profileHref: `/${locale}/atlas/${panda.slug}`,
        entityHref: placeEntity ? `/${locale}/places/${placeEntity.canonical_slug}` : null,
        visualizationKey: facility?.id ?? null,
        searchText: normalized([
          title,
          panda.slug,
          panda.id,
          place,
          facility?.locality ?? "",
          facility?.country_code ?? "",
        ].join(" ")),
      };
    }),
  );
}

function buildWildResults(
  habitats: StructuredMapHabitatInput,
  locale: PublicLocale,
): StructuredMapResult[] {
  return habitats.collection.features.map((feature, index) => {
    const id = String(feature.id ?? `habitat-${index + 1}`);
    const name = feature.properties.name ?? (locale === "zh" ? "未命名保护范围" : "Unnamed conservation range");
    const province = feature.properties.province ?? null;
    const level = feature.properties.level ?? (locale === "zh" ? "级别未公开" : "Level not published");
    const sourceLabel = habitats.source === "api"
      ? locale === "zh" ? "PandaAtlas 实时栖息地接口" : "Live PandaAtlas habitat API"
      : habitats.source === "cached-release"
        ? locale === "zh" ? "PandaAtlas 缓存的部分栖息地发布" : "Cached partial PandaAtlas habitat release"
        : locale === "zh" ? "栖息地数据当前不可用" : "Habitat data currently unavailable";
    return {
      id: `conservation:${id}`,
      mode: "wild",
      kind: "conservation_area",
      title: name,
      subtitle: province ?? countryLabel("CN", locale),
      countryCode: "CN",
      countryLabel: countryLabel("CN", locale),
      placeLabel: province ? `${province} · ${level}` : `${countryLabel("CN", locale)} · ${level}`,
      precision: province ? "province" : "country",
      status: "current",
      statusDetail: locale === "zh" ? `保护范围 · ${level}` : `Conservation range · ${level}`,
      dateRange: habitats.snapshotDate,
      lastVerified: habitats.snapshotDate,
      sourceIds: [],
      sources: [],
      sourceLabel,
      profileHref: null,
      entityHref: null,
      visualizationKey: id,
      searchText: normalized(`${name} ${province ?? ""} CN ${level}`),
    };
  });
}

export function buildStructuredMapViewModel(
  dataset: PublicMapDataset,
  sources: PublicSourceSummary[],
  habitats: StructuredMapHabitatInput,
  state: StructuredMapQueryState,
  locale: PublicLocale,
): StructuredMapViewModel {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const byMode: Record<StructuredMapMode, StructuredMapResult[]> = {
    institutions: buildInstitutionResults(dataset, sourcesById, locale),
    individual: buildIndividualResults(dataset, sourcesById, locale),
    wild: buildWildResults(habitats, locale),
  };
  const allResults = byMode[state.mode];
  const focus = normalized(state.focus);
  const results = allResults.filter((result) => {
    if (focus && !result.searchText.includes(focus)) return false;
    if (state.country !== "all" && result.countryCode !== state.country) return false;
    if (state.status !== "all" && result.status !== state.status) return false;
    return true;
  });
  const validResultIds = new Set(results.map((result) => result.id));
  const selected = state.selected && validResultIds.has(state.selected)
    ? results.find((result) => result.id === state.selected) ?? null
    : null;
  const countries = [...new Set(allResults.map((result) => result.countryCode))]
    .sort()
    .map((code) => ({
      code,
      label: countryLabel(code, locale),
      count: allResults.filter((result) => result.countryCode === code).length,
    }));
  return {
    allResults,
    results,
    selected,
    validResultIds,
    countries,
    counts: {
      institutions: byMode.institutions.length,
      individual: byMode.individual.length,
      wild: byMode.wild.length,
    },
    habitatSource: habitats.source,
    hasPartialCoverage: habitats.source !== "api" || allResults.some((result) => result.sources.length === 0),
  };
}
