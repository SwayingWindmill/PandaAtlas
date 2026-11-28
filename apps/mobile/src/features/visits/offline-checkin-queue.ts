import AsyncStorage from "@react-native-async-storage/async-storage";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import { markSeen, seenEntriesQueryKey, seenIdsQueryKey } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import {
  OFFLINE_CHECKIN_QUEUE_KEY,
  type QueuedCheckin,
  pruneQueuedCheckinProgress,
  removeQueuedCheckinByKey,
  sortQueuedCheckins,
  upsertQueuedCheckin,
} from "@/features/visits/offline-checkin-queue-model";
import { recordVisit, visitsQueryKey } from "@/features/visits/visits";
import { queryClient } from "@/lib/query-client";

export type { QueuedCheckin };
export {
  isQueuedVisitId,
  mergeSeenWithQueue,
  mergeVisitsWithQueue,
  queueKeyFromVisitId,
  queuedCheckinKey,
} from "@/features/visits/offline-checkin-queue-model";

let queueCache: QueuedCheckin[] | null = null;
let hydratePromise: Promise<QueuedCheckin[]> | null = null;
let mutationChain: Promise<void> = Promise.resolve();
const activeFlushes = new Map<string, Promise<{ synced: number; remaining: number }>>();
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

function isQueuedCheckin(value: unknown): value is QueuedCheckin {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QueuedCheckin>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.accountId === "string" &&
    typeof candidate.placeId === "string" &&
    typeof candidate.visitedOn === "string" &&
    Array.isArray(candidate.pandaIds)
  );
}

async function loadQueue(): Promise<QueuedCheckin[]> {
  if (queueCache) return queueCache;
  if (!hydratePromise) {
    hydratePromise = AsyncStorage.getItem(OFFLINE_CHECKIN_QUEUE_KEY)
      .then((raw) => {
        if (!raw) {
          queueCache = [];
          return queueCache;
        }
        const parsed = JSON.parse(raw) as unknown;
        queueCache = Array.isArray(parsed) ? sortQueuedCheckins(parsed.filter(isQueuedCheckin)) : [];
        return queueCache;
      })
      .catch(() => {
        queueCache = [];
        return queueCache;
      });
  }
  return hydratePromise;
}

function serializeMutation<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(fn, fn);
  mutationChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function writeQueue(next: QueuedCheckin[]): Promise<QueuedCheckin[]> {
  queueCache = sortQueuedCheckins(next);
  await AsyncStorage.setItem(OFFLINE_CHECKIN_QUEUE_KEY, JSON.stringify(queueCache));
  notifyListeners();
  return queueCache;
}

/** Persists a failed or offline check-in attempt so later retries stay idempotent under `(placeId, visitedOn)`. */
export function enqueueOfflineCheckin(input: {
  accountId: string;
  placeId: string;
  visitedOn: string;
  note?: string | null;
  visitSynced?: boolean;
  pandaIds?: readonly string[];
  lastError?: string;
}): Promise<QueuedCheckin[]> {
  return serializeMutation(async () => {
    const current = await loadQueue();
    const next = upsertQueuedCheckin(current, input);
    return writeQueue(next);
  });
}

export function removeOfflineCheckin(key: string): Promise<QueuedCheckin[]> {
  return serializeMutation(async () => {
    const current = await loadQueue();
    return writeQueue(removeQueuedCheckinByKey(current, key));
  });
}

async function flushOnce(accountId: string): Promise<{ synced: number; remaining: number }> {
  const snapshot = (await loadQueue()).filter((item) => item.accountId === accountId);
  if (snapshot.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;
  for (const item of snapshot) {
    let visitSynced = item.visitSynced;
    let errorMessage: string | undefined;

    if (!visitSynced) {
      try {
        await recordVisit(item.placeId, item.visitedOn, item.note);
        visitSynced = true;
        synced += 1;
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "visit sync failed";
      }
    }

    const syncedPandas = new Set<string>();
    if (visitSynced && item.pandaIds.length > 0) {
      for (const pandaId of item.pandaIds) {
        try {
          const ok = await markSeen(pandaId, item.visitedOn, item.placeId);
          if (ok) {
            syncedPandas.add(pandaId);
            synced += 1;
          } else {
            errorMessage ??= "seen sync failed";
          }
        } catch (error) {
          errorMessage ??= error instanceof Error ? error.message : "seen sync failed";
        }
      }
    }

    const madeProgress = (!item.visitSynced && visitSynced) || syncedPandas.size > 0;
    if (madeProgress || errorMessage) {
      await serializeMutation(async () => {
        const latest = await loadQueue();
        const updated = pruneQueuedCheckinProgress(latest, item.key, visitSynced, syncedPandas, errorMessage);
        await writeQueue(updated);
      });
    }
  }

  if (synced > 0) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: visitsQueryKey(accountId) }),
      queryClient.invalidateQueries({ queryKey: seenIdsQueryKey(accountId) }),
      queryClient.invalidateQueries({ queryKey: seenEntriesQueryKey(accountId) }),
      queryClient.invalidateQueries({ queryKey: ["private", accountId, "book"] }),
      queryClient.invalidateQueries({ queryKey: ["private", accountId, "me-book"] }),
      queryClient.invalidateQueries({ queryKey: ["private", accountId, "milestones"] }),
    ]);
  }

  const remaining = (await loadQueue()).filter((item) => item.accountId === accountId).length;
  return { synced, remaining };
}

/** Flushes queued offline check-ins for `accountId` single-flight; keeps failed entries untouched for later retry. */
export function flushOfflineCheckins(accountId: string): Promise<{ synced: number; remaining: number }> {
  const existing = activeFlushes.get(accountId);
  if (existing) return existing;
  const promise = flushOnce(accountId).finally(() => {
    if (activeFlushes.get(accountId) === promise) activeFlushes.delete(accountId);
  });
  activeFlushes.set(accountId, promise);
  return promise;
}

/** Reactive subscription to locally queued check-ins for one signed-in account. */
export function useQueuedCheckins(accountId: string | null): QueuedCheckin[] {
  const [, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((value) => value + 1);
    listeners.add(bump);
    if (!queueCache) {
      void loadQueue().then(() => notifyListeners());
    }
    return () => {
      listeners.delete(bump);
    };
  }, []);

  if (!accountId || !queueCache) return [];
  return queueCache.filter((item) => item.accountId === accountId);
}

/** Automatically drains queued check-ins whenever a signed-in user regains connectivity or resumes the app. */
export function useOfflineCheckinFlush(): void {
  const { state: session } = useSession();
  const accountId = session.status === "signedIn" ? session.accountId : null;

  useEffect(() => {
    if (!accountId) return;
    if (onlineManager.isOnline()) {
      void flushOfflineCheckins(accountId);
    }

    const unsubscribeOnline = onlineManager.subscribe((isOnline) => {
      if (isOnline) void flushOfflineCheckins(accountId);
    });

    if (Platform.OS === "web") return unsubscribeOnline;

    const appSub = AppState.addEventListener("change", (status) => {
      if (status === "active" && onlineManager.isOnline()) {
        void flushOfflineCheckins(accountId);
      }
    });
    return () => {
      unsubscribeOnline();
      appSub.remove();
    };
  }, [accountId]);
}
