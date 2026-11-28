import { shareAsync } from "expo-sharing";
import type { ComponentRef, RefObject } from "react";
import { PixelRatio, Platform, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { downloadOnWeb } from "@/lib/download";

import { ticketFilename } from "./visit-photos-model";

const EXPORT_WIDTH = 1080;

async function measureExportSize(ticketRef: RefObject<ComponentRef<typeof View> | null>) {
  const aspect = await new Promise<number>((resolve, reject) => {
    if (!ticketRef.current) {
      reject(new Error("The souvenir ticket is not mounted."));
      return;
    }
    ticketRef.current.measure((_x, _y, width, height) => {
      if (!width || !height || width <= 0 || height <= 0) {
        reject(new Error("The souvenir ticket has zero size."));
        return;
      }
      resolve(height / width);
    });
  });
  const scale = Platform.OS === "ios" ? PixelRatio.get() : 1;
  return {
    width: EXPORT_WIDTH / scale,
    height: Math.round(EXPORT_WIDTH * aspect) / scale,
  };
}

/** Captures the rendered SouvenirTicket into a high-resolution PNG and hands it to share/download. */
export async function exportTicketImage(
  ticketRef: RefObject<ComponentRef<typeof View> | null>,
  slug: string,
  visitedOn: string,
): Promise<void> {
  const size = await measureExportSize(ticketRef);
  const filename = ticketFilename(slug, visitedOn);
  if (Platform.OS === "web") {
    const dataUri = await captureRef(ticketRef, { format: "png", result: "data-uri", ...size });
    downloadOnWeb(dataUri, filename);
    return;
  }
  const uri = await captureRef(ticketRef, { format: "png", result: "tmpfile", ...size });
  await shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
}
