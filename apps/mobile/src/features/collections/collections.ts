import type { components } from "@zhipanda/api-client";
import { queryOptions } from "@tanstack/react-query";

import { authedApi } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

// 合集: private lists a signed-in fan makes of pandas, the same collections the website's 收藏与合集 shows.

export type Collection = components["schemas"]["CollectionDto"];

export const NAME_MAX = 80;

/** Newest change first, so a list the fan just touched is on top. */
export function sortCollections(collections: Collection[]): Collection[] {
  return [...collections].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, "zh-CN"),
  );
}

/** The trimmed name, or null when it is empty or too long for the API. */
export function collectionName(value: string): string | null {
  const name = value.trim();
  return name.length > 0 && name.length <= NAME_MAX ? name : null;
}

export async function loadCollections(): Promise<Collection[]> {
  const { data } = await authedApi.GET("/api/v2/me/collections");
  if (!data) throw new Error("Collections unavailable");
  return sortCollections(data.items);
}

export const collectionsQueryKey = (accountId: string) => ["private", accountId, "collections"] as const;

/** Always revalidated on mount: the cached list shows at once, and a change made elsewhere replaces it. */
export function collectionsQueryOptions(accountId: string) {
  return queryOptions({ queryKey: collectionsQueryKey(accountId), queryFn: loadCollections, staleTime: 0 });
}

/**
 * Writes a change the server accepted into the cached list, so every reader of it shows the change. A fetch
 * still in flight is cancelled first: its older response would land on top of the change.
 */
export async function patchCollections(accountId: string, update: (collections: Collection[]) => Collection[]) {
  const queryKey = collectionsQueryKey(accountId);
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData<Collection[]>(queryKey, (current) => current && update(current));
}

export async function createCollection(name: string): Promise<Collection> {
  const { data } = await authedApi.POST("/api/v2/me/collections", { body: { name } });
  if (!data) throw new Error("Collection not created");
  return data;
}

export async function renameCollection(collectionId: string, name: string): Promise<Collection> {
  const { data } = await authedApi.PATCH("/api/v2/me/collections/{collectionId}", {
    params: { path: { collectionId } },
    body: { name },
  });
  if (!data) throw new Error("Collection not renamed");
  return data;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const { response } = await authedApi.DELETE("/api/v2/me/collections/{collectionId}", {
    params: { path: { collectionId } },
  });
  if (!response.ok) throw new Error(`Collection not deleted (${response.status})`);
}

export async function setInCollection(collectionId: string, pandaId: string, inside: boolean): Promise<Collection> {
  const params = { params: { path: { collectionId, pandaId } } };
  const { data } = inside
    ? await authedApi.POST("/api/v2/me/collections/{collectionId}/pandas/{pandaId}", params)
    : await authedApi.DELETE("/api/v2/me/collections/{collectionId}/pandas/{pandaId}", params);
  if (!data) throw new Error("Collection not updated");
  return data;
}
