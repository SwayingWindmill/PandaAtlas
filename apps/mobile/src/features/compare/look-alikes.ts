// 双胞胎/相似熊猫: pairs worth putting side by side, from data already published — never a judgement that two
// pandas look alike. Twins come from sourced lineage (same mother, same exact birth date); the rest are pairs a
// 认脸挑战 already sets against each other. Explanations are editorial slots (LOOK_ALIKE_NOTES), empty until written.

export interface LookAlikePanda {
  id: string;
  slug: string;
  name: string;
  birthDate: string | null;
}

export interface LookAlikeLink {
  childId: string;
  parentId: string;
  parentRole: "father" | "mother";
  sourceIds: string[];
}

export interface LookAlikeChallenge {
  answerPandaSlug: string;
  decoyPandaSlugs: string[];
}

export interface LookAlikePair {
  key: string;
  kind: "twins" | "challenge";
  a: LookAlikePanda;
  b: LookAlikePanda;
}

/** Editorial slot, keyed by pair key ("slugA+slugB", sorted). Empty until 文献与写作 fill it. */
export const LOOK_ALIKE_NOTES: Record<string, string> = {};

export function pairKey(x: string, y: string): string {
  return [x, y].sort().join("+");
}

const EXACT_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function lookAlikePairs(
  pandas: readonly LookAlikePanda[],
  links: readonly LookAlikeLink[],
  challenges: readonly LookAlikeChallenge[],
): LookAlikePair[] {
  const byId = new Map(pandas.map((p) => [p.id, p]));
  const bySlug = new Map(pandas.map((p) => [p.slug, p]));
  const seen = new Set<string>();
  const out: LookAlikePair[] = [];
  const add = (kind: LookAlikePair["kind"], x: LookAlikePanda, y: LookAlikePanda) => {
    const key = pairKey(x.slug, y.slug);
    if (x.slug === y.slug || seen.has(key)) return;
    seen.add(key);
    const [a, b] = x.slug < y.slug ? [x, y] : [y, x];
    out.push({ key, kind, a, b });
  };

  const litters = new Map<string, LookAlikePanda[]>();
  for (const link of links) {
    if (link.parentRole !== "mother" || link.sourceIds.length === 0) continue;
    const child = byId.get(link.childId);
    if (!child?.birthDate || !EXACT_DAY.test(child.birthDate)) continue;
    const group = `${link.parentId}|${child.birthDate}`;
    const list = litters.get(group) ?? [];
    if (!list.some((p) => p.id === child.id)) list.push(child);
    litters.set(group, list);
  }
  const twins = [...litters.values()]
    .filter((list) => list.length >= 2)
    .sort((x, y) => (y[0]?.birthDate ?? "").localeCompare(x[0]?.birthDate ?? ""));
  for (const list of twins) {
    list.forEach((x, i) => {
      for (const y of list.slice(i + 1)) add("twins", x, y);
    });
  }

  for (const challenge of challenges) {
    const answer = bySlug.get(challenge.answerPandaSlug);
    if (!answer) continue;
    for (const slug of challenge.decoyPandaSlugs) {
      const decoy = bySlug.get(slug);
      if (decoy) add("challenge", answer, decoy);
    }
  }
  return out;
}
