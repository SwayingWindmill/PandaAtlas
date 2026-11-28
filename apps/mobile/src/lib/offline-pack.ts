import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";

import type { InstitutionDetail } from "@/features/institutions/institutions";
import { api } from "@/lib/api";
import { fetchAndCachePandaCovers } from "@/lib/covers";
import {
  OFFLINE_PACKS_KEY,
  OFFLINE_PREFIX,
  flushOfflineCacheWrites,
  registerOfflineCacheReset,
  setTransientOfflinePins,
} from "@/lib/offline-cache";
import {
  MAX_PACK_JSON_BYTES,
  type OfflinePackManifest,
  type OfflinePackProgress,
  keysToDeleteOnPackRemoval,
} from "@/lib/offline-pack-model";
import { queryClient } from "@/lib/query-client";

export type { OfflinePackManifest, OfflinePackProgress };
export { estimatePackSummary, formatByteSize, offlinePackPercent } from "@/lib/offline-pack-model";

const PANDAS_CONCURRENCY = 4;
const PHOTOS_CONCURRENCY = 6;

interface PackRuntimeState {
  progress: OfflinePackProgress | null;
  error: string | null;
}

interface OfflinePackStoreSnapshot {
  manifests: Record<string, OfflinePackManifest> | null;
  runtime: ReadonlyMap<string, PackRuntimeState>;
  downloading: ReadonlySet<string>;
}

let cacheEpoch = 0;
let manifestsCache: Record<string, OfflinePackManifest> | null = null;
let hydratePromise: Promise<Record<string, OfflinePackManifest>> | null = null;
const runtimeBySlug = new Map<string, PackRuntimeState>();
const controllersBySlug = new Map<string, AbortController>();
const activePinTokensBySlug = new Map<string, symbol>();
const listeners = new Set<() => void>();
let packSnapshot: OfflinePackStoreSnapshot = {
  manifests: null,
  runtime: new Map(),
  downloading: new Set(),
};

function publishPackSnapshot() {
  packSnapshot = {
    manifests: manifestsCache,
    runtime: new Map(runtimeBySlug),
    downloading: new Set(controllersBySlug.keys()),
  };
  for (const listener of listeners) listener();
}

function subscribePackStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getPackSnapshot(): OfflinePackStoreSnapshot {
  return packSnapshot;
}

registerOfflineCacheReset(() => {
  cacheEpoch += 1;
  for (const controller of controllersBySlug.values()) controller.abort();
  controllersBySlug.clear();
  runtimeBySlug.clear();
  for (const slug of activePinTokensBySlug.keys()) setTransientOfflinePins(slug, null);
  activePinTokensBySlug.clear();
  manifestsCache = {};
  hydratePromise = null;
  publishPackSnapshot();
});

async function loadManifests(): Promise<Record<string, OfflinePackManifest>> {
  if (manifestsCache) return manifestsCache;
  if (!hydratePromise) {
    const epoch = cacheEpoch;
    const promise = AsyncStorage.getItem(OFFLINE_PACKS_KEY)
      .then((raw) => {
        const next: Record<string, OfflinePackManifest> = {};
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            for (const [slug, value] of Object.entries(parsed)) {
              if (value && typeof value === "object" && "slug" in value && "pinnedKeys" in value) {
                next[slug] = value as OfflinePackManifest;
              }
            }
          }
        }
        if (epoch === cacheEpoch) {
          manifestsCache = next;
          publishPackSnapshot();
        }
        return epoch === cacheEpoch ? next : (manifestsCache ?? {});
      })
      .catch(() => {
        if (epoch === cacheEpoch) {
          manifestsCache = {};
          publishPackSnapshot();
        }
        return manifestsCache ?? {};
      })
      .finally(() => {
        if (hydratePromise === promise) hydratePromise = null;
      });
    hydratePromise = promise;
  }
  return hydratePromise;
}

async function saveManifests(next: Record<string, OfflinePackManifest>): Promise<void> {
  manifestsCache = next;
  await AsyncStorage.setItem(OFFLINE_PACKS_KEY, JSON.stringify(next));
  publishPackSnapshot();
}

function utf8ByteLength(value: unknown): number {
  const json = JSON.stringify(value);
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).byteLength;
  return json.length * 2;
}

function throwIfCancelled(signal: AbortSignal | undefined, startEpoch: number) {
  if (signal?.aborted || startEpoch !== cacheEpoch) throw new Error("offline.aborted");
}

