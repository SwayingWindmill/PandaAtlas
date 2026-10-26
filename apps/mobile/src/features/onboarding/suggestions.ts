import type { PandaListItem } from "@/features/pandas/pandas";

/** Pandas to offer before the fan searches: living ones that can be visited, youngest first. */
export function suggestions(pandas: PandaListItem[], limit = 12): PandaListItem[] {
  return pandas
    .filter((panda) => !panda.deceased && panda.place !== null)
    .sort((a, b) => (b.birthDate ?? "").localeCompare(a.birthDate ?? ""))
    .slice(0, limit);
}
