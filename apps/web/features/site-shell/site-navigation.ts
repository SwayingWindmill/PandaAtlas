import "server-only";

import { cache } from "react";

import type { ArchiveSearchResult } from "@/components/command-menu-04";
import type { NavbarFeature } from "@/components/navbar-1";
import { loadV2PandaCovers, loadV2SiteSearchIndex } from "@/features/public-content/public-v2";
import type { PublicLocale } from "@/foundation/content/locales";

export interface SiteNavigationModel {
  searchResults: ArchiveSearchResult[];
  featuredPandas: NavbarFeature[];
}

const FEATURED_CANDIDATES = 8;
const FEATURED_COUNT = 4;

// The navigation is part of every public page, so a failed read degrades to an empty search
// instead of failing the page.
export const loadSiteNavigation = cache(async (locale: PublicLocale): Promise<SiteNavigationModel> => {
  const index = await loadV2SiteSearchIndex().catch(() => null);
  if (!index) return { searchResults: [], featuredPandas: [] };
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

  const candidates = pandas.slice(0, FEATURED_CANDIDATES);
  const covers = await loadV2PandaCovers(candidates.map((panda) => panda.id)).catch(() => new Map());
  const featuredPandas: NavbarFeature[] = candidates.flatMap((panda) => {
    const src = covers.get(panda.id)?.url;
    if (!src) return [];
    return [{
      href: panda.href,
      imageSrc: src,
      name: panda.name,
      meta: panda.birthYear ?? (zh ? "认识这只熊猫" : "Meet this panda"),
    }];
  }).slice(0, FEATURED_COUNT);

  return { searchResults, featuredPandas };
});
