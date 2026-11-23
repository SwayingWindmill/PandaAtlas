import type { PandaListItem } from "@/features/pandas/pandas";
import type { SpecialChips } from "@/features/pandas/special-chips";
import { storyCandidates } from "@/features/today/story-order";

/** Top verified star pandas prioritized in the horizontal strip & daily featured rotation. */
export const STAR_STRIP_SLUGS = [
  "he-hua-chengdu",
  "meng-lan",
  "fu-bao",
  "xiang-xiang",
  "bao-li",
  "qing-bao",
  "he-ye-chengdu",
  "qizai-qinling",
  "ai-bao",
  "le-bao",
  "xiao-xiao",
  "lei-lei",
  "rui-bao",
  "hui-bao",
  "he-feng-vienna",
  "lan-yun-vienna",
  "an-an-hk-2019",
  "ke-ke-hk-2019",
  "ying-ying-hk",
  "le-le-hk",
  "yun-chuan",
  "xin-bao",
  "lun-lun",
  "yang-yang-atlanta",
  "yu-ai-chongqing-2022",
  "yu-ke-chongqing-2022",
] as const;

export const GALLERY_TABS = ["精选", "双胞胎", "在海外", "已归国"] as const;
export type GalleryTab = (typeof GALLERY_TABS)[number];

/** Star pandas for the circular quick-jump strip when the user has not followed any panda yet. */
export function pickStarStrip(
  pandas: readonly PandaListItem[],
  popular: readonly PandaListItem[] = [],
  limit = 10,
): PandaListItem[] {
  const bySlug = new Map(pandas.filter((panda) => !panda.deceased).map((panda) => [panda.slug, panda]));
  const picked: PandaListItem[] = [];
  const seen = new Set<string>();
  const add = (panda: PandaListItem | undefined) => {
    if (!panda || panda.deceased || seen.has(panda.id)) return;
    seen.add(panda.id);
    picked.push(panda);
  };

  for (const slug of STAR_STRIP_SLUGS) add(bySlug.get(slug));
  for (const panda of popular) add(panda);
  for (const panda of pandas) {
    if (picked.length >= limit) break;
    if (panda.hasFullBleedCover) add(panda);
  }
  for (const panda of pandas) {
    if (picked.length >= limit) break;
    add(panda);
  }
  return picked.slice(0, limit);
}

/** One living featured panda with a reviewed full-bleed cover for the top hero card. */
export function pickFeaturedPanda(pandas: readonly PandaListItem[], day: string): PandaListItem | null {
  const pool = pandas.filter((panda) => !panda.deceased && panda.hasFullBleedCover);
  if (pool.length === 0) return null;
  const starSet = new Set<string>(STAR_STRIP_SLUGS);
  const ordered = storyCandidates(pool, day);
  const curated = ordered.filter((panda) => starSet.has(panda.slug));
  return curated[0] ?? ordered[0] ?? null;
}

function matchesGalleryTab(panda: PandaListItem, tab: GalleryTab, special: SpecialChips): boolean {
  if (panda.deceased || !panda.hasFullBleedCover) return false;
  switch (tab) {
    case "精选":
      return true;
    case "双胞胎":
      return special["双胞胎"].has(panda.slug);
    case "在海外":
      return panda.area === "海外";
    case "已归国":
      return special["归国"].has(panda.slug);
  }
}

/** Which gallery filter pills have reviewed full-bleed photos to display. */
export function availableGalleryTabs(pandas: readonly PandaListItem[], special: SpecialChips): GalleryTab[] {
  const hasFullBleed = pandas.some((panda) => !panda.deceased && panda.hasFullBleedCover);
  if (!hasFullBleed) return [];
  return GALLERY_TABS.filter((tab) => {
    if (tab === "精选") return true;
    return pandas.some((panda) => matchesGalleryTab(panda, tab, special));
  });
}

/** Picks up to `count` living full-bleed-ready pandas for the gallery grid. */
export function pickGalleryPandas(
  pandas: readonly PandaListItem[],
  tab: GalleryTab,
  special: SpecialChips,
  day: string,
  count = 4,
): PandaListItem[] {
  const ordered = storyCandidates(
    pandas.filter((panda) => matchesGalleryTab(panda, tab, special)),
    `${day}:${tab}`,
  );
  const starSet = new Set<string>(STAR_STRIP_SLUGS);
  const stars = ordered.filter((panda) => starSet.has(panda.slug));
  const others = ordered.filter((panda) => !starSet.has(panda.slug));
  return [...stars, ...others].slice(0, count);
}
