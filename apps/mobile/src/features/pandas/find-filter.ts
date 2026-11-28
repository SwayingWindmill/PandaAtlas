import type { components } from "@zhipanda/api-client";

import type { MapItem } from "@/features/map/model";
import { areaChips } from "@/features/pandas/areas";
import { type PandaListItem, normalizeTerm } from "@/features/pandas/pandas";
import { SPECIAL_CHIPS, type SpecialChips, isSpecialChip } from "@/features/pandas/special-chips";

type Institution = components["schemas"]["PublicInstitutionSummaryDto"];

const KIND_ZH: Record<NonNullable<Institution["profile"]>["kind"], string> = {
  zoo: "动物园",
  breeding_center: "繁育研究基地",
  wildlife_park: "野生动物园",
};

const COUNTRY_ZH: Record<string, string> = {
  CN: "中国",
  US: "美国",
  JP: "日本",
  KR: "韩国",
  GB: "英国",
  DE: "德国",
  FR: "法国",
};

const ATTRIBUTE_CHIPS = new Set<string>(["在世", "有照片", ...SPECIAL_CHIPS]);

export type FindFilterItem = Pick<PandaListItem, "area" | "slug" | "deceased" | "hasFullBleedCover">;

export interface FindVenueMatch {
  slug: string;
  name: string;
  countryLabel: string | null;
  kindLabel: string | null;
  liveCamUrl: string | null;
  residentCount: number;
  leadPanda: { id: string; name: string } | null;
}

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

export function isAttributeFindChip(chip: string): boolean {
  return ATTRIBUTE_CHIPS.has(chip);
}

export function isLocationFindChip(chip: string): boolean {
  return chip !== "全部" && !ATTRIBUTE_CHIPS.has(chip);
}

export function hasActiveFindFilter(selected: readonly string[]): boolean {
  return selected.some((chip) => chip !== "全部");
}

/** Toggles a filter chip; selecting "全部" clears every active filter. */
export function toggleFindChip(selected: readonly string[], chip: string): string[] {
  if (chip === "全部") return [];
  return selected.includes(chip)
    ? selected.filter((item) => item !== chip)
    : [...selected.filter((item) => item !== "全部"), chip];
}

/** Matches one panda against a single filter chip on 找熊猫. */
export function matchesFindChip(
  panda: FindFilterItem,
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

/**
 * Multi-dimensional combinable filter:
 * - Location chips (`在中国`, `在海外`, regional areas) combine via OR (union).
 * - Attribute chips (`在世`, `有照片`, `双胞胎`, `归国`) combine via AND (intersection).
 * - Combined filter requires `(selectedLocations.length === 0 || matchesAnyLocation) && matchesAllAttributes`.
 */
export function matchesFindFilters(
  panda: FindFilterItem,
  selected: readonly string[],
  special: SpecialChips,
): boolean {
  const active = selected.filter((chip) => chip !== "全部");
  if (active.length === 0) return true;
  const locations = active.filter(isLocationFindChip);
  const attributes = active.filter(isAttributeFindChip);
  const matchesLocation = locations.length === 0 || locations.some((chip) => matchesFindChip(panda, chip, special));
  const matchesAttributes = attributes.every((chip) => matchesFindChip(panda, chip, special));
  return matchesLocation && matchesAttributes;
}

export function filterPandasMulti<T extends FindFilterItem>(
  pandas: readonly T[],
  selected: readonly string[],
  special: SpecialChips,
): T[] {
  return pandas.filter((panda) => matchesFindFilters(panda, selected, special));
}

/** Backwards-compatible wrapper accepting either a single chip name or an active chip list. */
export function filterPandas<T extends FindFilterItem>(
  pandas: readonly T[],
  chipOrSelected: string | readonly string[],
  special: SpecialChips,
): T[] {
  const selected =
    typeof chipOrSelected === "string"
      ? chipOrSelected === "全部"
        ? []
        : [chipOrSelected]
      : chipOrSelected;
  return filterPandasMulti(pandas, selected, special);
}

/** Matches venues against a search query for 找熊猫 unified aggregate search, ranked by hit quality then resident count. */
export function matchFindVenues(
  institutions: readonly Institution[],
  mapItems: readonly MapItem[] | undefined,
  query: string,
): FindVenueMatch[] {
  const needle = normalizeTerm(query);
  if (!needle) return [];

  const mapBySlug = new Map<string, MapItem>();
  for (const item of mapItems ?? []) {
    if (item.kind === "institution") mapBySlug.set(item.slug, item);
  }

  const matched: { match: FindVenueMatch; rank: number }[] = [];
  for (const inst of institutions) {
    const name = inst.nameZh ?? inst.nameEn ?? inst.slug;
    const countryLabel = inst.countryCode ? (COUNTRY_ZH[inst.countryCode] ?? null) : null;
    const kindLabel = inst.profile ? KIND_ZH[inst.profile.kind] : null;
    const terms = [name, inst.nameZh, inst.nameEn, inst.slug, countryLabel, kindLabel]
      .filter((value): value is string => Boolean(value))
      .map(normalizeTerm)
      .filter(Boolean);

    let rank: number | null = null;
    if (terms.some((term) => term === needle)) rank = 0;
    else if (terms.some((term) => term.startsWith(needle))) rank = 1;
    else if (terms.some((term) => term.includes(needle))) rank = 2;
    if (rank === null) continue;

    const mapItem = mapBySlug.get(inst.slug);
    const lead = mapItem
      ? (mapItem.residents.find((panda) => panda.hasFullBleedCover) ?? mapItem.residents[0] ?? null)
      : null;

    matched.push({
      rank,
      match: {
        slug: inst.slug,
        name,
        countryLabel,
        kindLabel,
        liveCamUrl: inst.profile?.liveCamUrl ?? null,
        residentCount: mapItem?.residentCount ?? 0,
        leadPanda: lead ? { id: lead.id, name: lead.name } : null,
      },
    });
  }

  return matched
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        right.match.residentCount - left.match.residentCount ||
        left.match.name.localeCompare(right.match.name, "zh-CN"),
    )
    .map(({ match }) => match);
}
