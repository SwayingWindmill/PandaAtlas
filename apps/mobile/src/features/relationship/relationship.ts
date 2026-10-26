// 查关系: how two pandas are related, from published parent links only. Kin are named through their nearest
// common ancestor, as Chinese kinship terms do (father's or mother's side, older or younger); any other link,
// such as two pandas who share a cub, is shown as the chain of parents and children that joins them.

export interface KinPanda {
  id: string;
  name: string;
  sex: "male" | "female" | null;
  birthDate: string | null;
}

export interface ParentLink {
  childId: string;
  parentId: string;
  parentRole: "father" | "mother";
}

export interface Step {
  /** The panda this step arrives at. */
  pandaId: string;
  /** What it is to the previous panda: "妈妈", "女儿". */
  label: string;
}

export interface Relationship {
  /** "妹妹": what the second panda is to the first; null when they are linked but have no simple name. */
  term: string | null;
  /** From the first panda to the second, excluding the first. */
  steps: Step[];
}

interface Graph {
  parents: Map<string, { father?: string; mother?: string }>;
  children: Map<string, string[]>;
}

export function buildGraph(links: ParentLink[]): Graph {
  const parents = new Map<string, { father?: string; mother?: string }>();
  const children = new Map<string, string[]>();
  for (const link of links) {
    parents.set(link.childId, { ...parents.get(link.childId), [link.parentRole]: link.parentId });
    const list = children.get(link.parentId) ?? [];
    if (!list.includes(link.childId)) list.push(link.childId);
    children.set(link.parentId, list);
  }
  return { parents, children };
}

function parentsOf(graph: Graph, id: string): string[] {
  const entry = graph.parents.get(id);
  return [entry?.father, entry?.mother].filter((parent): parent is string => Boolean(parent));
}

/** Each ancestor (and the panda itself) with the shortest chain of parents leading to it. */
function ancestors(graph: Graph, id: string): Map<string, string[]> {
  const found = new Map<string, string[]>([[id, [id]]]);
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const parent of parentsOf(graph, current)) {
      if (found.has(parent)) continue;
      found.set(parent, [...(found.get(current) ?? []), parent]);
      queue.push(parent);
    }
  }
  return found;
}

function stepLabel(graph: Graph, pandas: Map<string, KinPanda>, from: string, to: string): string {
  const entry = graph.parents.get(from);
  if (entry?.father === to) return "爸爸";
  if (entry?.mother === to) return "妈妈";
  const sex = pandas.get(to)?.sex;
  return sex === "male" ? "儿子" : sex === "female" ? "女儿" : "孩子";
}

const bySex = (panda: KinPanda | undefined, male: string, female: string, unknown: string) =>
  panda?.sex === "male" ? male : panda?.sex === "female" ? female : unknown;

/** Older or younger by birth date; null when either date is missing or they share a birthday. */
function older(a: KinPanda | undefined, b: KinPanda | undefined): boolean | null {
  if (!a?.birthDate || !b?.birthDate || a.birthDate === b.birthDate) return null;
  return b.birthDate < a.birthDate;
}

function siblingTerm(graph: Graph, pandas: Map<string, KinPanda>, aId: string, bId: string): string {
  const a = pandas.get(aId);
  const b = pandas.get(bId);
  const pa = graph.parents.get(aId);
  const pb = graph.parents.get(bId);
  const sameFather = Boolean(pa?.father) && pa?.father === pb?.father;
  const sameMother = Boolean(pa?.mother) && pa?.mother === pb?.mother;
  const prefix = sameFather && sameMother ? "" : sameFather ? "同父异母的" : "同母异父的";
  const isOlder = older(a, b);
  if (a?.birthDate && a.birthDate === b?.birthDate) return `${prefix}双胞胎${bySex(b, "兄弟", "姐妹", "兄弟姐妹")}`;
  if (isOlder === null) return prefix + bySex(b, "兄弟", "姐妹", "兄弟姐妹");
  return prefix + (isOlder ? bySex(b, "哥哥", "姐姐", "哥哥或姐姐") : bySex(b, "弟弟", "妹妹", "弟弟或妹妹"));
}

