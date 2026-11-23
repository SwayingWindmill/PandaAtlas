import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api";

export interface Counts {
  version: string;
  pandas: number;
  sources: number;
  photos: number;
}

export function statsQueryOptions() {
  return queryOptions({
    queryKey: ["public", "stats"],
    staleTime: 300_000,
    networkMode: "always",
    queryFn: async (): Promise<Counts> => {
      const { data } = await api.GET("/api/v2/stats");
      if (!data) throw new Error("Stats unavailable");
      return {
        version: data.release.version,
        pandas: data.stats.pandaCount,
        sources: data.stats.evidenceSourceCount,
        photos: data.stats.mediaCount,
      };
    },
  });
}
