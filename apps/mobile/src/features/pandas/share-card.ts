import * as Clipboard from "expo-clipboard";
import { shareAsync } from "expo-sharing";
import type { ComponentRef, RefObject } from "react";
import { PixelRatio, Platform, Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { downloadOnWeb } from "@/lib/download";

const WEBSITE = "https://www.zhipanda.com/zh/pandas";
/** The PNG is this wide on every phone, so a QR module is about 5 px whatever the screen's density. */
const EXPORT_WIDTH = 1080;

export function profileUrl(slug: string): string {
  return `${WEBSITE}/${slug}`;
}

/**
 * The export size: `captureRef` ignores a width given without a height on Android and web, and iOS reads the
 * size in points, so it gets the pixel size divided by the screen's scale.
 */
async function exportSize(card: RefObject<ComponentRef<typeof View> | null>) {
  const aspect = await new Promise<number>((resolve, reject) => {
    if (!card.current) return reject(new Error("The share card is not mounted."));
    card.current.measure((_x, _y, width, height) => resolve(height / width));
  });
  const scale = Platform.OS === "ios" ? PixelRatio.get() : 1;
  return { width: EXPORT_WIDTH / scale, height: Math.round(EXPORT_WIDTH * aspect) / scale };
}

/** Turns the rendered card into a PNG and hands it on: the share sheet on phones, a download on web. */
export async function shareCardImage(card: RefObject<ComponentRef<typeof View> | null>, slug: string): Promise<void> {
  const size = await exportSize(card);
  if (Platform.OS === "web") {
    const dataUri = await captureRef(card, { format: "png", result: "data-uri", ...size });
    downloadOnWeb(dataUri, `zhipanda-${slug}.png`);
    return;
  }
  const uri = await captureRef(card, { format: "png", result: "tmpfile", ...size });
  await shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
}

function linkMessage(name: string, slug: string): string {
  return `${name} ${profileUrl(slug)}`;
}

export async function shareLink(name: string, slug: string): Promise<void> {
  await Share.share({ message: linkMessage(name, slug) });
}

/** Resolves true on web's `execCommand` fallback and on native, so a refused copy shows only as a throw. */
export function copyLink(name: string, slug: string): Promise<boolean> {
  return Clipboard.setStringAsync(linkMessage(name, slug));
}
