import type { components } from "@zhipanda/api-client";

import type { PandaListItem } from "@/features/pandas/pandas";

type Schemas = components["schemas"];
type Link = Schemas["PublicLineageSummaryDto"];
type Role = Link["parentRole"];

/** How far the 家谱 reaches each way: great-grandparents up, great-grandchildren down. */
export const DEPTH = 3;

/** A relative beyond the one-up, one-down tree, reached through sourced parent links only. */
export interface Kin {
  id: string;
  slug: string;
  name: string;
  sex: "male" | "female" | null;
  birthDate: string | null;
  deceased: boolean;
  /** Where it lives now, if anywhere is known. */
  place: string | null;
  /** 奶奶, 外公, 爷爷的妈妈, 外孙女, 孙子的女儿… */
  relation: string;
  /** Negative up the tree (-1 parents), positive down (1 children). */
  generation: number;
  /** The sources of the link that connects it to the page's panda, never empty. */
  sourceIds: string[];
}

export interface GenerationGroup {
  generation: number;
  title: string;
  members: Kin[];
  /** Ancestors the tree would have here but no published source names. */
  missing: number;
}

export interface Lineage {
  /** Ancestors and descendants, closest generation first; empty generations are left out. */
  groups: GenerationGroup[];
  /** Ancestor generations with at least one known panda. */
  ancestorDepth: number;
  descendantCount: number;
  /** Where living descendants are now, the busiest place first. */
  descendantPlaces: { place: string; count: number }[];
  /** Living descendants whose home is unknown or known only as the country. */
  descendantsUnplaced: number;
  /** Every source behind a link on the page, in first-use order. */
  sourceIds: string[];
  /** The sources of each panda's own sourced parent links, for siblings drawn by the tree. */
  sourcesOfChild: ReadonlyMap<string, string[]>;
}

/** The panda index's name for the country-level coarse place (features/pandas/pandas.ts, placeName). */
const COUNTRY_ONLY = "中国";

const TITLE: Record<number, string> = { [-3]: "曾祖辈", [-2]: "祖辈", [-1]: "父母", 1: "子女", 2: "孙辈", 3: "曾孙辈" };

const PARENT: Record<Role, string> = { father: "爸爸", mother: "妈妈" };
const GRANDPARENT: Record<Role, Record<Role, string>> = {
  father: { father: "爷爷", mother: "奶奶" },
  mother: { father: "外公", mother: "外婆" },
};

function childWord(sex: Kin["sex"]): string {
  return sex === "male" ? "儿子" : sex === "female" ? "女儿" : "孩子";
}

function grandchildWord(viaChild: Kin, sex: Kin["sex"]): string {
  // A son's children are 孙子/孙女, a daughter's 外孙/外孙女; with the parent's sex unknown, 孙辈.
  const outer = viaChild.sex === "female" ? "外" : "";
  if (viaChild.sex === null) return "孙辈";
  return sex === "male" ? (outer ? "外孙" : "孙子") : sex === "female" ? `${outer}孙女` : `${outer}孙辈`;
}

/** A link counts only when a published source backs it: the 家谱 never draws an unsourced relation. */
export function sourcedLinks(links: Link[]): Link[] {
  return links.filter((link) => link.sourceIds.length > 0);
}

/**
 * The page's panda's ancestors and descendants up to `DEPTH` generations each way, from sourced
 * parent links. Parents and children come out too, so the list can stand alone for screen readers.
 */
