import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";

import { api, publicMediaUrl } from "@/lib/api";
import { OFFLINE_COVERS_KEY, registerOfflineCacheReset } from "@/lib/offline-cache";

// Queries started in the same frame share one API request, up to the endpoint's limit.
const BATCH = 50;
const MAX_CACHED_COVERS = 800;
const queue = new Map<string, { resolve: (value: string | null) => void; reject: (reason: Error) => void }>();
let timer: ReturnType<typeof setTimeout> | null = null;
let hydratedCovers: Map<string, string | null> | null = null;
let hydratePromise: Promise<Map<string, string | null>> | null = null;

registerOfflineCacheReset(() => {
  hydratedCovers = null;
  hydratePromise = null;
});

async function loadCoverStore(): Promise<Map<string, string | null>> {
  if (hydratedCovers) return hydratedCovers;
  if (!hydratePromise) {
    hydratePromise = AsyncStorage.getItem(OFFLINE_COVERS_KEY)
      .then((raw) => {
        const map = new Map<string, string | null>();
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            for (const [id, url] of Object.entries(parsed)) {
              if (typeof url === "string" || url === null) map.set(id, url);
            }
          }
        }
        hydratedCovers = map;
        return map;
      })
      .catch(() => {
        hydratedCovers = new Map();
        return hydratedCovers;
      });
  }
  return hydratePromise;
}

/** Persists `pandaId -> url | null` into AsyncStorage so resident thumbnails render when offline. */
export async function saveOfflineCovers(entries: ReadonlyMap<string, string | null>): Promise<void> {
  if (entries.size === 0) return;
  const store = await loadCoverStore();
  for (const [id, url] of entries) {
    // Re-insert so recently refreshed pandas move to the back of Map iteration order.
    store.delete(id);
    store.set(id, url);
  }
  while (store.size > MAX_CACHED_COVERS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  const serialized = JSON.stringify(Object.fromEntries(store));
  await AsyncStorage.setItem(OFFLINE_COVERS_KEY, serialized).catch(() => undefined);
}

/** Fetches and caches cover URLs for a set of panda IDs; returns resolved non-null `pandaId -> url` entries. */
export async function fetchAndCachePandaCovers(pandaIds: readonly string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(pandaIds.filter(Boolean))];
  const urls = new Map<string, string>();
  const toPersist = new Map<string, string | null>();
  for (let start = 0; start < uniqueIds.length; start += BATCH) {
    const chunk = uniqueIds.slice(start, start + BATCH);
    const { data, error } = await api.GET("/api/v2/panda-covers", { params: { query: { ids: chunk.join(",") } } });
    if (error || !data) throw new Error("Covers unavailable");
    const batchUrls = new Map(data.items.map((cover) => [cover.pandaId, publicMediaUrl(cover.objectKey)]));
    for (const id of chunk) {
      const url = batchUrls.get(id) ?? null;
      toPersist.set(id, url);
      if (url) urls.set(id, url);
    }
  }
  await saveOfflineCovers(toPersist);
  return urls;
}

function flush() {
  timer = null;
  const entries = [...queue.entries()];
  queue.clear();
  for (let start = 0; start < entries.length; start += BATCH) {
    const chunk = entries.slice(start, start + BATCH);
    const ids = chunk.map(([id]) => id);
    void api.GET("/api/v2/panda-covers", { params: { query: { ids: ids.join(",") } } })
      .then(({ data }) => {
        if (!data) throw new Error("Covers unavailable");
        const found = new Map(data.items.map((cover) => [cover.pandaId, publicMediaUrl(cover.objectKey)]));
        const persist = new Map<string, string | null>();
        for (const [id, pending] of chunk) {
          const url = found.get(id) ?? null;
          persist.set(id, url);
          pending.resolve(url);
        }
        void saveOfflineCovers(persist);
      })
      .catch(async (error: unknown) => {
        const failure = error instanceof Error ? error : new Error("Covers unavailable");
        const fallback = await loadCoverStore();
        for (const [id, pending] of chunk) {
          if (fallback.has(id)) pending.resolve(fallback.get(id) ?? null);
          else pending.reject(failure);
        }
      });
  }
}

function loadCover(id: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    queue.set(id, { resolve, reject });
    timer ??= setTimeout(flush, 16);
  });
}

/**
 * The panda's cover photo URL, or null while loading and when it has none. With no panda yet (a screen
 * still loading which one to show) it asks for nothing.
 */
export function usePandaCover(pandaId: string | undefined): string | null {
  const { data } = useQuery({
    queryKey: ["public", "panda-cover", pandaId],
    queryFn: () => loadCover(pandaId!),
    enabled: Boolean(pandaId),
    staleTime: 300_000,
    networkMode: "always",
  });
  return data ?? null;
}
