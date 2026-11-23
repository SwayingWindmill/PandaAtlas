import { areaChips } from "@/features/pandas/areas";
import type { PandaListItem } from "@/features/pandas/pandas";
import { SPECIAL_CHIPS, type SpecialChips, isSpecialChip } from "@/features/pandas/special-chips";

/**
 * Builds the filter chips on 找熊猫: status/photo chips, China vs overseas, active specials, then
 * domestic areas. Overseas cities fold under 在海外 so the horizontal strip stays short.
 */
export function buildFindChips(
  pandas: readonly Pick<PandaListItem, "area" | "deceased" | "hasFullBleedCover">[],
  special: SpecialChips,
): string[] {
  const areas = areaChips([...pandas]);
  const china = areas.filter((area) => area !== "海外");
  const hasLiving = pandas.some((panda) => !panda.deceased);
  const hasPhoto = pandas.some((panda) => panda.hasFullBleedCover);

  return [
    ...(hasLiving ? ["在世"] : []),
    ...(hasPhoto ? ["有照片"] : []),
    ...(china.length > 0 ? ["在中国"] : []),
    ...(areas.includes("海外") ? ["在海外"] : []),
    ...SPECIAL_CHIPS.filter((chip) => special[chip].size > 0),
    ...china,
  ];
}

/** Matches one panda against the active filter chip on 找熊猫. */
export function matchesFindChip(
  panda: Pick<PandaListItem, "area" | "slug" | "deceased" | "hasFullBleedCover">,
  chip: string,
  special: SpecialChips,
): boolean {
  if (chip === "全部") return true;
  if (chip === "在世") return !panda.deceased;
  if (chip === "有照片") return panda.hasFullBleedCover;
  if (isSpecialChip(chip)) return special[chip].has(panda.slug);
  if (chip === "在海外") return panda.area === "海外";
  if (chip === "在中国") return panda.area !== null && panda.area !== "海外";
  return panda.area === chip;
}
