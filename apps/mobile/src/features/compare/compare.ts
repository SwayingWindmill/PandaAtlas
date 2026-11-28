import {
  type CatalogChallenge,
  type CatalogFaceGuide,
  type FaceTipKey,
  type LearningCatalog,
  type LearningSource,
  learningText,
} from "../learning/catalog";
import type { Comparison as CuratedComparison } from "../discover/comparisons";
import type { PandaListItem } from "../pandas/pandas";
import { type KinPanda, type ParentLink, buildGraph, relate } from "../relationship/relationship";
import {
  LOOK_ALIKE_NOTES,
  type LookAlikeChallenge,
  type LookAlikeLink,
  lookAlikePairs,
  pairKey,
} from "./look-alikes";

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

export interface ArchiveCompareRow {
  key: "sex" | "birth" | "place" | "studbook";
  label: string;
  aValue: string;
  bValue: string;
  badge: string | null;
}

interface ParsedBirthDate {
  year: number;
  month: number | null;
  day: number | null;
  utcMs: number | null;
}

const MS_PER_DAY = 86_400_000;

function parseBirthDate(value: string | null): ParsedBirthDate | null {
  if (!value) return null;
  const full = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (full) {
    const year = Number(full[1]);
    const month = Number(full[2]);
    const day = Number(full[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
        return { year, month, day, utcMs: date.getTime() };
      }
    }
  }
  const monthOnly = /^(\d{4})-(\d{2})$/.exec(value);
  if (monthOnly) {
    const year = Number(monthOnly[1]);
    const month = Number(monthOnly[2]);
    if (month >= 1 && month <= 12) return { year, month, day: null, utcMs: null };
  }
  const yearOnly = /^(\d{4})/.exec(value);
  if (yearOnly) return { year: Number(yearOnly[1]), month: null, day: null, utcMs: null };
  return null;
}

export function formatCompareBirthDate(birthDate: string | null): string {
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return "未记录";
  if (parsed.month !== null && parsed.day !== null) {
    return `${String(parsed.year).padStart(4, "0")}.${String(parsed.month).padStart(2, "0")}.${String(parsed.day).padStart(2, "0")}`;
  }
  return `${parsed.year} 年`;
}

export function formatBirthDelta(aBirthDate: string | null, bBirthDate: string | null): string | null {
  const pa = parseBirthDate(aBirthDate);
  const pb = parseBirthDate(bBirthDate);
  if (!pa || !pb) return null;

  if (pa.utcMs !== null && pb.utcMs !== null) {
    if (pa.utcMs === pb.utcMs) return "同日出生";
    const [early, late, diffMs] =
      pa.utcMs < pb.utcMs ? [pa, pb, pb.utcMs - pa.utcMs] : [pb, pa, pa.utcMs - pb.utcMs];
    let fullYears = late.year - early.year;
    if (late.month! < early.month! || (late.month === early.month && late.day! < early.day!)) {
      fullYears -= 1;
    }
    if (fullYears >= 1) return `差 ${fullYears} 岁`;

    let fullMonths = (late.year - early.year) * 12 + (late.month! - early.month!);
    if (late.day! < early.day!) fullMonths -= 1;
    if (fullMonths >= 1) return `差 ${fullMonths} 个月`;

    const days = Math.round(diffMs / MS_PER_DAY);
    return `差 ${days} 天`;
  }

  if (pa.month !== null && pb.month !== null) {
    const months = Math.abs((pa.year - pb.year) * 12 + (pa.month - pb.month));
    if (months === 0) return null;
    if (months >= 12) return `差 ${Math.floor(months / 12)} 岁`;
    return `差 ${months} 个月`;
  }

  const years = Math.abs(pa.year - pb.year);
  return years >= 1 ? `差 ${years} 岁` : null;
}

function formatCompareSex(sex: PandaListItem["sex"]): string {
  if (sex === "female") return "雌性";
  if (sex === "male") return "雄性";
  return "未记录";
}

function formatComparePlace(panda: PandaListItem): string {
  if (panda.deceased) return "已离世";
  return panda.place ?? "未记录";
}

/** Core profile facts for any two pandas, regardless of whether face-guide copy exists. */
export function buildArchiveComparison(a: PandaListItem, b: PandaListItem): ArchiveCompareRow[] {
  const samePlace = !a.deceased && !b.deceased && a.placeId !== null && a.placeId === b.placeId;
  return [
    {
      key: "sex",
      label: "性别",
      aValue: formatCompareSex(a.sex),
      bValue: formatCompareSex(b.sex),
      badge: null,
    },
    {
      key: "birth",
      label: "出生",
      aValue: formatCompareBirthDate(a.birthDate),
      bValue: formatCompareBirthDate(b.birthDate),
      badge: formatBirthDelta(a.birthDate, b.birthDate),
    },
    {
      key: "place",
      label: "现居",
      aValue: formatComparePlace(a),
      bValue: formatComparePlace(b),
      badge: samePlace ? "同住一馆" : null,
    },
    {
      key: "studbook",
      label: "谱系号",
      aValue: a.studbookNumber ?? "—",
      bValue: b.studbookNumber ?? "—",
      badge: null,
    },
  ];
}

