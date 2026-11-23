import type { components } from "@zhipanda/api-client";

// Worst-case public data for stress-testing screens (the break-ui skill). It rewrites real API responses at the
// boundary the app reads them from: the preview proxy (`preview-production.mjs --worst-case`) and the
// worst-case journeys. Every value is one production holds today or the shape it will take next: names are
// unbounded in the schema, only 452/942 pandas have a birth date, 549/942 a life status and 147/942 a cover.
// Dev and test only; the app never imports it.

type Schemas = components["schemas"];
type Panda = Schemas["PublicPandaSummaryDto"];
type Name = Schemas["PublicPandaNameDto"];
type Venue = Schemas["PublicInstitutionSummaryDto"] | Schemas["PublicPlaceSummaryDto"];

export const LONG_NAMES: [string, string][] = [
  ["Shin Shin and Ri Ri's unnamed male cub", "2016 Ai Bang's Cub / 爱浜2016仔"],
  ["Fu Duo Duo / Pu Pu", "福多多（噗噗）"],
  ["Chuan Chuan (Yun Chuan)", "川川（云川）"],
];
const ONE_CHAR: [string, string] = ["Bao", "宝"];
const ALIASES = ["Little Miracle", "Xiao Qi Ji", "小奇迹", "奇奇", "Qiqi", "ミラクル", "기적", "Baby Q"];
export const LONG_VENUE = {
  nameZh: "史密森国家动物园与保护生物学研究所大熊猫馆（亚洲步道）",
  nameEn: "Smithsonian's National Zoo and Conservation Biology Institute — Asia Trail Giant Panda Habitat",
  region: "Washington, District of Columbia, United States of America",
};
const DROPPED_FACTS = new Set(["birth_date", "life_status", "sex"]);
export const RELATIVE_COUNT = 32;
export const RESIDENT_COUNT = 120;

function names([en, zh]: [string, string]): Name[] {
  return [
    { value: en, nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: zh, nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
  ];
}

function withAliases(panda: Panda): Name[] {
  return [...panda.names, ...ALIASES.map((value) => ({ value, nameKind: "nickname", isPrimary: false, languageTag: "zh-Hans" }))];
}

function longName(index: number): [string, string] {
  return LONG_NAMES[index % LONG_NAMES.length]!;
}

// The list's first rows carry one failure each, as real data mixes them; the rest repeat the cycle.
function worstPanda(panda: Panda, index: number): Panda {
  switch (index % 6) {
    case 0:
      return { ...panda, names: names(longName(Math.floor(index / 6))) };
    case 1:
      return { ...panda, facts: panda.facts.filter((fact) => !DROPPED_FACTS.has(fact.fieldKey)), hasFullBleedCover: false };
    case 2:
      return { ...panda, names: withAliases(panda) };
    case 3:
      return { ...panda, names: names(ONE_CHAR), hasFullBleedCover: false };
    case 4:
      return { ...panda, names: names(longName(1)), facts: [] };
    default:
      return panda;
  }
}

/** A stable made-up UUID per panda and index, so a profile's cubs and the lineage's cubs are the same pandas. */
function fakeId(seed: string, index: number): string {
  const hex = (seed.replace(/[^0-9a-f]/g, "") + "0".repeat(32)).slice(0, 20);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${String(index).padStart(12, "0")}`;
}

function worstVenue<T extends Venue>(venue: T): T {
  return { ...venue, nameZh: LONG_VENUE.nameZh, nameEn: LONG_VENUE.nameEn, ...("region" in venue ? { region: LONG_VENUE.region } : {}) };
}

function worstProfile(body: Schemas["PublicPandaDetailDto"]): Schemas["PublicPandaDetailDto"] {
  const { panda } = body;
  const cubs = Array.from({ length: RELATIVE_COUNT }, (_, index): Panda => ({
    pandaId: fakeId(panda.pandaId, index),
    canonicalSlug: `${panda.canonicalSlug}-cub-${index + 1}`,
    legacySlugs: [],
    names: index % 3 === 0 ? names(longName(index / 3)) : names([`Cub ${index + 1}`, `幼仔${index + 1}号`]),
    facts:
      index % 2 === 0
        ? []
        : [{ value: `20${10 + (index % 15)}-08-0${1 + (index % 9)}`, status: "confirmed", fieldKey: "birth_date", lastVerifiedOn: "2026-07-26", conclusionVersion: 1 }],
  }));
  return {
    ...body,
    panda: {
      ...panda,
      names: withAliases({ ...panda, names: names(longName(0)) }),
      facts: panda.facts.filter((fact) => !DROPPED_FACTS.has(fact.fieldKey)),
    },
    relatives: [...body.relatives, ...cubs],
  };
}

// Every parent gets the cubs worstProfile adds to its relatives, as Pan Pan fathered dozens.
function worstLineage(body: Schemas["PublicLineageListDto"]): Schemas["PublicLineageListDto"] {
  const parents = new Map(body.items.map((link) => [link.parentId, link]));
  const cubs = [...parents].flatMap(([parentId, { parentRole, sourceIds }]) =>
    Array.from({ length: RELATIVE_COUNT }, (_, index) => ({
      assertionId: `worst-${parentId}-${index}`,
      childId: fakeId(parentId, index),
      parentId,
      parentRole,
      sourceIds,
    })),
  );
  return { ...body, items: [...body.items, ...cubs] };
}

function worstInstitution(body: Schemas["PublicInstitutionDetailDto"]): Schemas["PublicInstitutionDetailDto"] {
  const [first] = body.residents;
  const residents = first
    ? Array.from({ length: RESIDENT_COUNT }, (_, index) => ({
        ...worstPanda(body.residents[index % body.residents.length]!, index),
        pandaId: fakeId(first.pandaId, index),
        canonicalSlug: `${first.canonicalSlug}-${index}`,
      }))
    : [];
  return { ...body, institution: worstVenue(body.institution), places: body.places.map(worstVenue), residents };
}

/** The public read paths it rewrites; anything else passes through unchanged. */
export const WORST_CASE_PATHS = /\/api\/v2\/(pandas|lineage|institutions|places)(\/[^/?]+)?(\?|$)/;

/** The worst case of one public API response, or the body unchanged for a path it leaves alone. */
export function worstCase(pathname: string, body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  if (pathname === "/api/v2/pandas" && "items" in body) {
    const list = body as Schemas["PublicPandaListDto"];
    return { ...list, items: list.items.map(worstPanda) };
  }
  if (pathname === "/api/v2/lineage" && "items" in body) return worstLineage(body as Schemas["PublicLineageListDto"]);
  if (/^\/api\/v2\/pandas\/[^/]+$/.test(pathname) && "panda" in body) return worstProfile(body as Schemas["PublicPandaDetailDto"]);
  if (/^\/api\/v2\/institutions\/[^/]+$/.test(pathname) && "institution" in body) {
    return worstInstitution(body as Schemas["PublicInstitutionDetailDto"]);
  }
  if ((pathname === "/api/v2/institutions" || pathname === "/api/v2/places") && "items" in body) {
    const list = body as { items: Venue[] };
    return { ...list, items: list.items.map((item, index) => (index % 2 === 0 ? worstVenue(item) : item)) };
  }
  return body;
}