function kinTerm(graph: Graph, pandas: Map<string, KinPanda>, up: string[], down: string[]): string | null {
  // up: first panda → common ancestor; down: common ancestor → second panda (both inclusive).
  const ups = up.length - 1;
  const downs = down.length - 1;
  const a = up[0] as string;
  const b = down[down.length - 1] as string;
  const B = pandas.get(b);
  const side = (child: string, parent: string) => graph.parents.get(child)?.father === parent;

  if (downs === 0) {
    if (ups === 1) return stepLabel(graph, pandas, a, b);
    if (ups === 2) {
      const fatherSide = side(a, up[1] as string);
      return fatherSide ? bySex(B, "爷爷", "奶奶", "祖辈") : bySex(B, "外公", "外婆", "祖辈");
    }
    return `往上第 ${ups} 代的祖先`;
  }
  if (ups === 0) {
    if (downs === 1) return stepLabel(graph, pandas, a, b);
    if (downs === 2) {
      const viaSon = pandas.get(down[1] as string)?.sex === "male";
      return viaSon ? bySex(B, "孙子", "孙女", "孙辈") : bySex(B, "外孙", "外孙女", "孙辈");
    }
    return `往下第 ${downs} 代的后代`;
  }
  if (ups === 1 && downs === 1) return siblingTerm(graph, pandas, a, b);
  if (ups === 2 && downs === 1) {
    const fatherSide = side(a, up[1] as string);
    return fatherSide ? bySex(B, "叔伯", "姑姑", "叔伯或姑姑") : bySex(B, "舅舅", "姨妈", "舅舅或姨妈");
  }
  if (ups === 1 && downs === 2) {
    const viaBrother = pandas.get(down[1] as string)?.sex === "male";
    return viaBrother ? bySex(B, "侄子", "侄女", "侄辈") : bySex(B, "外甥", "外甥女", "甥辈");
  }
  if (ups === 2 && downs === 2) {
    const paternal = side(a, up[1] as string) && side(b, down[1] as string);
    return (paternal ? "堂" : "表") + bySex(B, "兄弟", "姐妹", "兄弟姐妹");
  }
  return null;
}

/** Any chain of parent and child links between two pandas, shortest first. */
function anyPath(graph: Graph, from: string, to: string): string[] | null {
  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === to) break;
    for (const next of [...parentsOf(graph, current), ...(graph.children.get(current) ?? [])]) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  if (!previous.has(to)) return null;
  const path: string[] = [];
  for (let at: string | null | undefined = to; at; at = previous.get(at)) path.unshift(at);
  return path;
}

function steps(graph: Graph, pandas: Map<string, KinPanda>, path: string[]): Step[] {
  return path
    .slice(1)
    .map((pandaId, index) => ({ pandaId, label: stepLabel(graph, pandas, path[index] as string, pandaId) }));
}

/** How the second panda relates to the first, or null when the published lineage does not connect them. */
export function relate(graph: Graph, pandas: Map<string, KinPanda>, aId: string, bId: string): Relationship | null {
  if (aId === bId) return null;
  const fromA = ancestors(graph, aId);
  const fromB = ancestors(graph, bId);
  let best: { up: string[]; down: string[] } | null = null;
  for (const [ancestor, up] of fromA) {
    const toB = fromB.get(ancestor);
    if (!toB) continue;
    const down = [...toB].reverse();
    if (!best || up.length + down.length < best.up.length + best.down.length) best = { up, down };
  }
  if (best) {
    const path = [...best.up, ...best.down.slice(1)];
    return { term: kinTerm(graph, pandas, best.up, best.down), steps: steps(graph, pandas, path) };
  }
  const path = anyPath(graph, aId, bId);
  return path ? { term: null, steps: steps(graph, pandas, path) } : null;
}
