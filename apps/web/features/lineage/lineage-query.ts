export const DEFAULT_LINEAGE_DEPTH = 2;
export const MAX_LINEAGE_DEPTH = 4;

export interface LineageFocusReference {
  id: string;
  slug: string;
}

export interface LineageQueryState {
  focusId: string;
  focusSlug: string;
  ancestorDepth: number;
  descendantDepth: number;
  relation: string;
}

export interface ParsedLineageQuery {
  state: LineageQueryState;
  canonicalQuery: string;
  needsNormalization: boolean;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const supportedKeys = new Set(["focus", "ancestors", "descendants", "relation"]);

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isSingle(value: string | string[] | undefined): boolean {
  return !Array.isArray(value) || value.length <= 1;
}

function parseDepth(value: string): number {
  if (!/^[1-4]$/.test(value)) return DEFAULT_LINEAGE_DEPTH;
  return Number(value);
}

export function lineageQueryString(state: LineageQueryState): string {
  const query = new URLSearchParams();
  query.set("focus", state.focusSlug);
  if (state.ancestorDepth !== DEFAULT_LINEAGE_DEPTH) {
    query.set("ancestors", String(state.ancestorDepth));
  }
  if (state.descendantDepth !== DEFAULT_LINEAGE_DEPTH) {
    query.set("descendants", String(state.descendantDepth));
  }
  if (state.relation) query.set("relation", state.relation);
  return query.toString();
}

export function lineageHref(locale: "zh" | "en", state: LineageQueryState): string {
  return `/${locale}/lineage?${lineageQueryString(state)}`;
}

export function parseLineageQuery(
  raw: RawSearchParams,
  resolveFocus: (input: string) => LineageFocusReference | null,
  defaultFocus: LineageFocusReference,
): ParsedLineageQuery {
  const rawFocus = first(raw.focus).trim();
  const focus = resolveFocus(rawFocus) ?? defaultFocus;
  const ancestorDepth = parseDepth(first(raw.ancestors));
  const descendantDepth = parseDepth(first(raw.descendants));
  const relation = first(raw.relation).trim().slice(0, 180);

  const state: LineageQueryState = {
    focusId: focus.id,
    focusSlug: focus.slug,
    ancestorDepth,
    descendantDepth,
    relation,
  };
  const canonicalQuery = lineageQueryString(state);

  const incoming = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (!supportedKeys.has(key)) continue;
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of values) incoming.append(key, item);
  }

  const hasUnsupportedKeys = Object.keys(raw).some((key) => !supportedKeys.has(key));
  const hasRepeatedValues = Object.values(raw).some((value) => !isSingle(value));
  const needsNormalization =
    hasUnsupportedKeys ||
    hasRepeatedValues ||
    incoming.toString() !== canonicalQuery;

  return { state, canonicalQuery, needsNormalization };
}
