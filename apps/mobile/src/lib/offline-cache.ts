import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  OFFLINE_COVERS_KEY,
  OFFLINE_PACKS_KEY,
  OFFLINE_PAGES_KEY,
  OFFLINE_PREFIX,
  PAGES_KEPT,
  type OfflineEntry,
  keepRecent,
  offlineEntry,
} from "@/lib/offline-keys";

export { OFFLINE_COVERS_KEY, OFFLINE_PACKS_KEY, OFFLINE_PREFIX };

// Network first: a public read always goes to the API, and a successful answer is saved on the device. Only when
// the request fails (no connection) does the saved copy answer, so an app started offline still shows what it
// last loaded. Photos are kept by expo-image's own disk cache.

let writeQueue: Promise<void> = Promise.resolve();
const resetListeners = new Set<() => void>();
const transientPinsByPack = new Map<string, readonly string[]>();

/** Temporarily pins keys while a base pack download is streaming so residents cannot evict each other mid-download. */
export function setTransientOfflinePins(packSlug: string, keys: readonly string[] | null): void {
  if (keys === null || keys.length === 0) transientPinsByPack.delete(packSlug);
  else transientPinsByPack.set(packSlug, keys);
}

/** Registers an in-memory cache reset callback invoked by `clearOfflineCache`. */
export function registerOfflineCacheReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

/** Collects every `offline:*` page key currently pinned by downloaded or in-flight single-base packs. */
export async function getPinnedOfflineKeys(): Promise<Set<string>> {
  const pinned = new Set<string>();
  for (const transientKeys of transientPinsByPack.values()) {
    for (const key of transientKeys) {
      if (key.startsWith(OFFLINE_PREFIX)) pinned.add(key);
    }
  }
  const raw = await AsyncStorage.getItem(OFFLINE_PACKS_KEY).catch(() => null);
  if (!raw) return pinned;
  try {
    const parsed = JSON.parse(raw) as Record<string, { pinnedKeys?: unknown }>;
    if (!parsed || typeof parsed !== "object") return pinned;
    for (const manifest of Object.values(parsed)) {
      if (!manifest || !Array.isArray(manifest.pinnedKeys)) continue;
      for (const key of manifest.pinnedKeys) {
        if (typeof key === "string" && key.startsWith(OFFLINE_PREFIX)) {
          pinned.add(key);
        }
      }
    }
  } catch {
    return pinned;
  }
  return pinned;
}

async function persistEntry(entry: OfflineEntry, body: string): Promise<void> {
  await AsyncStorage.setItem(entry.key, body);
  if (!entry.page) return;
  const [stored, pinned] = await Promise.all([
    AsyncStorage.getItem(OFFLINE_PAGES_KEY),
    getPinnedOfflineKeys(),
  ]);
  let existing: string[] = [];
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) existing = parsed.filter((item): item is string => typeof item === "string");
    } catch {
      existing = [];
    }
  }
  const { pages, drop } = keepRecent(existing, entry.key, PAGES_KEPT, pinned);
  await AsyncStorage.setItem(OFFLINE_PAGES_KEY, JSON.stringify(pages));
  const removable = drop.filter((item) => !pinned.has(item));
  if (removable.length > 0) await AsyncStorage.removeMany(removable);
}

function enqueueSave(entry: OfflineEntry, body: string): Promise<void> {
  const next = writeQueue.then(
    () => persistEntry(entry, body),
    () => persistEntry(entry, body),
  );
  writeQueue = next.catch(() => undefined);
  return writeQueue;
}

/** Waits for all in-flight response writes to settle before reading or sealing an offline pack. */
export async function flushOfflineCacheWrites(): Promise<void> {
  await writeQueue;
}

/** openapi-fetch middleware for the public API client. */
export const offlineCache = {
  async onResponse({ request, response }: { request: Request; response: Response }) {
    if (request.method !== "GET" || !response.ok) return undefined;
    const entry = offlineEntry(request.url);
    if (entry) {
      const body = await response.clone().text();
      void enqueueSave(entry, body);
    }
    return undefined;
  },
  async onError({ request }: { request: Request }) {
    if (request.method !== "GET") return undefined;
    const entry = offlineEntry(request.url);
    const stored = entry ? await AsyncStorage.getItem(entry.key).catch(() => null) : null;
    if (stored === null) return undefined;
    return new Response(stored, { status: 200, headers: { "content-type": "application/json" } });
  },
};

/** Deletes every saved public read; the fan's own settings and queued check-ins stay. Returns how many went. */
export async function clearOfflineCache(): Promise<number> {
  await flushOfflineCacheWrites();
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(OFFLINE_PREFIX));
  if (keys.length > 0) await AsyncStorage.removeMany(keys);
  for (const listener of resetListeners) listener();
  return keys.length;
}
