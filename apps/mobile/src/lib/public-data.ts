import type { components } from "@zhipanda/api-client";

import { api } from "@/lib/api";

// Public lists of the active release that several screens read. Each is fetched once per app session and
// fetched again after a failure.

type Schemas = components["schemas"];

function once<T>(fetch: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () =>
    (pending ??= fetch().catch((error: unknown) => {
      pending = null;
      throw error;
    }));
}

export const loadLifeEvents = once(async (): Promise<Schemas["PublicLifeEventSummaryDto"][]> => {
  const { data } = await api.GET("/api/v2/life-events");
  if (!data) throw new Error("Life events unavailable");
  return data.items;
});

export const loadLineage = once(async (): Promise<Schemas["PublicLineageSummaryDto"][]> => {
  const { data } = await api.GET("/api/v2/lineage");
  if (!data) throw new Error("Lineage unavailable");
  return data.items;
});

export const loadResidencies = once(async (): Promise<Schemas["PublicResidencySummaryDto"][]> => {
  const { data } = await api.GET("/api/v2/residencies");
  if (!data) throw new Error("Residencies unavailable");
  return data.items;
});
