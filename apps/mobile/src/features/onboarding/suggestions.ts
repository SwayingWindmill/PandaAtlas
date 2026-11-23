import type { PandaListItem } from "@/features/pandas/pandas";

/** Pandas most fans already know by name, in the order to offer them while nothing is trending. */
export const WELL_KNOWN_SLUGS = [
  "he-hua-chengdu",
  "meng-lan",
  "fu-bao",
  "he-ye-chengdu",
  "qizai-qinling",
  "ya-ya-qinling",
  "yu-ke-chongqing-2022",
  "yu-ai-chongqing-2022",
  "xiang-xiang",
  "mei-xiang",
  "tian-tian",
  "run-yue-yuanrun-offspring-2020",
];

export function fameSlugs(popular: readonly PandaListItem[]): string[] {
  return [...popular.map((panda) => panda.slug), ...WELL_KNOWN_SLUGS];
}

export function wellKnownPandas(pandas: readonly PandaListItem[]): PandaListItem[] {
  const bySlug = new Map(pandas.map((panda) => [panda.slug, panda]));
  return WELL_KNOWN_SLUGS.flatMap((slug) => {
    const panda = bySlug.get(slug);
    return panda && !panda.deceased ? [panda] : [];
  });
}

export function suggestions(pandas: PandaListItem[], popular: readonly PandaListItem[] = [], limit = 12): PandaListItem[] {
  const youngest = pandas
    .filter((panda) => !panda.deceased && panda.place !== null)
    .sort((a, b) => (b.birthDate ?? "").localeCompare(a.birthDate ?? ""));
  const seen = new Set<string>();
  return [...popular.filter((panda) => !panda.deceased), ...wellKnownPandas(pandas), ...youngest]
    .filter((panda) => (seen.has(panda.id) ? false : (seen.add(panda.id), true)))
    .slice(0, limit);
}
