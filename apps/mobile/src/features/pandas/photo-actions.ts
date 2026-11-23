import { File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { shareAsync } from "expo-sharing";
import { Platform, Share } from "react-native";

import { fileName, shareText } from "@/features/pandas/photo-viewer";
import type { Photo } from "@/features/pandas/profile";
import { downloadOnWeb } from "@/lib/download";

export type SaveOutcome = "saved" | "downloaded" | "opened" | "denied" | "blocked";

// Some browsers start reading a blob URL only after click() returns, so it is revoked a moment later.
const REVOKE_AFTER_MS = 60_000;

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
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  return "downloaded";
}

async function withCachedOriginal<T>(photo: Photo, name: string, act: (file: File) => Promise<T>): Promise<T> {
  const file = await File.downloadFileAsync(photo.url, new File(Paths.cache, fileName(photo, name)), { idempotent: true });
  try {
    return await act(file);
  } finally {
    if (file.exists) file.delete();
  }
}

/** Hands the original photo to the share sheet with the panda's name and the credit. On web it downloads. */
export async function sharePhoto(photo: Photo, name: string): Promise<void> {
  if (Platform.OS === "web") {
    await downloadInBrowser(photo, name);
    return;
  }
  await withCachedOriginal(photo, name, async (file) => {
    if (Platform.OS === "ios") await Share.share({ url: file.uri, message: shareText(photo, name) });
    else await shareAsync(file.uri, { dialogTitle: shareText(photo, name) });
  });
}

/** Saves the original photo to the photo library, asking only to add photos. On web it downloads. */
export async function savePhoto(photo: Photo, name: string): Promise<SaveOutcome> {
  if (Platform.OS === "web") return downloadInBrowser(photo, name);
  const permission = await requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted) return permission.canAskAgain ? "denied" : "blocked";
  await withCachedOriginal(photo, name, (file) => Asset.create(file.uri));
  return "saved";
}
