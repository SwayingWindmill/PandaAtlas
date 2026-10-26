import type { components } from "@zhipanda/api-client";

// 找熊猫's area chips (卧龙, 成都, 雅安, 北京, 海外): where a panda lives now, grouped the way fans name the bases.

type Place = components["schemas"]["PublicPlaceSummaryDto"];

const AREA_ZH: Record<string, string> = { Wolong: "卧龙", "Ya'an": "雅安", Chengdu: "成都", Beijing: "北京" };

/** "Wolong, Sichuan" → 卧龙; a facility outside China → 海外; an area without a Chinese name stays unlisted. */
export function areaOf(place: Place | undefined): string | null {
  if (!place || place.placeType !== "facility") return null;
  if (place.countryCode && place.countryCode !== "CN") return "海外";
  const first = place.region?.split(",")[0]?.trim();
  return first ? (AREA_ZH[first] ?? null) : null;
}

/** The area chips worth showing: only areas some listed panda lives in, in a fixed order, 海外 last. */
export function areaChips(items: { area: string | null }[]): string[] {
  const present = new Set(items.flatMap((item) => (item.area ? [item.area] : [])));
  return [...Object.values(AREA_ZH), "海外"].filter((area) => present.has(area));
}
