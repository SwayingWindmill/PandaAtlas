import type { components } from "@zhipanda/api-client";

import { api } from "@/lib/api";

// Public lists of the active release that several screens read. The `load*` loaders fetch once per app session
// (and again after a failure); the `fetch*` functions always read the current release.

type Schemas = components["schemas"];

function once<T>(fetch: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () =>
    (pending ??= fetch().catch((error: unknown) => {
      pending = null;
      throw error;
    }));
}

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

export const loadLifeEvents = once(fetchLifeEvents);
export const loadLineage = once(fetchLineage);
export const loadResidencies = once(fetchResidencies);
