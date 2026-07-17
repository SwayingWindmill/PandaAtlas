import type { PublicFacilitySummary } from "@/lib/types";

export const ATLAS_PAGE_SIZE = 4;

export type AtlasStatusFilter = "all" | "alive" | "deceased" | "unknown";
export type AtlasSexFilter = "all" | "male" | "female" | "unknown";
export type AtlasCompletenessFilter = "all" | "complete" | "partial";
export type AtlasSort = "relevance" | "name" | "birth";

export interface AtlasQueryState {
  q: string;
  status: AtlasStatusFilter;
  sex: AtlasSexFilter;
  facility: string;
  completeness: AtlasCompletenessFilter;
  sort: AtlasSort;
  page: number;
}

export interface ParsedAtlasQuery {
  state: AtlasQueryState;
  canonicalQuery: string;
  needsNormalization: boolean;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const supportedKeys = new Set(["q", "status", "sex", "facility", "completeness", "sort", "page"]);
const statusValues = new Set<AtlasStatusFilter>(["all", "alive", "deceased", "unknown"]);
const sexValues = new Set<AtlasSexFilter>(["all", "male", "female", "unknown"]);
const completenessValues = new Set<AtlasCompletenessFilter>(["all", "complete", "partial"]);
const sortValues = new Set<AtlasSort>(["relevance", "name", "birth"]);

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function singleValue(value: string | string[] | undefined): boolean {
  return !Array.isArray(value) || value.length <= 1;
}

function positiveInteger(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function atlasQueryString(state: AtlasQueryState): string {
  const query = new URLSearchParams();
  if (state.q) query.set("q", state.q);
  if (state.status !== "all") query.set("status", state.status);
  if (state.sex !== "all") query.set("sex", state.sex);
  if (state.facility !== "all") query.set("facility", state.facility);
  if (state.completeness !== "all") query.set("completeness", state.completeness);
  if (state.sort !== "relevance") query.set("sort", state.sort);
  if (state.page > 1) query.set("page", String(state.page));
  return query.toString();
}

export function atlasHref(locale: "zh" | "en", state: AtlasQueryState): string {
  const query = atlasQueryString(state);
  return `/${locale}/atlas${query ? `?${query}` : ""}`;
}

export function parseAtlasQuery(
  raw: RawSearchParams,
  facilities: PublicFacilitySummary[],
): ParsedAtlasQuery {
  const facilityIds = new Set(facilities.map((facility) => facility.id));
  const q = first(raw.q).trim().replace(/\s+/g, " ").slice(0, 120);
  const rawStatus = first(raw.status);
  const rawSex = first(raw.sex);
  const rawFacility = first(raw.facility);
  const rawCompleteness = first(raw.completeness);
  const rawSort = first(raw.sort);
  const rawPage = first(raw.page);

  const status = statusValues.has(rawStatus as AtlasStatusFilter)
    ? rawStatus as AtlasStatusFilter
    : "all";
  const sex = sexValues.has(rawSex as AtlasSexFilter)
    ? rawSex as AtlasSexFilter
    : "all";
  const facility = rawFacility && facilityIds.has(rawFacility) ? rawFacility : "all";
  const completeness = completenessValues.has(rawCompleteness as AtlasCompletenessFilter)
    ? rawCompleteness as AtlasCompletenessFilter
    : "all";
  const sort = sortValues.has(rawSort as AtlasSort) ? rawSort as AtlasSort : "relevance";
  const page = positiveInteger(rawPage) ?? 1;

  const state: AtlasQueryState = { q, status, sex, facility, completeness, sort, page };
  const canonicalQuery = atlasQueryString(state);
  const incoming = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (!supportedKeys.has(key)) continue;
    const values = Array.isArray(value) ? value : value == null ? [] : [value];
    for (const item of values) incoming.append(key, item);
  }

  const hasUnsupportedKeys = Object.keys(raw).some((key) => !supportedKeys.has(key));
  const hasRepeatedValues = Object.values(raw).some((value) => !singleValue(value));
  const needsNormalization = hasUnsupportedKeys || hasRepeatedValues || incoming.toString() !== canonicalQuery;

  return { state, canonicalQuery, needsNormalization };
}
