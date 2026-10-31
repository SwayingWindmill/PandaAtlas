import { loadPandaIndex, loadPlaces, placeName } from "@/features/pandas/pandas";
import { localToday } from "@/features/engagement/seen";
import type { Evidence } from "@/features/timeline/timeline";
import { loadVisits } from "@/features/visits/visits";
import { api, authedApi } from "@/lib/api";
import { loadLifeEvents, loadResidencies } from "@/lib/public-data";

import { type Memory, type MemoryPlace, type PersonalRecords, memoriesOn } from "./on-this-day";

type Place = Awaited<ReturnType<typeof loadPlaces>> extends Map<string, infer P> ? P : never;

/** A place's name and country, as the rules need them. Only the country-level "China" is called 中国. */
export function memoryPlaces(places: Map<string, Place>): Map<string, MemoryPlace> {
  return new Map(
    [...places].map(([id, place]) => {
      const countryLevel = place.placeType === "coarse_location" && place.nameEn === "China";
      return [
        id,
        {
          id,
          slug: place.placeType === "coarse_location" ? null : place.slug,
          name: placeName(place),
          countryCode: place.countryCode ?? (countryLevel ? "CN" : null),
          countryLevel,
        },
      ];
    }),
  );
}

/** The fan's own records; each one that does not load is left out rather than failing the rest. */
async function loadPersonal(): Promise<PersonalRecords> {
  const [book, seen, visits] = await Promise.all([
    authedApi
      .GET("/api/v2/me/panda-book")
      .then(({ data }) => data?.items ?? [])
      .catch(() => []),
    authedApi
      .GET("/api/v2/me/seen-pandas")
      .then(({ data }) => data?.items ?? [])
      .catch(() => []),
    loadVisits().catch(() => []),
  ]);
  return { recognized: book, seen, visits };
}

/**
 * Today's memories. The panda list is needed; life events and stays are each optional, so an older data
 * release without them still tells birthdays, and a signed-out fan gets the public ones only.
 */
export async function loadMemories({ signedIn, today = localToday() }: { signedIn: boolean; today?: string }): Promise<Memory[]> {
  const [pandas, places, events, residencies, personal] = await Promise.all([
    loadPandaIndex(),
    loadPlaces().catch(() => new Map<string, Place>()),
    loadLifeEvents().catch(() => []),
    loadResidencies().catch(() => []),
    signedIn ? loadPersonal() : Promise.resolve(null),
  ]);
  return memoriesOn({ today, pandas, events, residencies, places: memoryPlaces(places), personal });
}

const sources = new Map<string, Promise<Evidence | null>>();

/** One source's title and publisher, fetched once per session; null when it cannot be read. */
export function loadSource(sourceId: string): Promise<Evidence | null> {
  let found = sources.get(sourceId);
  if (!found) {
    found = api
      .GET("/api/v2/evidence/{sourceId}", { params: { path: { sourceId } } })
      .then(({ data }) => data?.source ?? null)
      .catch(() => {
        sources.delete(sourceId);
        return null;
      });
    sources.set(sourceId, found);
  }
  return found;
}

/** The first readable source of each memory, by memory key. */
export async function loadFirstSources(memories: Memory[]): Promise<Map<string, Evidence>> {
  const pairs = await Promise.all(
    memories.map(async (memory) => {
      for (const id of memory.sourceIds) {
        const source = await loadSource(id);
        if (source) return [memory.key, source] as const;
      }
      return null;
    }),
  );
  return new Map(pairs.filter((pair): pair is readonly [string, Evidence] => pair !== null));
}
