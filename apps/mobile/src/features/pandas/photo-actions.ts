import { Directory, File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { saveToLibraryAsync } from "expo-media-library/legacy";
import { shareAsync } from "expo-sharing";
import { Platform } from "react-native";

import { fileName, shareText } from "@/features/pandas/photo-viewer";
import type { Photo } from "@/features/pandas/profile";
import { downloadOnWeb } from "@/lib/download";

export type SaveOutcome = "saved" | "downloaded" | "opened" | "denied" | "blocked";

// HOLD: browsers read blob URLs asynchronously after a.click() returns, so immediate revoke cancels downloads.
const REVOKE_AFTER_MS = 60_000;

// HOLD: cross-origin <a download> opens instead of saving, and hosts without CORS headers block fetch().
async function downloadInBrowser(photo: Photo, name: string): Promise<"downloaded" | "opened"> {
  let response: Response;
  try {
    response = await fetch(photo.url);
  } catch (error) {
    if (!(error instanceof TypeError) || (typeof navigator !== "undefined" && !navigator.onLine)) throw error;
    const tab = window.open(photo.url, "_blank");
    if (!tab) throw new Error(`Photo ${photo.id}: the browser blocked the new tab`);
    tab.opener = null;
    return "opened";
  }
  if (!response.ok) throw new Error(`Photo ${photo.id} unavailable: ${response.status}`);
  const url = URL.createObjectURL(await response.blob());
  downloadOnWeb(url, fileName(photo, name));
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  return "downloaded";
}

// HOLD: ExpoFileSystem.web throws if Directory(Paths.cache) runs at module load on web.
function sharedPhotosDir(): Directory {
  return new Directory(Paths.cache, "shared-photos");
}

// HOLD: Android share sheet resolves before target apps finish reading, so shared copies clear on the next action.
function clearSharedPhotos(): void {
  const shared = sharedPhotosDir();
  if (shared.exists) shared.delete();
}

function downloadOriginal(photo: Photo, name: string, to: Directory): Promise<File> {
  return File.downloadFileAsync(photo.url, new File(to, fileName(photo, name)), { idempotent: true });
}

export async function sharePhoto(photo: Photo, name: string): Promise<void> {
  if (Platform.OS === "web") {
    await downloadInBrowser(photo, name);
    return;
  }
  clearSharedPhotos();
  const shared = sharedPhotosDir();
  shared.create();
  const file = await downloadOriginal(photo, name, shared);
  // HOLD: RN Share.share leaks its iOS promise when an activity is picked then cancelled; expo-sharing resolves unconditionally.
  await shareAsync(file.uri, { dialogTitle: shareText(photo, name) });
}

export async function savePhoto(photo: Photo, name: string): Promise<SaveOutcome> {
  if (Platform.OS === "web") return downloadInBrowser(photo, name);
  clearSharedPhotos();
  const permission = await requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted) return permission.canAskAgain ? "denied" : "blocked";
  const file = await downloadOriginal(photo, name, Paths.cache);
  try {
    // HOLD: iOS Asset.create passes raw .webp URLs to PHAssetChangeRequest; saveToLibraryAsync decodes via UIImage first.
    if (Platform.OS === "ios") await saveToLibraryAsync(file.uri);
    else await Asset.create(file.uri);
  } finally {
    if (file.exists) file.delete();
  }
  return "saved";
}
