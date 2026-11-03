import {
  type CatalogChallenge,
  type CatalogFaceGuide,
  type FaceTipKey,
  type LearningCatalog,
  type LearningSource,
  learningText,
} from "../learning/catalog";

// 比一比: two pandas side by side. The page only repeats distinguishing points that 文献与写作 has already written
// into the learning catalog (认脸指南 tips and 认脸挑战 hints), each with its source. It never makes up its own.
// Where a slot is empty it says what is still missing, so the writers know what to fill in.

/** The four 认脸指南 slots, in the order the brief fixes. */
export const FACE_TIP_KEYS: readonly FaceTipKey[] = ["shape", "leftRight", "eyePatches", "ears"];

/** Fallback headings when neither panda has a guide yet; the brief fixes these words. */
export const FACE_TIP_LABELS: Record<FaceTipKey, string> = {
  shape: "脸型",
  leftRight: "左右差别",
  eyePatches: "黑眼圈",
  ears: "耳朵",
};

export interface ComparePanda {
  id: string;
  slug: string;
  name: string;
}

export interface ComparePoint {
  key: FaceTipKey;
  label: string;
  /** The written tip for each side, or null where the slot is still empty. */
  a: string | null;
  b: string | null;
}

export interface CompareHint {
  slug: string;
  /** The panda the 认脸挑战 asks for. */
  answerSlug: string;
  text: string;
}

export interface MissingItem {
  pandaSlug: string;
  pandaName: string;
  /** Slots of the 认脸指南 that are empty or absent, by heading. */
  slots: string[];
  /** No 认脸指南 entry at all for this panda (or none published). */
  noGuide: boolean;
}

export interface Comparison {
  /** `ready` when at least one written point exists; `pending` shows 区分要点还在整理. */
  state: "ready" | "pending";
  points: ComparePoint[];
  hints: CompareHint[];
  sources: LearningSource[];
  missing: MissingItem[];
}

function guideFor(catalog: LearningCatalog, slug: string): CatalogFaceGuide | undefined {
  return catalog.faceGuides.find((guide) => guide.pandaSlug === slug);
}

function tipText(guide: CatalogFaceGuide | undefined, key: FaceTipKey): string | null {
  const text = learningText(guide?.tips.find((tip) => tip.key === key)?.body);
  return text.length > 0 ? text : null;
}

function tipLabel(guides: (CatalogFaceGuide | undefined)[], key: FaceTipKey): string {
  for (const guide of guides) {
    const label = learningText(guide?.tips.find((tip) => tip.key === key)?.label);
    if (label) return label;
  }
  return FACE_TIP_LABELS[key];
}

function involves(challenge: CatalogChallenge, slug: string): boolean {
  return challenge.answerPandaSlug === slug || challenge.decoyPandaSlugs.includes(slug);
}

/** A 认脸挑战 hint belongs to the pair when one of the two is its answer and the other is among its choices. */
function pairHints(catalog: LearningCatalog, a: string, b: string): CatalogChallenge[] {
  return catalog.challenges.filter(
    (challenge) =>
      (challenge.answerPandaSlug === a || challenge.answerPandaSlug === b) && involves(challenge, a) && involves(challenge, b),
  );
}

function uniqueSources(lists: readonly (readonly LearningSource[])[]): LearningSource[] {
  const seen = new Set<string>();
  const out: LearningSource[] = [];
  for (const source of lists.flat()) {
    const key = source.url || learningText(source.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

export function comparePandas(catalog: LearningCatalog, a: ComparePanda, b: ComparePanda): Comparison {
  const guideA = guideFor(catalog, a.slug);
  const guideB = guideFor(catalog, b.slug);
  const points = FACE_TIP_KEYS.map((key) => ({
    key,
    label: tipLabel([guideA, guideB], key),
    a: tipText(guideA, key),
    b: tipText(guideB, key),
  })).filter((point) => point.a !== null || point.b !== null);
  const challenges = pairHints(catalog, a.slug, b.slug);
  const hints = challenges
    .map((challenge) => ({ slug: challenge.slug, answerSlug: challenge.answerPandaSlug, text: learningText(challenge.tip) }))
    .filter((hint) => hint.text.length > 0);
  const missing = [
    { panda: a, guide: guideA },
    { panda: b, guide: guideB },
  ]
    .map(({ panda, guide }) => ({
      pandaSlug: panda.slug,
      pandaName: panda.name,
      noGuide: guide === undefined,
      slots: FACE_TIP_KEYS.filter((key) => tipText(guide, key) === null).map((key) => tipLabel([guideA, guideB], key)),
    }))
    .filter((item) => item.slots.length > 0);
  return {
    state: points.length > 0 || hints.length > 0 ? "ready" : "pending",
    points,
    hints,
    sources: uniqueSources([
      ...(guideA && points.some((point) => point.a) ? [guideA.sources] : []),
      ...(guideB && points.some((point) => point.b) ? [guideB.sources] : []),
      ...challenges.filter((challenge) => hints.some((hint) => hint.slug === challenge.slug)).map((c) => c.sources),
    ]),
    missing,
  };
}

/** One sentence per panda for the 还在整理 list: what the writers still need to supply. */
export function missingLine(item: MissingItem): string {
  if (item.noGuide) return `${item.pandaName}：还没有认脸指南（${item.slots.join("、")}都待补）`;
  return `${item.pandaName}：${item.slots.join("、")}还空着`;
}

export interface CompareCandidate {
  id: string;
  slug: string;
  name: string;
  placeId: string | null;
  place: string | null;
  birthDate: string | null;
  deceased: boolean;
}

export interface CompareSuggestion {
  panda: CompareCandidate;
  /** Why it is offered, stated as a fact from the data, never as a claim that they look alike. */
  reason: string;
}

function birthYear(value: string | null): number | null {
  const match = value ? /^(\d{4})/.exec(value) : null;
  return match ? Number(match[1]) : null;
}

const SUGGESTIONS = 3;

/**
 * Pandas worth comparing with `target`: first those a 认脸挑战 already puts next to it, then living pandas at the
 * same place (the ones 猜熊猫 offers as choices), nearest in age first. Never more than three.
 */
export function compareSuggestions(
  target: CompareCandidate,
  pandas: readonly CompareCandidate[],
  challenges: readonly CatalogChallenge[],
): CompareSuggestion[] {
  const bySlug = new Map(pandas.map((panda) => [panda.slug, panda]));
  const out: CompareSuggestion[] = [];
  const taken = new Set<string>([target.slug]);
  for (const challenge of challenges) {
    if (!involves(challenge, target.slug)) continue;
    const others =
      challenge.answerPandaSlug === target.slug ? challenge.decoyPandaSlugs : [challenge.answerPandaSlug];
    for (const slug of others) {
      const panda = bySlug.get(slug);
      if (!panda || taken.has(slug)) continue;
      taken.add(slug);
      out.push({ panda, reason: "在认脸挑战里一起出现" });
    }
  }
  if (target.placeId !== null && target.place !== null) {
    const year = birthYear(target.birthDate);
    const neighbours = pandas
      .filter((panda) => !panda.deceased && panda.placeId === target.placeId && !taken.has(panda.slug))
      .map((panda) => ({ panda, gap: year === null ? Infinity : Math.abs((birthYear(panda.birthDate) ?? -9999) - year) }))
      .sort((x, y) => x.gap - y.gap || x.panda.slug.localeCompare(y.panda.slug));
    for (const { panda } of neighbours) out.push({ panda, reason: `同住${target.place}` });
  }
  return out.slice(0, SUGGESTIONS);
}
