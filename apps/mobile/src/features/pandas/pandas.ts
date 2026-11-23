import type { components } from "@zhipanda/api-client";
import { queryOptions } from "@tanstack/react-query";

import { areaOf } from "@/features/pandas/areas";
import { api } from "@/lib/api";
import { displayName, pandaBirthDate, pandaIsDeceased, pandaSex } from "@/lib/panda";
import { queryClient } from "@/lib/query-client";
import { comparePandas } from "./order";

type Schemas = components["schemas"];
type PandaSummary = Schemas["PublicPandaSummaryDto"];
type Place = Schemas["PublicPlaceSummaryDto"];
type PlaceNameInput = Pick<Place, "nameZh" | "nameEn">;
type Residency = Schemas["PublicResidencySummaryDto"];

export interface PandaListItem {
  id: string;
  slug: string;
  name: string;
  sex: "male" | "female" | null;
  birthDate: string | null;
  deceased: boolean;
  place: string | null;
  /** Where it lives now, if anywhere is known. */
  placeId: string | null;
  /** The 找熊猫 area chip it falls under: a base area in China, or 海外. */
  area: string | null;
  hasFullBleedCover: boolean;
  /** Slug, every name and the current place, normalized for matching. */
  terms: string[];
  /**
   * Pinyin initials of each multi-word Latin name ("He Hua" gives "hh"), matched by prefix only. A panda with no
   * Latin name falls back to its slugs; slugs come last because they carry extra words (a place, a year).
   */
  initials: string[];
}

/** Case, accents, spaces and separators don't matter: "Fu Bao", "fubao" and "fu-bao" match. */
export function normalizeTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-:]+/g, "");
}

/** Numbers and the Chinese half of a mixed name are skipped. A single word gives nothing: one letter would match every panda. */
function initialsOf(source: string): string | null {
  const initials = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[\s_\-:]+/)
    .filter((word) => /^[a-z]/.test(word))
    .map((word) => word[0])
    .join("");
  return initials.length >= 2 ? initials : null;
}

/** Chinese names only: coarse locations carry English text, except the country-level "China". */
export function placeName(place: PlaceNameInput | undefined): string | null {
  if (!place) return null;
  if (place.nameZh) return place.nameZh;
  return place.nameEn === "China" ? "中国" : null;
}

/** The open residency, preferring the primary one. */
export function currentPlaceId(residencies: Residency[]): string | null {
  const open = residencies.filter((residency) => !residency.endOn);
  return (open.find((residency) => residency.residencyType === "primary") ?? open[0])?.placeId ?? null;
}

export function loadPlaces(): Promise<Map<string, Place>> {
  return queryClient.fetchQuery(placesQueryOptions());
}

export function placesQueryOptions() {
  return queryOptions({
    queryKey: ["public", "places"],
    networkMode: "always",
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v2/places");
      if (!data) throw new Error("Places unavailable");
      return new Map(data.items.map((place) => [place.placeId, place]));
    },
  });
}

export function toPandaListItem(panda: PandaSummary): PandaListItem {
  const placeRecord = panda.currentPlace;
  const place = placeName(placeRecord);
  const names = panda.names.map((name) => name.value);
  const latin = [panda.canonicalSlug, ...panda.legacySlugs, ...names];
  const latinNames = names.filter((name) => /[A-Za-z]/.test(name));
  const initialSources = latinNames.length > 0 ? latinNames : [panda.canonicalSlug, ...panda.legacySlugs];
  return {
    id: panda.pandaId,
    slug: panda.canonicalSlug,
    name: displayName(panda),
    sex: pandaSex(panda),
    birthDate: pandaBirthDate(panda),
    deceased: pandaIsDeceased(panda),
    place,
    placeId: placeRecord?.placeId ?? null,
    area: areaOf(placeRecord),
    hasFullBleedCover: Boolean(panda.hasFullBleedCover),
    terms: (place ? [...latin, place] : latin).map(normalizeTerm),
    initials: initialSources.flatMap((source) => initialsOf(source) ?? []),
  };
}

async function buildIndex(): Promise<PandaListItem[]> {
  const { data } = await api.GET("/api/v2/pandas");
  if (!data) throw new Error("Panda list unavailable");
  return data.items.map(toPandaListItem).sort(comparePandas);
}

/** Every published panda, shared across screens while the result is fresh. */
export function loadPandaIndex(): Promise<PandaListItem[]> {
  return queryClient.fetchQuery(pandaIndexQueryOptions());
}

export function pandaIndexQueryOptions() {
  return queryOptions({ queryKey: ["public", "panda-index"], queryFn: buildIndex, staleTime: 300_000, networkMode: "always" });
}

export function searchPandas(items: PandaListItem[], query: string, famous: readonly string[] = []): PandaListItem[] {
  const needle = normalizeTerm(query);
  if (!needle) return items;
  const rank = (item: PandaListItem) => {
    if (item.terms.some((term) => term === needle)) return 0;
    if (item.terms.some((term) => term.startsWith(needle))) return 1;
    if (item.initials.some((initials) => initials.startsWith(needle))) return 2;
    return item.terms.some((term) => term.includes(needle)) ? 3 : null;
  };
  const fame = new Map<string, number>();
  famous.forEach((slug, index) => {
    if (!fame.has(slug)) fame.set(slug, index);
  });
  const fameOf = (item: PandaListItem) => fame.get(item.slug) ?? famous.length;
  return items
    .map((item) => ({ item, rank: rank(item) }))
    .filter((entry): entry is { item: PandaListItem; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || fameOf(a.item) - fameOf(b.item))
    .map(({ item }) => item);
}

export function listMeta(item: PandaListItem): string {
  return [item.place, item.birthDate ? `${item.birthDate.slice(0, 4)} 年出生` : null, item.deceased ? "已离世" : null]
    .filter(Boolean)
    .join("　");
}
