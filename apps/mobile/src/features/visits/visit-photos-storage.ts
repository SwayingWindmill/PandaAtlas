import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  VISIT_PHOTOS_KEY,
  type VisitPhotoMap,
  migrateGuestVisitPhotosInMap,
  parseVisitPhotoMap,
} from "./visit-photos-model";

type StorageSyncListener = (next: VisitPhotoMap) => void;

const listeners = new Set<StorageSyncListener>();
let migrationQueue: Promise<void> = Promise.resolve();

/** Allows the full visit-photo store to mirror changes triggered from storage-only helpers (e.g. guest sync). */
export function registerVisitPhotoStorageListener(listener: StorageSyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyVisitPhotoStorageListeners(next: VisitPhotoMap): void {
  for (const listener of listeners) listener(next);
}

/**
 * Serializes updates against any active storage migration so concurrent guest-to-account sync
 * cannot overwrite photo writes made right after sign-in.
 */
export function runVisitPhotoStorageTask<T>(task: () => Promise<T>): Promise<T> {
  const next = migrationQueue.then(task, task);
  migrationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Re-keys locally stored guest visit photos to the signed-in account when guest check-ins finish syncing. */
export function migrateSyncedGuestVisitPhotos(
  accountId: string,
  visits: readonly { placeId: string; visitedOn: string }[],
): Promise<void> {
  if (!accountId || visits.length === 0) return Promise.resolve();
  return runVisitPhotoStorageTask(async () => {
    const raw = await AsyncStorage.getItem(VISIT_PHOTOS_KEY);
    if (!raw) return;
    const current = parseVisitPhotoMap(raw);
    const { next, changed } = migrateGuestVisitPhotosInMap(current, accountId, visits);
    if (!changed) return;
    await AsyncStorage.setItem(VISIT_PHOTOS_KEY, JSON.stringify(next));
    notifyVisitPhotoStorageListeners(next);
  });
}
