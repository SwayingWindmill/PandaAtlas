import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useFollowed } from "@/features/engagement/favorites";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { type PandaListItem, loadPlaces, pandaIndexQueryOptions } from "@/features/pandas/pandas";

export interface NewsContext {
  /** Institution slug → name. */
  venues: ReadonlyMap<string, string>;
  /** Panda slug → panda, for a notice's photo. */
  pandas: ReadonlyMap<string, PandaListItem>;
  /** Where the pandas the user follows live now; null when signed out or still loading. */
  followedVenues: ReadonlySet<string> | null;
}

/** What the 场馆动态 timeline needs besides the notices: venue names, panda photos, the followed venues. */
export function useNewsContext(): NewsContext {
  const institutions = useQuery(institutionListQueryOptions());
  const index = useQuery(pandaIndexQueryOptions());
  const places = useQuery({ queryKey: ["venue-news", "places"], queryFn: loadPlaces, staleTime: 300_000 });
  const followed = useFollowed();
  return useMemo(() => {
    const list = institutions.data ?? [];
    const venues = new Map(list.map((institution) => [institution.slug, institution.nameZh ?? institution.nameEn ?? institution.slug]));
    const pandas = new Map((index.data ?? []).map((panda) => [panda.slug, panda]));
    let followedVenues: Set<string> | null = null;
    if (followed && index.data && places.data && institutions.data) {
      const slugOf = new Map(list.map((institution) => [institution.institutionId, institution.slug]));
      followedVenues = new Set();
      for (const panda of index.data) {
        if (!followed.has(panda.id) || !panda.placeId) continue;
        const institutionId = places.data.get(panda.placeId)?.institutionId;
        const slug = institutionId ? slugOf.get(institutionId) : undefined;
        if (slug) followedVenues.add(slug);
      }
    }
    return { venues, pandas, followedVenues };
  }, [institutions.data, index.data, places.data, followed]);
}
