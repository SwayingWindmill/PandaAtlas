import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Platform } from "react-native";

import {
  type LocalVisitPhoto,
  MAX_VISIT_PHOTOS,
  VISIT_PHOTOS_KEY,
  VISIT_PHOTO_COMPRESS,
  type VisitPhotoMap,
  computeResizeWidth,
  getVisitPhotos,
  parseVisitPhotoMap,
  removeVisitPhotosInMap,
  setVisitPhotosInMap,
  visitPhotoKey,
} from "./visit-photos-model";
import {
  registerVisitPhotoFileCleaner,
  registerVisitPhotoStorageListener,
  runVisitPhotoStorageTask,
} from "./visit-photos-storage";

export {
  GUEST_PHOTO_SCOPE,
  MAX_VISIT_PHOTOS,
  VISIT_PHOTOS_KEY,
  type LocalVisitPhoto,
  type VisitPhotoMap,
  photoScopeFor,
} from "./visit-photos-model";
export { migrateSyncedGuestVisitPhotos } from "./visit-photos-storage";

let photosCache: VisitPhotoMap | null = null;
let hydratePromise: Promise<VisitPhotoMap> | null = null;
let snapshotVersion = 0;
const storeListeners = new Set<() => void>();
const EMPTY_MAP: VisitPhotoMap = {};
let snapshot: VisitPhotoMap = EMPTY_MAP;

function publishSnapshot(next: VisitPhotoMap): void {
  snapshotVersion += 1;
  photosCache = next;
  snapshot = { ...next };
  for (const listener of storeListeners) listener();
}

registerVisitPhotoStorageListener((next) => {
  publishSnapshot(next);
});

function subscribe(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

function getSnapshot(): VisitPhotoMap {
  return snapshot;
}

// HOLD: Paths.document throws if instantiated during Web module load.
function visitPhotosDir(): Directory {
  return new Directory(Paths.document, "visit-photos");
}

function createPhotoId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `vp-${Date.now()}-${rand}`;
}

function safeFileId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]+/g, "-") || createPhotoId();
}

function ensurePrivateDir(): Directory {
  const dir = visitPhotosDir();
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
}

async function copyPhotosToPrivateDir(
  photos: readonly LocalVisitPhoto[],
  createdFiles: File[],
): Promise<LocalVisitPhoto[]> {
  if (Platform.OS === "web" || photos.length === 0) {
    return [...photos];
  }
  const dir = ensurePrivateDir();
  const dirPrefix = dir.uri.endsWith("/") ? dir.uri : `${dir.uri}/`;
  const persisted: LocalVisitPhoto[] = [];

  for (const photo of photos) {
    if (photo.uri.startsWith(dirPrefix)) {
      persisted.push(photo);
      continue;
    }
    const target = new File(dir, `${safeFileId(photo.id)}.jpg`);
    await new File(photo.uri).copy(target, { overwrite: true });
    createdFiles.push(target);
    persisted.push({ ...photo, uri: target.uri });
  }
  return persisted;
}

function deletePrivateFiles(photos: readonly LocalVisitPhoto[]): void {
  if (Platform.OS === "web" || photos.length === 0) return;
  let dirPrefix: string;
  try {
    const dir = visitPhotosDir();
    dirPrefix = dir.uri.endsWith("/") ? dir.uri : `${dir.uri}/`;
  } catch {
    return;
  }
  for (const photo of photos) {
    if (!photo.uri.startsWith(dirPrefix)) continue;
    try {
      const file = new File(photo.uri);
      if (file.exists) file.delete();
    } catch {
      // Best-effort cleanup of orphaned local JPEG copies.
    }
  }
}

registerVisitPhotoFileCleaner(deletePrivateFiles);

