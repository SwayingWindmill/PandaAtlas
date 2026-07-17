import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaDetail, PublicFacilitySummary } from "@/lib/types";
import { ATLAS_PAGE_SIZE, type AtlasQueryState } from "./atlas-query";

export type AtlasRecordCompleteness = "complete" | "partial";

export interface AtlasFacilityOption {
  id: string;
  name: string;
  resultCount: number;
}

export interface AtlasResultViewModel {
  id: string;
  slug: string;
  name: string;
  nameLanguage: "zh-CN" | "en";
  alternateName: string | null;
  status: PandaDetail["status"];
  sex: PandaDetail["gender"];
  birthDate: string | null;
  facilityId: string | null;
  facilityName: string | null;
  completeness: AtlasRecordCompleteness;
  mediaState: "licensed" | "source_link_only" | "no_licensed_media" | "unavailable";
}

export interface AtlasSearchViewModel {
  results: AtlasResultViewModel[];
  facilities: AtlasFacilityOption[];
  totalPublished: number;
  totalMatched: number;
  page: number;
  pageCount: number;
  pageSize: number;
  firstResult: number;
  lastResult: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  activeFilterCount: number;
}

function normalizeSearchTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[\s_\-:]+/g, "")
    .trim();
}

function facilityName(facility: PublicFacilitySummary | undefined, locale: PublicLocale): string | null {
  if (!facility) return null;
  const language = locale === "zh" ? "zh-Hans" : "en";
  return facility.names.find((name) => name.language === language)?.value
    ?? facility.names.find((name) => name.language === "en")?.value
    ?? facility.names[0]?.value
    ?? null;
}

function localizedCoarseLocation(value: string | null | undefined, locale: PublicLocale): string | null {
  if (!value) return null;
  if (value === "China") return locale === "zh" ? "中国（国家级记录）" : "China (country-level record)";
  return value;
}

function completeness(detail: PandaDetail): AtlasRecordCompleteness {
  return detail.record_tier === "complete_first_pass" ? "complete" : "partial";
}

function mediaState(detail: PandaDetail): AtlasResultViewModel["mediaState"] {
  if (detail.media_release?.license_state === "licensed") return "licensed";
  if (detail.media_release?.license_state === "source_link_only") return "source_link_only";
  if (detail.media_release?.license_state === "no_licensed_media") return "no_licensed_media";
  return "unavailable";
}

function relevance(detail: PandaDetail, normalizedQuery: string): number {
  if (!normalizedQuery) return 0;
  const terms = [detail.slug, detail.name_zh, detail.name_en ?? "", ...(detail.search_terms ?? [])]
    .map(normalizeSearchTerm)
    .filter(Boolean);
  if (terms.some((term) => term === normalizedQuery)) return 0;
  if (terms.some((term) => term.startsWith(normalizedQuery))) return 1;
  return 2;
}

export function buildAtlasSearchViewModel(
  pandas: PandaDetail[],
  facilities: PublicFacilitySummary[],
  state: AtlasQueryState,
  locale: PublicLocale,
): AtlasSearchViewModel {
  const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
  const normalizedQuery = normalizeSearchTerm(state.q);
  const nameCollator = new Intl.Collator(locale === "zh" ? "zh-CN" : "en", {
    usage: "sort",
    sensitivity: "base",
    numeric: true,
  });

  const matching = pandas.filter((detail) => {
    if (normalizedQuery) {
      const terms = [detail.slug, detail.name_zh, detail.name_en ?? "", ...(detail.search_terms ?? [])];
      if (!terms.some((term) => normalizeSearchTerm(term).includes(normalizedQuery))) return false;
    }
    if (state.status !== "all" && detail.status !== state.status) return false;
    if (state.sex !== "all" && detail.gender !== state.sex) return false;
    if (state.facility !== "all" && detail.current_place?.facility_id !== state.facility) return false;
    if (state.completeness !== "all" && completeness(detail) !== state.completeness) return false;
    return true;
  });

  matching.sort((left, right) => {
    if (state.sort === "birth") {
      const leftDate = left.birth_date ?? "0000-00-00";
      const rightDate = right.birth_date ?? "0000-00-00";
      const byBirth = rightDate.localeCompare(leftDate);
      if (byBirth !== 0) return byBirth;
    }
    if (state.sort === "relevance" && normalizedQuery) {
      const byRelevance = relevance(left, normalizedQuery) - relevance(right, normalizedQuery);
      if (byRelevance !== 0) return byRelevance;
    }
    const leftName = locale === "zh" ? left.name_zh : left.name_en ?? left.name_zh;
    const rightName = locale === "zh" ? right.name_zh : right.name_en ?? right.name_zh;
    return nameCollator.compare(leftName, rightName);
  });

  const pageCount = Math.max(1, Math.ceil(matching.length / ATLAS_PAGE_SIZE));
  const page = Math.min(state.page, pageCount);
  const offset = (page - 1) * ATLAS_PAGE_SIZE;
  const pageRecords = matching.slice(offset, offset + ATLAS_PAGE_SIZE);
  const usedFacilityIds = new Set(pandas.flatMap((detail) => detail.current_place?.facility_id ? [detail.current_place.facility_id] : []));
  const facilityOptions = facilities
    .filter((facility) => usedFacilityIds.has(facility.id))
    .map((facility) => ({
      id: facility.id,
      name: facilityName(facility, locale) ?? facility.canonical_slug,
      resultCount: pandas.filter((detail) => detail.current_place?.facility_id === facility.id).length,
    }))
    .sort((left, right) => nameCollator.compare(left.name, right.name));

  return {
    results: pageRecords.map((detail) => {
      const facilityId = detail.current_place?.facility_id ?? null;
      const translatedNameMissing = locale === "en" && !detail.name_en;
      return {
        id: detail.id,
        slug: detail.slug,
        name: locale === "zh" ? detail.name_zh : detail.name_en ?? detail.name_zh,
        nameLanguage: translatedNameMissing ? "zh-CN" : locale === "zh" ? "zh-CN" : "en",
        alternateName: locale === "zh" ? detail.name_en : detail.name_zh,
        status: detail.status,
        sex: detail.gender,
        birthDate: detail.birth_date,
        facilityId,
        facilityName: facilityName(facilitiesById.get(facilityId ?? ""), locale)
          ?? localizedCoarseLocation(detail.current_place?.coarse_location ?? detail.current_location, locale),
        completeness: completeness(detail),
        mediaState: mediaState(detail),
      };
    }),
    facilities: facilityOptions,
    totalPublished: pandas.length,
    totalMatched: matching.length,
    page,
    pageCount,
    pageSize: ATLAS_PAGE_SIZE,
    firstResult: matching.length ? offset + 1 : 0,
    lastResult: Math.min(offset + ATLAS_PAGE_SIZE, matching.length),
    hasPreviousPage: page > 1,
    hasNextPage: page < pageCount,
    activeFilterCount: [state.status, state.sex, state.facility, state.completeness]
      .filter((value) => value !== "all").length,
  };
}