async function requireIndexOk<T>(request: () => Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await request();
  if (error || !data) throw new Error("Offline index unavailable");
  return data;
}

/** Downloads and pins an institution's full detail, shared indexes, resident panda dossiers, and disk cover cache. */
export async function downloadOfflinePack(
  institution: InstitutionDetail,
  options?: { signal?: AbortSignal; onProgress?: (progress: OfflinePackProgress) => void },
): Promise<OfflinePackManifest> {
  const signal = options?.signal;
  const startEpoch = cacheEpoch;
  const pinToken = Symbol(institution.slug);
  activePinTokensBySlug.set(institution.slug, pinToken);
  const emit = (progress: OfflinePackProgress) => options?.onProgress?.(progress);
  const candidatePins = [
    `${OFFLINE_PREFIX}/api/v2/institutions/${institution.slug}`,
    ...institution.residents.map((resident) => `${OFFLINE_PREFIX}/api/v2/pandas/${resident.slug}`),
  ];
  setTransientOfflinePins(institution.slug, candidatePins);

  const pinnedKeys = new Set<string>([`${OFFLINE_PREFIX}/api/v2/institutions/${institution.slug}`]);
  let jsonBytes = 0;

  try {
    const sharedTasks: (() => Promise<unknown>)[] = [
      () => requireIndexOk(() => api.GET("/api/v2/pandas")),
      () => requireIndexOk(() => api.GET("/api/v2/places")),
      () => requireIndexOk(() => api.GET("/api/v2/residencies")),
      () => requireIndexOk(() => api.GET("/api/v2/institutions")),
      () => requireIndexOk(() => api.GET("/api/v2/lineage")),
      () => api.GET("/api/v2/learning").catch(() => null),
      () => api.GET("/api/v2/venue-news").catch(() => null),
      () => api.GET("/api/v2/venue-news", { params: { query: { institution: institution.slug } } }).catch(() => null),
    ];

    emit({ phase: "index", done: 0, total: sharedTasks.length + 1 });
    let doneIndex = 0;
    for (const run of sharedTasks) {
      throwIfCancelled(signal, startEpoch);
      await run();
      throwIfCancelled(signal, startEpoch);
      doneIndex += 1;
      emit({ phase: "index", done: doneIndex, total: sharedTasks.length + 1 });
    }
    throwIfCancelled(signal, startEpoch);
    const instRes = await api.GET("/api/v2/institutions/{slug}", { params: { path: { slug: institution.slug } } });
    if (instRes.error || !instRes.data) throw new Error(`Institution ${institution.slug} unavailable`);
    throwIfCancelled(signal, startEpoch);
    jsonBytes += utf8ByteLength(instRes.data);
    emit({ phase: "index", done: sharedTasks.length + 1, total: sharedTasks.length + 1 });

    const residents = institution.residents;
    let downloadedPandas = 0;
    let completedResidents = 0;
    emit({ phase: "pandas", done: 0, total: residents.length });

    for (let start = 0; start < residents.length; start += PANDAS_CONCURRENCY) {
      throwIfCancelled(signal, startEpoch);
      if (jsonBytes >= MAX_PACK_JSON_BYTES) break;
      const chunk = residents.slice(start, start + PANDAS_CONCURRENCY);
      await Promise.all(
        chunk.map(async (resident) => {
          if (signal?.aborted || startEpoch !== cacheEpoch) return;
          const { data, error } = await api.GET("/api/v2/pandas/{slug}", { params: { path: { slug: resident.slug } } });
          if (error || !data) throw new Error(`Panda ${resident.slug} unavailable`);
          if (signal?.aborted || startEpoch !== cacheEpoch) return;
          queryClient.setQueryData(["public", "panda", resident.slug], data);
          jsonBytes += utf8ByteLength(data);
          pinnedKeys.add(`${OFFLINE_PREFIX}/api/v2/pandas/${resident.slug}`);
          downloadedPandas += 1;
        }),
      );
      throwIfCancelled(signal, startEpoch);
      completedResidents += chunk.length;
      emit({ phase: "pandas", done: completedResidents, total: residents.length });
    }

    throwIfCancelled(signal, startEpoch);
    emit({ phase: "covers", done: 0, total: 1 });
    const coverMap = await fetchAndCachePandaCovers(residents.map((resident) => resident.id));
    throwIfCancelled(signal, startEpoch);
    const coverUrls = [...new Set(coverMap.values())];
    emit({ phase: "covers", done: 1, total: 1 });

    if (Platform.OS !== "web" && coverUrls.length > 0) {
      let prefetched = 0;
      emit({ phase: "photos", done: 0, total: coverUrls.length });
      for (let start = 0; start < coverUrls.length; start += PHOTOS_CONCURRENCY) {
        throwIfCancelled(signal, startEpoch);
        const chunk = coverUrls.slice(start, start + PHOTOS_CONCURRENCY);
        await Image.prefetch(chunk, "disk").catch(() => false);
        throwIfCancelled(signal, startEpoch);
        prefetched += chunk.length;
        emit({ phase: "photos", done: prefetched, total: coverUrls.length });
      }
    } else {
      emit({ phase: "photos", done: coverUrls.length, total: coverUrls.length });
    }

    throwIfCancelled(signal, startEpoch);
    // Persist every response body before recording the manifest so immediate offline restarts never lose entries.
    await flushOfflineCacheWrites();
    throwIfCancelled(signal, startEpoch);

    const existing = await loadManifests();
    throwIfCancelled(signal, startEpoch);
    const manifest: OfflinePackManifest = {
      slug: institution.slug,
      name: institution.name,
      downloadedAt: new Date().toISOString(),
      pandaCount: downloadedPandas,
      photoCount: coverUrls.length,
      jsonBytes,
      pinnedKeys: [...pinnedKeys],
    };
    await saveManifests({ ...existing, [institution.slug]: manifest });
    return manifest;
  } finally {
    if (activePinTokensBySlug.get(institution.slug) === pinToken) {
      activePinTokensBySlug.delete(institution.slug);
      setTransientOfflinePins(institution.slug, null);
    }
  }
}

