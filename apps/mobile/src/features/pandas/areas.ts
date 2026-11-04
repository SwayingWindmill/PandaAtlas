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

/** The usual Chinese names of the cities abroad that keep pandas, from a facility's region. */
const CITY_ZH: Record<string, string> = {
  Washington: "华盛顿",
  Tokyo: "东京",
  Atlanta: "亚特兰大",
  "San Diego": "圣地亚哥",
  Memphis: "孟菲斯",
  Edinburgh: "爱丁堡",
  Vienna: "维也纳",
  Berlin: "柏林",
  Madrid: "马德里",
  Seoul: "首尔",
};

/**
 * A place as fans say it in a few characters: the area for a Chinese base (卧龙, with 神树坪基地 inside it),
 * the city for a zoo abroad (华盛顿, with the zoo's name). Null when the record has neither.
 */
export function shortPlace(place: Place | undefined): { short: string; sub: string | null } | null {
  if (!place || place.placeType !== "facility") return null;
  const first = place.region?.split(",")[0]?.trim() ?? "";
  const name = place.nameZh ?? null;
  if (place.countryCode && place.countryCode !== "CN") {
    const city = CITY_ZH[first];
    if (city) return { short: city, sub: name };
    return name ? { short: name, sub: null } : null;
  }
  const area = AREA_ZH[first];
  if (!area) return name ? { short: name, sub: null } : null;
  const at = name?.indexOf(area) ?? -1;
  const rest = name && at >= 0 ? name.slice(at + area.length) : "";
  return { short: area, sub: rest || null };
}
