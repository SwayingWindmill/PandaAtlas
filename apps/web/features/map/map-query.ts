export const STRUCTURED_MAP_MODES = ["institutions", "individual", "wild"] as const;
export const STRUCTURED_MAP_STATUSES = ["all", "current", "historical"] as const;

export type StructuredMapMode = (typeof STRUCTURED_MAP_MODES)[number];
export type StructuredMapStatus = (typeof STRUCTURED_MAP_STATUSES)[number];

export interface StructuredMapQueryState {
  mode: StructuredMapMode;
  focus: string;
  country: string;
  status: StructuredMapStatus;
  snapshot: string;
  selected: string;
}

export interface ParsedStructuredMapQuery {
  state: StructuredMapQueryState;
  canonicalQuery: string;
  needsNormalization: boolean;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const supportedKeys = new Set(["mode", "focus", "country", "status", "snapshot", "selected"]);

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isSingle(value: string | string[] | undefined): boolean {
  return !Array.isArray(value) || value.length <= 1;
}

function cleanText(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function parseMode(value: string): StructuredMapMode {
  return STRUCTURED_MAP_MODES.includes(value as StructuredMapMode)
    ? value as StructuredMapMode
    : "institutions";
}

function parseStatus(value: string): StructuredMapStatus {
  return STRUCTURED_MAP_STATUSES.includes(value as StructuredMapStatus)
    ? value as StructuredMapStatus
    : "all";
}

function parseCountry(value: string): string {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "all";
}

export function structuredMapQueryString(state: StructuredMapQueryState): string {
  const query = new URLSearchParams();
  query.set("mode", state.mode);
  if (state.focus) query.set("focus", state.focus);
  if (state.country !== "all") query.set("country", state.country);
  if (state.status !== "all") query.set("status", state.status);
  query.set("snapshot", state.snapshot);
  if (state.selected) query.set("selected", state.selected);
  return query.toString();
}

export function structuredMapHref(locale: "zh" | "en", state: StructuredMapQueryState): string {
  return `/${locale}/map?${structuredMapQueryString(state)}`;
}

export function parseStructuredMapQuery(
  raw: RawSearchParams,
  releaseId: string,
): ParsedStructuredMapQuery {
  const state: StructuredMapQueryState = {
    mode: parseMode(first(raw.mode)),
    focus: cleanText(first(raw.focus), 120),
    country: parseCountry(first(raw.country)),
    status: parseStatus(first(raw.status)),
    snapshot: releaseId,
    selected: cleanText(first(raw.selected), 180),
  };
  const canonicalQuery = structuredMapQueryString(state);
  const incoming = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (!supportedKeys.has(key)) continue;
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of values) incoming.append(key, item);
  }
  const hasUnsupportedKeys = Object.keys(raw).some((key) => !supportedKeys.has(key));
  const hasRepeatedValues = Object.values(raw).some((value) => !isSingle(value));
  return {
    state,
    canonicalQuery,
    needsNormalization: hasUnsupportedKeys || hasRepeatedValues || incoming.toString() !== canonicalQuery,
  };
}