function revokeWebBlobUris(assets: readonly ImagePicker.ImagePickerAsset[]): void {
  if (Platform.OS !== "web" || typeof URL === "undefined") return;
  for (const asset of assets) {
    if (asset.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
  }
}

async function readStoredMap(): Promise<VisitPhotoMap> {
  if (photosCache) return photosCache;
  if (!hydratePromise) {
    const startVersion = snapshotVersion;
    hydratePromise = AsyncStorage.getItem(VISIT_PHOTOS_KEY)
      .then((raw) => {
        if (photosCache || snapshotVersion !== startVersion) {
          return photosCache ?? {};
        }
        const parsed = parseVisitPhotoMap(raw);
        publishSnapshot(parsed);
        return parsed;
      })
      .catch(() => {
        if (!photosCache && snapshotVersion === startVersion) {
          publishSnapshot({});
        }
        return photosCache ?? {};
      })
      .finally(() => {
        hydratePromise = null;
      });
  }
  return hydratePromise;
}

/** Opens the system photo picker for up to `remainingSlots` images and pre-resizes each to 1200px JPEG. */
export async function pickAndPrepareVisitPhotos(remainingSlots: number): Promise<LocalVisitPhoto[]> {
  const limit = Math.max(0, Math.min(MAX_VISIT_PHOTOS, remainingSlots));
  if (limit === 0) return [];

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 1,
  });
  if (picked.canceled || !picked.assets || picked.assets.length === 0) return [];

  const chosen = picked.assets.slice(0, limit);
  const prepared: LocalVisitPhoto[] = [];
  const createdAt = new Date().toISOString();

  try {
    for (const asset of chosen) {
      const resizeWidth = computeResizeWidth(asset.width);
      const loadOptions = resizeWidth ? { maxWidth: resizeWidth } : undefined;
      const context = ImageManipulator.manipulate(asset.uri, loadOptions);
      try {
        if (resizeWidth) context.resize({ width: resizeWidth });
        const rendered = await context.renderAsync();
        try {
          const saved = await rendered.saveAsync({
            format: SaveFormat.JPEG,
            compress: VISIT_PHOTO_COMPRESS,
            base64: Platform.OS === "web",
          });
          const durableUri =
            Platform.OS === "web" && saved.base64
              ? `data:image/jpeg;base64,${saved.base64}`
              : saved.uri;
          if (Platform.OS === "web" && saved.base64 && saved.uri.startsWith("blob:") && typeof URL !== "undefined") {
            URL.revokeObjectURL(saved.uri);
          }
          prepared.push({
            id: createPhotoId(),
            uri: durableUri,
            width: saved.width,
            height: saved.height,
            createdAt,
          });
        } finally {
          rendered.release();
        }
      } finally {
        context.release();
      }
    }
  } finally {
    revokeWebBlobUris(picked.assets);
  }

  return prepared;
}

/** Persists a visit's local photos under `(scope, placeId, visitedOn)` outside `offline:` cache keys. */
export function saveVisitPhotos(
  scope: string,
  placeId: string,
  visitedOn: string,
  photos: readonly LocalVisitPhoto[],
): Promise<LocalVisitPhoto[]> {
  return runVisitPhotoStorageTask(async () => {
    const current = await readStoredMap();
    const createdFiles: File[] = [];
    let persisted: LocalVisitPhoto[] = [];
    let next: VisitPhotoMap;
    let dropped: LocalVisitPhoto[];
    const key = visitPhotoKey(scope, placeId, visitedOn);
    try {
      persisted = await copyPhotosToPrivateDir(photos.slice(0, MAX_VISIT_PHOTOS), createdFiles);
      const result = setVisitPhotosInMap(current, key, persisted);
      next = result.next;
      dropped = result.dropped;
      await AsyncStorage.setItem(VISIT_PHOTOS_KEY, JSON.stringify(next));
    } catch (error) {
      for (const file of createdFiles) {
        try {
          if (file.exists) file.delete();
        } catch {
          // Ignore rollback cleanup failure.
        }
      }
      throw error;
    }
    publishSnapshot(next);
    deletePrivateFiles(dropped);
    return next[key] ?? [];
  });
}

/** Removes all local photos stored for a deleted visit entry. */
export function clearVisitPhotos(scope: string, placeId: string, visitedOn: string): Promise<void> {
  return runVisitPhotoStorageTask(async () => {
    const current = await readStoredMap();
    const key = visitPhotoKey(scope, placeId, visitedOn);
    const { next, removed } = removeVisitPhotosInMap(current, key);
    if (next === current) return;
    await AsyncStorage.setItem(VISIT_PHOTOS_KEY, JSON.stringify(next));
    publishSnapshot(next);
    deletePrivateFiles(removed);
  });
}

/** Reactive map of all saved local visit photos on this device (React Compiler safe via useSyncExternalStore). */
export function useAllVisitPhotos(): VisitPhotoMap {
  const map = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void readStoredMap();
  }, []);
  return map;
}

/** Reactive photo list for a single visit `(scope, placeId, visitedOn)`. */
export function useVisitPhotos(scope: string, placeId: string | null, visitedOn: string): LocalVisitPhoto[] {
  const map = useAllVisitPhotos();
  return useMemo(() => {
    if (!placeId) return [];
    return getVisitPhotos(map, scope, placeId, visitedOn);
  }, [map, scope, placeId, visitedOn]);
}
