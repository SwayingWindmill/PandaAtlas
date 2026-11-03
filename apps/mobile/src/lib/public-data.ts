import type { components } from "@zhipanda/api-client";

import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

// Shared public lists use a bounded cache; fetch* remains available for explicit refreshes.

type Schemas = components["schemas"];

export async function fetchLifeEvents(): Promise<Schemas["PublicLifeEventSummaryDto"][]> {
  const { data } = await api.GET("/api/v2/life-events");
  if (!data) throw new Error("Life events unavailable");
  return data.items;
}

export async function fetchLineage(): Promise<Schemas["PublicLineageSummaryDto"][]> {
  const { data } = await api.GET("/api/v2/lineage");
  if (!data) throw new Error("Lineage unavailable");
  return data.items;
}

export async function fetchResidencies(): Promise<Schemas["PublicResidencySummaryDto"][]> {
  const { data } = await api.GET("/api/v2/residencies");
  if (!data) throw new Error("Residencies unavailable");
  return data.items;
}

export const loadLifeEvents = () => queryClient.fetchQuery({ queryKey: ["public", "life-events"], queryFn: fetchLifeEvents, staleTime: 300_000, networkMode: "always" });
export const loadLineage = () => queryClient.fetchQuery({ queryKey: ["public", "lineage"], queryFn: fetchLineage, staleTime: 300_000, networkMode: "always" });
export const loadResidencies = () => queryClient.fetchQuery({ queryKey: ["public", "residencies"], queryFn: fetchResidencies, staleTime: 300_000, networkMode: "always" });
