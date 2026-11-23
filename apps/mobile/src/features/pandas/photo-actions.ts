import { File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { shareAsync } from "expo-sharing";
import { Platform } from "react-native";

import type { Photo } from "@/features/pandas/profile";
import { downloadOnWeb } from "@/lib/download";

export type SaveOutcome = "saved" | "downloaded" | "opened" | "denied" | "blocked";

function fileName(photo: Photo, name: string): string {
  const extension = /\.(jpe?g|png|webp|heic|gif)(?:$|[?#])/i.exec(photo.url)?.[1]?.toLowerCase() ?? "jpg";
  return `zhipanda-${name}-${photo.id}.${extension}`;
}

// A cross-origin <a download> opens the image instead of saving it, so the bytes go through a blob URL.
// A media host that refuses CORS to this origin leaves only opening the original in a new tab.
async function downloadInBrowser(photo: Photo, name: string): Promise<"downloaded" | "opened"> {
  const response = await fetch(photo.url).catch(() => null);
  if (!response) {
    const tab = window.open(photo.url, "_blank");
    if (!tab) throw new Error(`Photo ${photo.id}: the browser blocked the new tab`);
    tab.opener = null;
    return "opened";
  }
  if (!response.ok) throw new Error(`Photo ${photo.id} unavailable: ${response.status}`);
  const url = URL.createObjectURL(await response.blob());
  downloadOnWeb(url, fileName(photo, name));
  URL.revokeObjectURL(url);
  return "downloaded";
}

async function downloadToCache(photo: Photo, name: string): Promise<File> {
  return File.downloadFileAsync(photo.url, new File(Paths.cache, fileName(photo, name)), { idempotent: true });
}

/** Hands the original photo to the share sheet, its credit as the sheet's title where the platform shows one. */
export async function sharePhoto(photo: Photo, name: string): Promise<void> {
  if (Platform.OS === "web") {
    await downloadInBrowser(photo, name);
    return;
  }
  const file = await downloadToCache(photo, name);
  await shareAsync(file.uri, { dialogTitle: photo.credit ?? name });
}

/** Saves the original photo to the photo library, asking only to add photos. On web it downloads. */
export async function savePhoto(photo: Photo, name: string): Promise<SaveOutcome> {
  if (Platform.OS === "web") return downloadInBrowser(photo, name);
  const permission = await requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted) return permission.canAskAgain ? "denied" : "blocked";
  const file = await downloadToCache(photo, name);
  await Asset.create(file.uri);
  return "saved";
}
