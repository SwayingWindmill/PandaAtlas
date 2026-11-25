import { authedApi } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

import { pruneSyncedGuestData, readAllGuestData } from "./guest-store";

let activeSync: { accountId: string; promise: Promise<void> } | null = null;

function visitSyncKey(placeId: string, visitedOn: string, note?: string | null): string {
  return `${placeId}:${visitedOn}:${note?.trim() ?? ""}`;
}

async function syncOnce(accountId: string): Promise<void> {
  const data = await readAllGuestData();
  const hasCollections = data.collections.length > 0;
  if (
    data.followedPandas.length === 0 &&
    Object.keys(data.seenPandas).length === 0 &&
    data.followedVenues.length === 0 &&
    data.visits.length === 0 &&
    !hasCollections
  ) {
    return;
  }

  const syncedFavorites = new Set<string>();
  const syncedSeen = new Set<string>();
  const syncedVenues = new Set<string>();
  const syncedVisitIds = new Set<string>();
  const syncedCollections = new Map<string, Set<string>>();

  await Promise.all([
    ...data.followedPandas.map(async (pandaId) => {
      try {
        const { response } = await authedApi.POST("/api/v2/me/favorites/{pandaId}", { params: { path: { pandaId } } });
        if (response.ok) syncedFavorites.add(pandaId);
      } catch {
        // Keep unsynced guest items on the device for a later sign-in.
      }
    }),
    ...Object.entries(data.seenPandas).map(async ([pandaId, entry]) => {
      try {
        const { response } = await authedApi.PUT("/api/v2/me/seen-pandas/{pandaId}", {
          params: { path: { pandaId } },
          body: { seenOn: entry.seenOn, placeId: entry.placeId || null },
        });
        if (response.ok) syncedSeen.add(pandaId);
      } catch {
        // Keep unsynced guest items on the device.
      }
    }),
    ...data.followedVenues.map(async (slug) => {
      try {
        const { response } = await authedApi.POST("/api/v2/me/followed-venues/{slug}", { params: { path: { slug } } });
        if (response.ok) syncedVenues.add(slug);
      } catch {
        // Keep unsynced guest items on the device.
      }
    }),
  ]);

  if (data.visits.length > 0) {
    let existingKeys = new Set<string>();
    try {
      const { data: existing } = await authedApi.GET("/api/v2/me/checkins");
      if (existing) {
        existingKeys = new Set(existing.items.map((item) => visitSyncKey(item.placeId, item.visitedOn, item.note)));
      }
    } catch {
      existingKeys = new Set<string>();
    }
    for (const visit of data.visits) {
      const trimmedNote = visit.note?.trim();
      const key = visitSyncKey(visit.placeId, visit.visitedOn, trimmedNote);
      if (existingKeys.has(key)) {
        syncedVisitIds.add(visit.checkinId);
        continue;
      }
      try {
        const { response } = await authedApi.POST("/api/v2/me/checkins", {
          body: {
            placeId: visit.placeId,
            visitedOn: visit.visitedOn,
            ...(trimmedNote ? { note: trimmedNote } : {}),
          },
        });
        if (response.ok) {
          existingKeys.add(key);
          syncedVisitIds.add(visit.checkinId);
        }
      } catch {
        // Keep unsynced visit on the device.
      }
    }
  }

  if (hasCollections) {
    try {
      const remoteList = await authedApi.GET("/api/v2/me/collections");
      if (remoteList.data) {
        const remoteByName = new Map(remoteList.data.items.map((col) => [col.name, col]));
        for (const col of data.collections) {
          let target = remoteByName.get(col.name);
          if (!target) {
            const created = await authedApi.POST("/api/v2/me/collections", { body: { name: col.name } }).catch(() => null);
            if (!created?.data) continue;
            target = created.data;
            remoteByName.set(target.name, target);
          }

          const existingMembers = new Set(target.pandaIds);
          const syncedPandas = new Set<string>();
          for (const pandaId of col.pandaIds) {
            if (existingMembers.has(pandaId)) {
              syncedPandas.add(pandaId);
              continue;
            }
            try {
              const { response } = await authedApi.POST("/api/v2/me/collections/{collectionId}/pandas/{pandaId}", {
                params: { path: { collectionId: target.collectionId, pandaId } },
              });
              if (response.ok) syncedPandas.add(pandaId);
            } catch {
              // Keep unsynced panda in this guest collection.
            }
          }
          if (col.pandaIds.length === 0 || syncedPandas.size > 0) {
            syncedCollections.set(col.collectionId, syncedPandas);
          }
        }
      }
    } catch {
      // Keep local collections intact if remote list cannot be loaded.
    }
  }

  await pruneSyncedGuestData({
    followedPandas: syncedFavorites,
    seenPandaIds: syncedSeen,
    followedVenues: syncedVenues,
    visitIds: syncedVisitIds,
    syncedCollections,
  });

  if (
    syncedFavorites.size > 0 ||
    syncedSeen.size > 0 ||
    syncedVenues.size > 0 ||
    syncedVisitIds.size > 0 ||
    syncedCollections.size > 0
  ) {
    await queryClient.invalidateQueries({ queryKey: ["private", accountId] });
  }
}

/** Uploads local guest records into the newly signed-in account and removes only successfully synced items. */
export function syncGuestToAccount(accountId: string): Promise<void> {
  if (activeSync && activeSync.accountId === accountId) return activeSync.promise;
  const promise = syncOnce(accountId).finally(() => {
    if (activeSync?.promise === promise) activeSync = null;
  });
  activeSync = { accountId, promise };
  return promise;
}
