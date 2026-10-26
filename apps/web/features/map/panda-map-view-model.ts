import { projectToWorld } from "@/features/map/world-land.generated";
import type { PublicMapEntry } from "@/features/public-content/public-v2";
import type { PublicLocale } from "@/foundation/content/locales";

export interface PandaMapItem {
  id: string;
  href: string;
  name: string;
  alternateName: string | null;
  /** Where it is, for example "美国" or "Washington, DC, United States". */
  where: string | null;
  overseas: boolean;
  residentCount: number;
  /** For example "宝力、青宝" or "Bao Li, Qing Bao and 2 more". */
  residentNames: string | null;
  /** The panda whose photo represents the place. */
  coverPandaId: string | null;
  point: { x: number; y: number } | null;
}

/** Dots closer than this, in outline units, are drawn as one: 34 units keep 24px tap targets apart on a phone. */
const CLUSTER_DISTANCE = 34;

export interface PandaMapCluster {
  id: string;
  /** Position as a share of the outline's width and height, for placing an HTML dot over the SVG. */
  left: number;
  top: number;
  residentCount: number;
  items: PandaMapItem[];
}

export interface PandaMapViewModel {
  items: PandaMapItem[];
  clusters: PandaMapCluster[];
  /** Places where pandas live now, all and outside China. */
  livingPlaces: number;
  livingPlacesOverseas: number;
}

function countryName(code: string | null, locale: PublicLocale): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale === "zh" ? "zh-CN" : "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function pair(zh: string | null, en: string | null, locale: PublicLocale) {
  const display = (locale === "zh" ? zh ?? en : en ?? zh) ?? "";
  const alternate = locale === "zh" ? en : zh;
  return { display, alternate: alternate && alternate !== display ? alternate : null };
}

function residentNames(entry: PublicMapEntry, locale: PublicLocale): string | null {
  const names = entry.residents.map((panda) => (locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh));
  if (!names.length) return null;
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  if (locale === "zh") return more ? `${shown.join("、")} 等 ${names.length} 只` : shown.join("、");
  if (more) return `${shown.join(", ")} and ${more} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : shown[0] ?? null;
}

export function buildPandaMapViewModel(
  entries: PublicMapEntry[],
  locale: PublicLocale,
  dimensions: { width: number; height: number },
): PandaMapViewModel {
  const items = entries.map((entry): PandaMapItem => {
    const name = pair(entry.nameZh, entry.nameEn, locale);
    const country = countryName(entry.countryCode, locale);
    // Regions are published in English only, so the Chinese page names the country alone.
    const where = locale === "zh" ? country : [entry.region, country].filter(Boolean).join(", ") || null;
    const first = entry.points[0];
    return {
      id: `${entry.kind}:${entry.id}`,
      href: `/${locale}/${entry.kind === "institution" ? "institutions" : "places"}/${entry.slug}`,
      name: name.display || entry.slug,
      alternateName: name.alternate,
      where,
      overseas: entry.countryCode !== null && entry.countryCode !== "CN",
      residentCount: entry.residents.length,
      residentNames: residentNames(entry, locale),
      coverPandaId: entry.residents[0]?.id ?? null,
      point: first ? projectToWorld(first.longitude, first.latitude) : null,
    };
  });
  items.sort((left, right) => right.residentCount - left.residentCount || left.name.localeCompare(right.name, locale));

  // Greedy clustering, biggest places first, so a busy base keeps its own position.
  const clusters: Array<{ x: number; y: number; items: PandaMapItem[] }> = [];
  for (const item of items) {
    if (!item.point) continue;
    const near = clusters.find((cluster) =>
      Math.hypot(cluster.x - item.point!.x, cluster.y - item.point!.y) < CLUSTER_DISTANCE);
    if (near) near.items.push(item);
    else clusters.push({ x: item.point.x, y: item.point.y, items: [item] });
  }

  const living = items.filter((item) => item.residentCount > 0);
  return {
    items,
    clusters: clusters.map((cluster) => ({
      id: cluster.items.map((item) => item.id).join("+"),
      left: (cluster.x / dimensions.width) * 100,
      top: (cluster.y / dimensions.height) * 100,
      residentCount: cluster.items.reduce((total, item) => total + item.residentCount, 0),
      items: cluster.items,
    })),
    livingPlaces: living.length,
    livingPlacesOverseas: living.filter((item) => item.overseas).length,
  };
}
