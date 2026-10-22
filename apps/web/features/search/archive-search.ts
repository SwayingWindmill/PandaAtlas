import type { ArchiveSearchKind, ArchiveSearchResult } from "@/components/command-menu-04";
import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaDetail, PublicEntityName, PublicFacilitySummary, PublicFamilyStoryRecord } from "@/lib/types";
import { localizedEditorial } from "@/features/public-experiences/stories";

export type SearchKind = Extract<ArchiveSearchKind, "panda" | "family" | "place">;
export type SearchKindFilter = "all" | SearchKind;

export const SEARCH_KINDS: readonly SearchKind[] = ["panda", "family", "place"];
export const SEARCH_QUERY_MAX_LENGTH = 80;

export interface SearchQueryState {
  q: string;
  type: SearchKindFilter;
}

interface SearchEntry {
  result: ArchiveSearchResult & { kind: SearchKind };
  terms: string[];
}

export interface SearchSource {
  pandas: PandaDetail[];
  facilities: PublicFacilitySummary[];
  stories: PublicFamilyStoryRecord[];
  familyMembers: Map<string, PandaDetail[]>;
}

export interface SearchViewModel {
  results: ArchiveSearchResult[];
  counts: Record<SearchKindFilter, number>;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function parseSearchQuery(raw: RawSearchParams): SearchQueryState {
  const type = first(raw.type);
  return {
    q: first(raw.q).trim().slice(0, SEARCH_QUERY_MAX_LENGTH),
    type: (SEARCH_KINDS as readonly string[]).includes(type) ? type as SearchKind : "all",
  };
}

export function searchHref(locale: PublicLocale, state: SearchQueryState): string {
  const query = new URLSearchParams();
  if (state.q) query.set("q", state.q);
  if (state.type !== "all") query.set("type", state.type);
  const search = query.toString();
  return `/${locale}/search${search ? `?${search}` : ""}`;
}

export function normalizeSearchTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[\s_\-:·.,'’]+/g, "");
}

function localizedName(names: PublicEntityName[], locale: PublicLocale): string | null {
  const preferred = locale === "zh" ? ["zh-Hans", "zh-CN", "zh"] : ["en", "en-US", "en-GB"];
  for (const language of preferred) {
    const item = names.find((name) => name.language === language);
    if (item?.value) return item.value;
  }
  return names[0]?.value ?? null;
}

function pandaName(panda: PandaDetail, locale: PublicLocale): string {
  return locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
}

function buildEntries(source: SearchSource, locale: PublicLocale): SearchEntry[] {
  const zh = locale === "zh";
  const facilitiesById = new Map(source.facilities.map((facility) => [facility.id, facility]));
  const pandaCountByFacility = new Map<string, number>();
  for (const panda of source.pandas) {
    const facilityIds = new Set(panda.residencies.flatMap((residency) => residency.facility_id ? [residency.facility_id] : []));
    for (const id of facilityIds) pandaCountByFacility.set(id, (pandaCountByFacility.get(id) ?? 0) + 1);
  }

  const pandas: SearchEntry[] = source.pandas.map((panda) => {
    const name = pandaName(panda, locale);
    const alternateName = zh ? panda.name_en : panda.name_zh;
    const facility = facilitiesById.get(panda.current_place?.facility_id ?? "");
    const place = (facility ? localizedName(facility.names, locale) : null)
      ?? panda.current_place?.coarse_location
      ?? panda.current_location;
    return {
      result: {
        id: `panda-${panda.id}`,
        kind: "panda",
        title: name,
        snippet: [alternateName && alternateName !== name ? alternateName : null, place].filter(Boolean).join(" · ")
          || (zh ? "熊猫主页" : "Panda profile"),
        meta: panda.birth_date?.slice(0, 4) ?? null,
        href: `/${locale}/pandas/${panda.slug}`,
      },
      terms: [panda.slug, panda.name_zh, panda.name_en ?? "", ...(panda.search_terms ?? [])],
    };
  });

  const families: SearchEntry[] = source.stories.flatMap((story) => {
    const members = source.familyMembers.get(story.id) ?? [];
    if (!members.length) return [];
    const content = localizedEditorial(story.localized_content, locale);
    return [{
      result: {
        id: `family-${story.id}`,
        kind: "family" as const,
        title: content.title,
        snippet: members.slice(0, 4).map((member) => pandaName(member, locale)).join(" · "),
        meta: zh ? `${members.length} 位成员` : `${members.length} members`,
        href: `/${locale}/families/${story.slug}`,
      },
      terms: [
        story.slug,
        ...story.localized_content.map((item) => item.title),
        ...members.flatMap((member) => [member.slug, member.name_zh, member.name_en ?? ""]),
      ],
    }];
  });

  // Coarse locations ("China", free-text sites) are residency placeholders, not places with a page.
  const places: SearchEntry[] = source.facilities
    .filter((facility) => facility.facility_type !== "coarse_location")
    .flatMap((facility) => {
      const name = localizedName(facility.names, locale);
      if (!name) return [];
      const pandaCount = pandaCountByFacility.get(facility.id) ?? 0;
      return [{
        result: {
          id: `place-${facility.id}`,
          kind: "place" as const,
          title: name,
          snippet: [
            facility.locality,
            pandaCount
              ? zh
                ? `${pandaCount} 只已公开熊猫在这里生活过`
                : `${pandaCount} published ${pandaCount === 1 ? "panda" : "pandas"} lived here`
              : null,
          ].filter(Boolean).join(" · ") || (zh ? "地点主页" : "Place page"),
          meta: facility.country_code,
          href: `/${locale}/places/${facility.canonical_slug}`,
        },
        terms: [facility.canonical_slug, ...facility.names.map((item) => item.value), facility.locality ?? ""],
      }];
    });

  return [...pandas, ...families, ...places];
}

function rank(entry: SearchEntry, needle: string): number | null {
  const terms = entry.terms.map(normalizeSearchTerm).filter(Boolean);
  if (terms.includes(needle)) return 0;
  if (terms.some((term) => term.startsWith(needle))) return 1;
  if (terms.some((term) => term.includes(needle))) return 2;
  return null;
}

export function buildSearchViewModel(
  source: SearchSource,
  state: SearchQueryState,
  locale: PublicLocale,
): SearchViewModel {
  const counts: Record<SearchKindFilter, number> = { all: 0, panda: 0, family: 0, place: 0 };
  const needle = normalizeSearchTerm(state.q);
  if (!needle) return { results: [], counts };

  const collator = new Intl.Collator(locale === "zh" ? "zh-CN" : "en", { sensitivity: "base", numeric: true });
  const kindOrder = new Map(SEARCH_KINDS.map((kind, index) => [kind, index]));
  const matches = buildEntries(source, locale).flatMap((entry) => {
    const score = rank(entry, needle);
    return score === null ? [] : [{ entry, score }];
  });
  for (const { entry } of matches) {
    counts[entry.result.kind] += 1;
    counts.all += 1;
  }

  return {
    results: matches
      .filter(({ entry }) => state.type === "all" || entry.result.kind === state.type)
      .sort((left, right) =>
        left.score - right.score
        || kindOrder.get(left.entry.result.kind)! - kindOrder.get(right.entry.result.kind)!
        || collator.compare(left.entry.result.title, right.entry.result.title))
      .map(({ entry }) => entry.result),
    counts,
  };
}