export function buildLineage(focusId: string, links: Link[], pandas: ReadonlyMap<string, PandaListItem>): Lineage {
  const sourced = sourcedLinks(links);
  const kin = (id: string, relation: string, generation: number, sourceIds: string[]): Kin | null => {
    const panda = pandas.get(id);
    if (!panda) return null;
    const { slug, name, sex, birthDate, deceased, place } = panda;
    return { id, slug, name, sex, birthDate, deceased, place, relation, generation, sourceIds };
  };
  const seen = new Set([focusId]);
  const groups: GenerationGroup[] = [];

  // Up: each known panda has at most a father and a mother on record.
  let row: { id: string; path: Role[]; relation: string }[] = [{ id: focusId, path: [], relation: "" }];
  for (let generation = -1; generation >= -DEPTH && row.length > 0; generation--) {
    const members: Kin[] = [];
    const next: typeof row = [];
    for (const child of row) {
      for (const role of ["father", "mother"] as const) {
        const link = sourced.find((item) => item.childId === child.id && item.parentRole === role);
        if (!link || seen.has(link.parentId)) continue;
        const path = [...child.path, role];
        const relation =
          path.length === 1
            ? PARENT[role]
            : path.length === 2
              ? GRANDPARENT[path[0]!][role]
              : `${child.relation}的${PARENT[role]}`;
        const member = kin(link.parentId, relation, generation, link.sourceIds);
        if (!member) continue;
        seen.add(member.id);
        members.push(member);
        next.push({ id: member.id, path, relation });
      }
    }
    const missing = row.length * 2 - members.length;
    groups.push({ generation, title: TITLE[generation]!, members, missing });
    row = next;
  }

  // Down: every sourced child of a known panda, oldest first.
  const byBirth = (a: Kin, b: Kin) => (a.birthDate ?? "9999").localeCompare(b.birthDate ?? "9999");
  let parents: Kin[] = [];
  const focusKin = kin(focusId, "", 0, []);
  if (focusKin) parents = [focusKin];
  for (let generation = 1; generation <= DEPTH && parents.length > 0; generation++) {
    const members: Kin[] = [];
    for (const parent of parents) {
      for (const link of sourced.filter((item) => item.parentId === parent.id)) {
        if (seen.has(link.childId)) continue;
        const panda = pandas.get(link.childId);
        if (!panda) continue;
        const relation =
          generation === 1
            ? childWord(panda.sex)
            : generation === 2
              ? grandchildWord(parent, panda.sex)
              : `${parent.relation}的${childWord(panda.sex)}`;
        const member = kin(link.childId, relation, generation, link.sourceIds);
        if (!member) continue;
        seen.add(member.id);
        members.push(member);
      }
    }
    members.sort(byBirth);
    if (members.length > 0) groups.push({ generation, title: TITLE[generation]!, members, missing: 0 });
    parents = members;
  }

  const ancestors = groups.filter((group) => group.generation < 0);
  const descendants = groups.filter((group) => group.generation > 0).flatMap((group) => group.members);
  // Places of living descendants only: a panda that has died lives nowhere (DECEASED_POLICY).
  const places = new Map<string, number>();
  let unplaced = 0;
  for (const member of descendants) {
    if (member.deceased) continue;
    // "中国" is the country-level coarse place: it says the panda is in China, not where.
    if (member.place && member.place !== COUNTRY_ONLY) places.set(member.place, (places.get(member.place) ?? 0) + 1);
    else unplaced++;
  }

  const sourcesOfChild = new Map<string, string[]>();
  for (const link of sourced) sourcesOfChild.set(link.childId, [...new Set([...(sourcesOfChild.get(link.childId) ?? []), ...link.sourceIds])]);
  const sourceIds = [...new Set(groups.flatMap((group) => group.members.flatMap((member) => member.sourceIds)))];
  return {
    // Keep an ancestor generation with no one known only when the one below it has someone: that gap is real.
    groups: groups
      .filter((group) => group.members.length > 0 || group.missing > 0)
      .sort((a, b) => a.generation - b.generation),
    ancestorDepth: ancestors.filter((group) => group.members.length > 0).length,
    descendantCount: descendants.length,
    descendantsUnplaced: unplaced,
    descendantPlaces: [...places].map(([place, count]) => ({ place, count })).sort((a, b) => b.count - a.count),
    sourceIds,
    sourcesOfChild,
  };
}