/** Removes one downloaded base pack manifest and deletes only unshared pinned keys. */
export async function removeOfflinePack(slug: string): Promise<void> {
  const current = await loadManifests();
  const keysToDelete = keysToDeleteOnPackRemoval(slug, current);
  const next = { ...current };
  delete next[slug];
  await saveManifests(next);
  if (keysToDelete.length > 0) {
    await AsyncStorage.removeMany(keysToDelete).catch(() => undefined);
  }
}

/** Reactive hook managing download, cancel, update, and removal of one institution's offline pack. */
export function useOfflinePack(slug: string) {
  const store = useSyncExternalStore(subscribePackStore, getPackSnapshot, getPackSnapshot);

  useEffect(() => {
    if (!manifestsCache) {
      void loadManifests();
    }
  }, [slug]);

  const manifest = store.manifests?.[slug] ?? null;
  const runtime = store.runtime.get(slug);

  function startDownload(institution: InstitutionDetail) {
    if (controllersBySlug.has(institution.slug)) return;
    const controller = new AbortController();
    controllersBySlug.set(institution.slug, controller);
    runtimeBySlug.set(institution.slug, {
      progress: { phase: "index", done: 0, total: 1 },
      error: null,
    });
    publishPackSnapshot();

    void downloadOfflinePack(institution, {
      signal: controller.signal,
      onProgress: (progress) => {
        if (controller.signal.aborted || controllersBySlug.get(institution.slug) !== controller) return;
        runtimeBySlug.set(institution.slug, { progress, error: null });
        publishPackSnapshot();
      },
    })
      .then(() => {
        if (controllersBySlug.get(institution.slug) !== controller) return;
        controllersBySlug.delete(institution.slug);
        runtimeBySlug.delete(institution.slug);
        publishPackSnapshot();
      })
      .catch(() => {
        if (controllersBySlug.get(institution.slug) === controller) {
          controllersBySlug.delete(institution.slug);
          if (controller.signal.aborted) {
            runtimeBySlug.delete(institution.slug);
          } else {
            runtimeBySlug.set(institution.slug, {
              progress: null,
              error: "下载没有完成，请在联网后重试。",
            });
          }
          publishPackSnapshot();
        }
      });
  }

  function cancelDownload() {
    controllersBySlug.get(slug)?.abort();
    controllersBySlug.delete(slug);
    runtimeBySlug.delete(slug);
    publishPackSnapshot();
  }

  function clearError() {
    if (controllersBySlug.has(slug)) return;
    if (runtimeBySlug.delete(slug)) publishPackSnapshot();
  }

  async function removePack() {
    runtimeBySlug.delete(slug);
    await removeOfflinePack(slug);
  }

  return {
    manifest,
    downloading: store.downloading.has(slug),
    progress: runtime?.progress ?? null,
    error: runtime?.error ?? null,
    startDownload,
    cancelDownload,
    clearError,
    removePack,
  };
}
