import "server-only";

import { cache } from "react";

import type { ArchiveSearchResult } from "@/components/command-menu-04";
import { loadV2SiteSearchIndex } from "@/features/public-content/public-v2";
import type { PublicLocale } from "@/lib/locales";

export interface SiteNavigationModel {
  searchResults: ArchiveSearchResult[];
}

// Search index backs /api/site-search; propagate upstream failures so the route returns
// an uncached 503 instead of caching an empty list at the edge.
export const loadSiteNavigation = cache(async (locale: PublicLocale): Promise<SiteNavigationModel> => {
  const index = await loadV2SiteSearchIndex();
  const zh = locale === "zh";

  const pandas = index.pandas.map((panda) => {
    const name = zh ? panda.nameZh : panda.nameEn ?? panda.nameZh;
    const alternateName = zh ? panda.nameEn : panda.nameZh;
    return {
      id: panda.id,
      name,
      href: `/${locale}/pandas/${panda.slug}`,
      snippet: (alternateName && alternateName !== name ? alternateName : null) ?? (zh ? "熊猫主页" : "Panda profile"),
      birthYear: panda.birthYear,
    };
  });

  const searchResults: ArchiveSearchResult[] = [
    ...pandas.map((panda) => ({
      id: `panda-${panda.id}`,
      kind: "panda" as const,
      title: panda.name,
      snippet: panda.snippet,
      meta: panda.birthYear,
      href: panda.href,
    })),
    ...index.places.map((place) => ({
      id: `place-${place.id}`,
      kind: "place" as const,
      title: (zh ? place.nameZh ?? place.nameEn : place.nameEn ?? place.nameZh) ?? place.slug,
      snippet: place.region ?? (zh ? "熊猫生活过的地方" : "A place pandas have lived"),
      meta: null,
      href: `/${locale}/places/${place.slug}`,
    })),
  ];

  return { searchResults };
});
