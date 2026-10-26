import type { components } from "@zhipanda/api-client";

import { api } from "@/lib/api";
import { loadResidencies } from "@/lib/public-data";
import { displayName, pandaBirthDate, pandaIsDeceased, pandaSex } from "@/lib/panda";

type Schemas = components["schemas"];
type Place = Schemas["PublicPlaceSummaryDto"];
type Residency = Schemas["PublicResidencySummaryDto"];

export interface PandaListItem {
  id: string;
  slug: string;
  name: string;
  sex: "male" | "female" | null;
  birthDate: string | null;
  deceased: boolean;
  place: string | null;
  /** Slug, every name and the current place, normalized for matching. */
  terms: string[];
}

const collator = new Intl.Collator("zh-CN", { sensitivity: "base", numeric: true });

/** Case, accents, spaces and separators don't matter: "Fu Bao", "fubao" and "fu-bao" match. */
export function normalizeTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-:]+/g, "");
}

/** Chinese names only: coarse locations carry English text, except the country-level "China". */
export function placeName(place: Place | undefined): string | null {
  if (!place) return null;
  if (place.nameZh) return place.nameZh;
  return place.nameEn === "China" ? "中国" : null;
}

/** The open residency, preferring the primary one. */
export function currentPlaceId(residencies: Residency[]): string | null {
  const open = residencies.filter((residency) => !residency.endOn);
  return (open.find((residency) => residency.residencyType === "primary") ?? open[0])?.placeId ?? null;
}

let places: Promise<Map<string, Place>> | null = null;

export function loadPlaces(): Promise<Map<string, Place>> {
  places ??= api
    .GET("/api/v2/places")
    .then(({ data }) => {
      if (!data) throw new Error("Places unavailable");
      return new Map(data.items.map((place) => [place.placeId, place]));
    })
    .catch((error: unknown) => {
      places = null;
      throw error;
    });
  return places;
}

async function buildIndex(): Promise<PandaListItem[]> {
  const [pandas, residencies, placesById] = await Promise.all([api.GET("/api/v2/pandas"), loadResidencies(), loadPlaces()]);
  if (!pandas.data) throw new Error("Panda list unavailable");
  const residenciesByPanda = new Map<string, Residency[]>();
  for (const residency of residencies) {
    residenciesByPanda.set(residency.pandaId, [...(residenciesByPanda.get(residency.pandaId) ?? []), residency]);
  }

  const items = pandas.data.items.map((panda) => {
    const placeId = currentPlaceId(residenciesByPanda.get(panda.pandaId) ?? []);
    const place = placeName(placeId ? placesById.get(placeId) : undefined);
    const names = [panda.canonicalSlug, ...panda.legacySlugs, ...panda.names.map((name) => name.value)];
    return {
      id: panda.pandaId,
      slug: panda.canonicalSlug,
      name: displayName(panda),
      sex: pandaSex(panda),
      birthDate: pandaBirthDate(panda),
      deceased: pandaIsDeceased(panda),
      place,
      terms: (place ? [...names, place] : names).map(normalizeTerm),
    };
  });
  // Living pandas first: they are the ones people can still go and see.
  return items.sort((a, b) => Number(a.deceased) - Number(b.deceased) || collator.compare(a.name, b.name));
}

let index: Promise<PandaListItem[]> | null = null;

/** Every published panda, loaded once per app session. */
export function loadPandaIndex(): Promise<PandaListItem[]> {
  index ??= buildIndex().catch((error: unknown) => {
    index = null;
    throw error;
  });
  return index;
}

/** Exact matches first, then names starting with the query, then the rest, each in list order. */
export function searchPandas(items: PandaListItem[], query: string): PandaListItem[] {
  const needle = normalizeTerm(query);
  if (!needle) return items;
  const rank = (item: PandaListItem) =>
    item.terms.some((term) => term === needle) ? 0 : item.terms.some((term) => term.startsWith(needle)) ? 1 : 2;
  return items
    .filter((item) => item.terms.some((term) => term.includes(needle)))
    .map((item) => ({ item, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
}

export function listMeta(item: PandaListItem): string {
  return [item.place, item.birthDate ? `${item.birthDate.slice(0, 4)} 年出生` : null, item.deceased ? "已离世" : null]
    .filter(Boolean)
    .join("　");
}
