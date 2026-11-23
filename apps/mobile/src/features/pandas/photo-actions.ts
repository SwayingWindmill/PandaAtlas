import { Directory, File, Paths } from "expo-file-system";
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

// The app the photo was shared to may still be reading it after the share sheet resolves, so a shared
// copy stays until the next share or save clears it. Built on call: Paths.cache throws on web.
function clearSharedCopies(): Directory {
  const shared = new Directory(Paths.cache, "shared-photos");
  if (shared.exists) shared.delete();
  return shared;
}

function downloadOriginal(photo: Photo, name: string, to: Directory): Promise<File> {
  return File.downloadFileAsync(photo.url, new File(to, fileName(photo, name)), { idempotent: true });
}

export async function sharePhoto(photo: Photo, name: string): Promise<void> {
  if (Platform.OS === "web") {
    await downloadInBrowser(photo, name);
    return;
  }
  const shared = clearSharedCopies();
  shared.create();
  const file = await downloadOriginal(photo, name, shared);
  if (Platform.OS === "ios") await Share.share({ url: file.uri, message: shareText(photo, name) });
  else await shareAsync(file.uri, { dialogTitle: shareText(photo, name) });
}

export async function savePhoto(photo: Photo, name: string): Promise<SaveOutcome> {
  if (Platform.OS === "web") return downloadInBrowser(photo, name);
  clearSharedCopies();
  const permission = await requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted) return permission.canAskAgain ? "denied" : "blocked";
  const file = await downloadOriginal(photo, name, Paths.cache);
  try {
    await Asset.create(file.uri);
  } finally {
    if (file.exists) file.delete();
  }
  return "saved";
}