export interface CompareKinship {
  linked: boolean;
  title: string;
  subtitle: string;
  stepsCount: number;
  term: string | null;
  href: { pathname: "/relationship"; params: { a: string; b: string } };
}

/** Summarizes lineage relationship between two pandas with a deep link to the full chain screen. */
export function summarizeCompareKinship(
  a: PandaListItem,
  b: PandaListItem,
  links: readonly ParentLink[],
  pandas: readonly PandaListItem[],
): CompareKinship {
  const map = new Map<string, KinPanda>(pandas.map((panda) => [panda.id, panda]));
  if (!map.has(a.id)) map.set(a.id, a);
  if (!map.has(b.id)) map.set(b.id, b);
  const relationship = relate(buildGraph([...links]), map, a.id, b.id);
  const href = { pathname: "/relationship" as const, params: { a: a.slug, b: b.slug } };

  if (!relationship) {
    return {
      linked: false,
      title: `${a.name}与${b.name}暂未发现直系亲缘`,
      subtitle: "打开亲缘查询",
      stepsCount: 0,
      term: null,
      href,
    };
  }

  return {
    linked: true,
    title: relationship.term ? `${b.name}是${a.name}的${relationship.term}` : `${a.name}和${b.name}有亲缘联系`,
    subtitle: "查看完整亲缘链路",
    stepsCount: relationship.steps.length,
    term: relationship.term,
    href,
  };
}

export interface FeaturedComparePair {
  key: string;
  tag: string;
  subtitle: string;
  a: PandaListItem;
  b: PandaListItem;
}

function comparisonTag(title: string, a: PandaListItem, b: PandaListItem): string {
  const trimmed = title.trim();
  if (!trimmed) return "精选对照";
  if (trimmed.includes("，")) {
    const suffix = trimmed.split("，").slice(1).join("，").trim();
    if (suffix) return suffix;
  }
  if (trimmed.includes(a.name) || trimmed.includes(b.name)) return "精选对照";
  return trimmed;
}

function lookAlikeSubtitle(pairKind: "twins" | "challenge", key: string, a: PandaListItem, b: PandaListItem): string {
  const note = LOOK_ALIKE_NOTES[key];
  if (note) return note;
  if (pairKind === "twins") {
    const birth = a.birthDate ? `${formatCompareBirthDate(a.birthDate)} 同胎出生` : "同胎双胞胎";
    return [birth, a.place].filter(Boolean).join("　");
  }
  const where =
    a.place && b.place && a.place === b.place
      ? `同住${a.place}`
      : [a.place, b.place].filter(Boolean).join("与");
  return [where, "外貌与档案对照"].filter(Boolean).join("　");
}

/** Combines curated 比一比 entries with derived twin/challenge pairs, deduplicated and capped for the picker feed. */
export function buildFeaturedComparePairs(
  pandas: readonly PandaListItem[],
  comparisons: readonly CuratedComparison[],
  links: readonly LookAlikeLink[],
  challenges: readonly LookAlikeChallenge[],
  limit = 6,
): FeaturedComparePair[] {
  const bySlug = new Map(pandas.map((panda) => [panda.slug, panda]));
  const seen = new Set<string>();
  const out: FeaturedComparePair[] = [];

  for (const comparison of comparisons) {
    if (comparison.pandaSlugs.length !== 2) continue;
    const [slugA, slugB] = comparison.pandaSlugs;
    const a = slugA ? bySlug.get(slugA) : undefined;
    const b = slugB ? bySlug.get(slugB) : undefined;
    if (!a || !b || a.slug === b.slug) continue;
    const key = pairKey(a.slug, b.slug);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      tag: comparisonTag(comparison.title, a, b),
      subtitle: comparison.dek.trim() || [a.place, b.place].filter(Boolean).join("　") || "外貌与档案对照",
      a,
      b,
    });
  }

  const derived = lookAlikePairs(pandas, links, challenges)
    .map((pair) => {
      const a = bySlug.get(pair.a.slug);
      const b = bySlug.get(pair.b.slug);
      return a && b && a.slug !== b.slug && !seen.has(pair.key)
        ? {
            pair,
            a,
            b,
            covers: (a.hasFullBleedCover ? 1 : 0) + (b.hasFullBleedCover ? 1 : 0),
          }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((x, y) => y.covers - x.covers);

  for (const { pair, a, b } of derived) {
    if (seen.has(pair.key)) continue;
    seen.add(pair.key);
    out.push({
      key: pair.key,
      tag: pair.kind === "twins" ? "同胎双胞胎" : "认脸挑战对照",
      subtitle: lookAlikeSubtitle(pair.kind, pair.key, a, b),
      a,
      b,
    });
  }

  return out.slice(0, limit);
}
