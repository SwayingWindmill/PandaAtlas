import { type PandaListItem, searchPandas } from "@/features/pandas/pandas";

export type ResidentFilter = "all" | "unseen" | "followed";

/** Filters an institution's resident list by search query and seen/followed chip. */
export function filterResidents(
  pandas: readonly PandaListItem[],
  query: string,
  filter: ResidentFilter,
  seen: ReadonlySet<string> | null,
  followed: ReadonlySet<string> | null,
): PandaListItem[] {
  const searched = searchPandas([...pandas], query);
  switch (filter) {
    case "all":
      return searched;
    case "unseen":
      return seen ? searched.filter((panda) => !seen.has(panda.id)) : searched;
    case "followed":
      return followed ? searched.filter((panda) => followed.has(panda.id)) : searched;
  }
}

/** Splits residents into photo tiles (`hasFullBleedCover`) and compact rows (`!hasFullBleedCover`). */
export function splitResidentsByCover(pandas: readonly PandaListItem[]): {
  featured: PandaListItem[];
  compact: PandaListItem[];
} {
  const featured: PandaListItem[] = [];
  const compact: PandaListItem[] = [];
  for (const panda of pandas) {
    if (panda.hasFullBleedCover) featured.push(panda);
    else compact.push(panda);
  }
  return { featured, compact };
}
