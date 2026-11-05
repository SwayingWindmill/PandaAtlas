import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { PandaListItem } from "@/features/pandas/pandas";
import { api } from "@/lib/api";

/** 找熊猫 shows this many; the API ranks up to ten. */
export const POPULAR_SHOWN = 5;

/** 大家常看: the published pandas most fans began following in the last 30 days, five fans at least each. */
export async function loadPopularSlugs(): Promise<string[]> {
  const { data, error } = await api.GET("/api/v2/popular-pandas");
  if (error || !data) throw new Error("popular pandas unavailable");
  return data.items.map((item) => item.slug);
}

/** In rank order, only pandas the index has; empty while loading or when nothing reaches the floor. */
export function popularRows(slugs: readonly string[], pandas: readonly PandaListItem[]): PandaListItem[] {
  const bySlug = new Map(pandas.map((panda) => [panda.slug, panda]));
  return slugs.flatMap((slug) => bySlug.get(slug) ?? []).slice(0, POPULAR_SHOWN);
}

export function usePopularPandas(pandas: readonly PandaListItem[] | undefined): PandaListItem[] {
  const { data: slugs } = useQuery({
    queryKey: ["public", "popular-pandas"],
    queryFn: loadPopularSlugs,
    staleTime: 600_000,
    networkMode: "always",
  });
  return useMemo(() => (slugs && pandas ? popularRows(slugs, pandas) : []), [slugs, pandas]);
}
