import { shareAsync } from "expo-sharing";
import type { ComponentRef, RefObject } from "react";
import { Platform, Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

const WEBSITE = "https://www.zhipanda.com/zh/pandas";

export function profileUrl(slug: string): string {
  return `${WEBSITE}/${slug}`;
}

/** Turns the rendered card into a PNG and hands it on: the share sheet on phones, a download on web. */
export async function shareCardImage(card: RefObject<ComponentRef<typeof View> | null>, slug: string): Promise<void> {
  if (Platform.OS === "web") {
    const dataUri = await captureRef(card, { format: "png", result: "data-uri" });
    const link = document.createElement("a");
    link.href = dataUri;
    link.download = `zhipanda-${slug}.png`;
    link.click();
    return;
  }
  const uri = await captureRef(card, { format: "png", result: "tmpfile" });
  await shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
}

export async function shareLink(name: string, slug: string): Promise<void> {
  await Share.share({ message: `${name} ${profileUrl(slug)}` });
}
