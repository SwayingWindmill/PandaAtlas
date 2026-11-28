import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type Comparison = {
  id: string;
  title: string;
  dek: string;
  pandaSlugs: string[];
  updatedAt: string;
};

/** Published 比一比, newest first: pairs the team chose, each with a title and one line on what to look at. */
export async function loadComparisons(): Promise<Comparison[]> {
  const { data, error } = await api.GET("/api/v2/comparisons");
  if (error || !data) throw new Error("comparisons unavailable");
  return data.items.filter((item) => item.pandaSlugs.length === 2);
}

export function comparisonsQueryOptions() {
  return queryOptions({ queryKey: ["public", "comparisons"], staleTime: 300_000, networkMode: "always", queryFn: loadComparisons });
}
