import type { SeenEntry } from "@/features/engagement/seen";
import type { Visit } from "@/features/visits/visits";

/** Intentionally does not start with `offline:` so `clearOfflineCache()` never erases queued user writes. */
export const OFFLINE_CHECKIN_QUEUE_KEY = "offline-checkin-queue:v1";
export const QUEUED_VISIT_PREFIX = "queued:";

export interface QueuedCheckin {
  key: string;
  accountId: string;
  placeId: string;
  visitedOn: string;
  note: string | null;
  visitSynced: boolean;
  pandaIds: string[];
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export function queuedCheckinKey(accountId: string, placeId: string, visitedOn: string): string {
  return `${accountId}:${placeId}:${visitedOn}`;
}

export function isQueuedVisitId(checkinId: string): boolean {
  return checkinId.startsWith(QUEUED_VISIT_PREFIX);
}

export function queueKeyFromVisitId(checkinId: string): string {
  return checkinId.slice(QUEUED_VISIT_PREFIX.length);
}

export function sortQueuedCheckins(items: readonly QueuedCheckin[]): QueuedCheckin[] {
  return [...items].sort(
    (left, right) => right.visitedOn.localeCompare(left.visitedOn) || right.updatedAt.localeCompare(left.updatedAt),
  );
}

/** Inserts or merges a queued check-in under `(accountId, placeId, visitedOn)` idempotently. */
export function upsertQueuedCheckin(
  list: readonly QueuedCheckin[],
  incoming: {
    accountId: string;
    placeId: string;
    visitedOn: string;
    note?: string | null;
    visitSynced?: boolean;
    pandaIds?: readonly string[];
    lastError?: string;
    nowIso?: string;
  },
): QueuedCheckin[] {
  const key = queuedCheckinKey(incoming.accountId, incoming.placeId, incoming.visitedOn);
  const nowIso = incoming.nowIso ?? new Date().toISOString();
  const trimmedNote = incoming.note?.trim() || null;
  const existing = list.find((item) => item.key === key);

  if (!existing) {
    const pandaIds = [...new Set((incoming.pandaIds ?? []).filter(Boolean))];
    return sortQueuedCheckins([
      ...list,
      {
        key,
        accountId: incoming.accountId,
        placeId: incoming.placeId,
        visitedOn: incoming.visitedOn,
        note: trimmedNote,
        visitSynced: incoming.visitSynced ?? false,
        pandaIds,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...(incoming.lastError ? { lastError: incoming.lastError } : {}),
      },
    ]);
  }

  const mergedPandas = [...new Set([...existing.pandaIds, ...(incoming.pandaIds ?? []).filter(Boolean)])];
  const mergedNote = trimmedNote ?? existing.note;
  // A new non-empty note needs to be synced even if the base visit already existed on the server.
  const needsVisitSync =
    incoming.visitSynced === false ||
    (trimmedNote !== null && trimmedNote !== existing.note);
  const visitSynced = needsVisitSync ? false : existing.visitSynced;

  const updated: QueuedCheckin = {
    ...existing,
    note: mergedNote,
    visitSynced,
    pandaIds: mergedPandas,
    updatedAt: nowIso,
    ...(incoming.lastError ? { lastError: incoming.lastError } : {}),
  };

  return sortQueuedCheckins(list.map((item) => (item.key === key ? updated : item)));
}

export function removeQueuedCheckinByKey(list: readonly QueuedCheckin[], key: string): QueuedCheckin[] {
  return list.filter((item) => item.key !== key);
}

/** Removes synced items or prunes only the pandas that completed so partial failures stay recoverable. */
export function pruneQueuedCheckinProgress(
  list: readonly QueuedCheckin[],
  key: string,
  visitSynced: boolean,
  syncedPandaIds: ReadonlySet<string>,
  lastError?: string,
): QueuedCheckin[] {
  const next: QueuedCheckin[] = [];
  for (const item of list) {
    if (item.key !== key) {
      next.push(item);
      continue;
    }
    const nextVisitSynced = item.visitSynced || visitSynced;
    const remainingPandas = item.pandaIds.filter((id) => !syncedPandaIds.has(id));
    if (nextVisitSynced && remainingPandas.length === 0) continue;
    next.push({
      ...item,
      visitSynced: nextVisitSynced,
      pandaIds: remainingPandas,
      ...(lastError ? { lastError } : {}),
    });
  }
  return sortQueuedCheckins(next);
}

/** Merges server visits with offline-queued visits, deduplicating by `(placeId, visitedOn)`. */
export function mergeVisitsWithQueue(serverVisits: readonly Visit[], queued: readonly QueuedCheckin[]): Visit[] {
  const byPlaceDay = new Map<string, Visit>();
  for (const visit of serverVisits) {
    byPlaceDay.set(`${visit.placeId}|${visit.visitedOn}`, visit);
  }
  for (const item of queued) {
    const compositeKey = `${item.placeId}|${item.visitedOn}`;
    const existing = byPlaceDay.get(compositeKey);
    if (existing) {
      byPlaceDay.set(compositeKey, {
        ...existing,
        note: item.note ?? existing.note,
      });
    } else {
      byPlaceDay.set(compositeKey, {
        checkinId: `${QUEUED_VISIT_PREFIX}${item.key}`,
        placeId: item.placeId,
        visitedOn: item.visitedOn,
        note: item.note,
        createdAt: item.createdAt,
      });
    }
  }
  return [...byPlaceDay.values()].sort(
    (left, right) => right.visitedOn.localeCompare(left.visitedOn) || right.createdAt.localeCompare(left.createdAt),
  );
}

/** Adds locally queued `见过` panda entries so offline visit diary cards display seen pandas immediately. */
export function mergeSeenWithQueue(serverSeen: readonly SeenEntry[], queued: readonly QueuedCheckin[]): SeenEntry[] {
  const existingPairs = new Set(
    serverSeen.map((entry) => `${entry.pandaId}|${entry.seenOn ?? ""}|${entry.placeId ?? ""}`),
  );
  const merged = [...serverSeen];
  for (const item of queued) {
    for (const pandaId of item.pandaIds) {
      const key = `${pandaId}|${item.visitedOn}|${item.placeId}`;
      if (existingPairs.has(key)) continue;
      existingPairs.add(key);
      merged.push({
        pandaId,
        seenOn: item.visitedOn,
        placeId: item.placeId,
        note: null,
      });
    }
  }
  return merged;
}
