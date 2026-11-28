import { type LookAlikeLink, lookAlikePairs } from "@/features/compare/look-alikes";
import { type CatalogFaceGuide, type FaceTipKey, learningText } from "@/features/learning/catalog";
import type { MapItem } from "@/features/map/model";
import type { PandaListItem } from "@/features/pandas/pandas";

export type IdentifyTraitGroupId = "sex_and_companion" | "age_cohort" | "face_clues";

export type IdentifyTraitId =
  | "sex:female"
  | "sex:male"
  | "companion:twin"
  | "companion:parent"
  | "age:cub"
  | "age:subadult"
  | "age:adult"
  | "age:senior"
  | "face:fluffy_cheeks"
  | "face:larger_frame"
  | "face:flared_eyes"
  | "face:round_eyes"
  | "face:wide_ears"
  | "face:asymmetric_marks"
  | "media:has_cover";

export type IdentifyAgeBracket = "age:cub" | "age:subadult" | "age:adult" | "age:senior";

export interface IdentifyTraitDefinition {
  id: IdentifyTraitId;
  groupId: IdentifyTraitGroupId;
  label: string;
  weight: number;
}

export interface IdentifyTraitGroup {
  id: IdentifyTraitGroupId;
  label: string;
  options: IdentifyTraitDefinition[];
}

export interface IdentifyVenueOption {
  slug: string;
  name: string;
  residentCount: number;
  pandaIds: ReadonlySet<string>;
}

export interface IdentifyProfile {
  pandaId: string;
  ageBracket: IdentifyAgeBracket | null;
  traits: ReadonlySet<IdentifyTraitId>;
  faceSummary: string | null;
}

export interface IdentifyCandidate {
  panda: PandaListItem;
  score: number;
  matchedTraits: IdentifyTraitDefinition[];
  faceSummary: string | null;
}

export interface IdentifyRankingResult {
  candidates: IdentifyCandidate[];
  top3: IdentifyCandidate[];
  poolCount: number;
}

const GROUP_LABELS: Record<IdentifyTraitGroupId, string> = {
  sex_and_companion: "性别与关系",
  age_cohort: "体型与年龄段",
  face_clues: "外貌与资料线索",
};

const GROUP_ORDER: readonly IdentifyTraitGroupId[] = ["sex_and_companion", "age_cohort", "face_clues"];

export const IDENTIFY_TRAITS: readonly IdentifyTraitDefinition[] = [
  { id: "sex:female", groupId: "sex_and_companion", label: "雌", weight: 2 },
  { id: "sex:male", groupId: "sex_and_companion", label: "雄", weight: 2 },
  { id: "companion:twin", groupId: "sex_and_companion", label: "有双胞胎同胎", weight: 2 },
  { id: "companion:parent", groupId: "sex_and_companion", label: "已当爸妈", weight: 1.5 },
  { id: "age:cub", groupId: "age_cohort", label: "幼崽（0–2 岁）", weight: 2 },
  { id: "age:subadult", groupId: "age_cohort", label: "亚成体（3–5 岁）", weight: 2 },
  { id: "age:adult", groupId: "age_cohort", label: "成年（6–15 岁）", weight: 2 },
  { id: "age:senior", groupId: "age_cohort", label: "高龄（16 岁以上）", weight: 2 },
  { id: "face:fluffy_cheeks", groupId: "face_clues", label: "两颊圆润蓬松", weight: 2 },
  { id: "face:larger_frame", groupId: "face_clues", label: "体型偏大偏宽", weight: 2 },
  { id: "face:flared_eyes", groupId: "face_clues", label: "眼斑较宽外翘", weight: 2 },
  { id: "face:round_eyes", groupId: "face_clues", label: "眼斑短圆微垂", weight: 2 },
  { id: "face:wide_ears", groupId: "face_clues", label: "耳朵辨识特征", weight: 2 },
  { id: "face:asymmetric_marks", groupId: "face_clues", label: "左右斑纹差异", weight: 2 },
  { id: "media:has_cover", groupId: "face_clues", label: "有清晰正面照", weight: 0.5 },
];

const TRAIT_BY_ID = new Map(IDENTIFY_TRAITS.map((trait) => [trait.id, trait]));

const FACE_TIP_ORDER: readonly FaceTipKey[] = ["shape", "eyePatches", "ears", "leftRight"];
const FACE_TIP_FALLBACK_LABELS: Record<FaceTipKey, string> = {
  shape: "脸型",
  leftRight: "左右差别",
  eyePatches: "黑眼圈",
  ears: "耳朵",
};

const CONTRADICTION_PENALTY = 1;

/** Computes the age-cohort trait ID from a YYYY or YYYY-MM-DD birth date against local calendar date. */
export function ageBracketOf(birthDate: string | null, referenceDate = new Date()): IdentifyAgeBracket | null {
  if (!birthDate) return null;
  const trimmed = birthDate.trim();
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const monthOnly = /^(\d{4})-(\d{2})$/.exec(trimmed);
  const yearOnly = /^(\d{4})$/.exec(trimmed);

  let year: number;
  let month: number | null = null;
  let day: number | null = null;

  if (full) {
    year = Number(full[1]);
    month = Number(full[2]);
    day = Number(full[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
      return null;
    }
  } else if (monthOnly) {
    year = Number(monthOnly[1]);
    month = Number(monthOnly[2]);
    if (month < 1 || month > 12) return null;
  } else if (yearOnly) {
    year = Number(yearOnly[1]);
  } else {
    return null;
  }

  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;

  let age = referenceDate.getFullYear() - year;
  if (month !== null) {
    const refMonth = referenceDate.getMonth() + 1;
    const refDay = referenceDate.getDate();
    if (refMonth < month || (refMonth === month && refDay < (day ?? 1))) {
      age -= 1;
    }
  }
  if (age < 0) return null;
  if (age <= 2) return "age:cub";
  if (age <= 5) return "age:subadult";
  if (age <= 15) return "age:adult";
  return "age:senior";
}

/** Extracts visual traits and a one-line observation summary strictly from published face-guide entries. */
export function extractFaceGuideTraits(guide: CatalogFaceGuide | undefined): {
  traits: IdentifyTraitId[];
  faceSummary: string | null;
} {
  if (!guide) return { traits: [], faceSummary: null };
  const bodyOf = (key: FaceTipKey) => learningText(guide.tips.find((tip) => tip.key === key)?.body).trim();
  const traits: IdentifyTraitId[] = [];

  const shapeBody = bodyOf("shape");
  if (shapeBody) {
    if (
      /圆润|蓬松|圆脸|三角脸/.test(shapeBody) &&
      !/(?:不如|没有|不像|远不如|偏瘦|不够)[^，。；]*(?:蓬松|圆润|圆)/.test(shapeBody)
    ) {
      traits.push("face:fluffy_cheeks");
    }
    if (
      (/体[形型][^，。；]*(?:偏|较|更)?大|宽圆|大饼脸|偏宽/.test(shapeBody) &&
        !/体[形型][^，。；]*不(?:算?大|宽)/.test(shapeBody))
    ) {
      traits.push("face:larger_frame");
    }
  }

  const eyeBody = bodyOf("eyePatches");
  if (eyeBody) {
    if (
      /外翘|上挑|上扬/.test(eyeBody) ||
      (/较宽/.test(eyeBody) && !/(?:不算|不太|并不)宽/.test(eyeBody))
    ) {
      traits.push("face:flared_eyes");
    }
    if (/短圆|微垂|圆润|花生/.test(eyeBody) && !/(?:不如|不太)圆/.test(eyeBody)) {
      traits.push("face:round_eyes");
    }
  }

  const earsBody = bodyOf("ears");
  if (
    earsBody &&
    /雷达耳|宽距|大耳|高耸/.test(earsBody) &&
    !/把[^，。；]*和[^，。；]*区分|靠[^，。；]*的[“"']?雷达耳/.test(earsBody) &&
    !/(?:不大|不明显)/.test(earsBody)
  ) {
    traits.push("face:wide_ears");
  }

  const leftRightBody = bodyOf("leftRight");
  if (
    leftRightBody &&
    !/(?:对称|差别不大|差别不明显|差异不明显|几乎没有差别|基本一致|看不出差别)/.test(leftRightBody)
  ) {
    traits.push("face:asymmetric_marks");
  }

  let faceSummary: string | null = null;
  for (const key of FACE_TIP_ORDER) {
    const tip = guide.tips.find((item) => item.key === key);
    const body = learningText(tip?.body).trim();
    if (!body) continue;
    const label = learningText(tip?.label).trim() || FACE_TIP_FALLBACK_LABELS[key];
    faceSummary = `${label}：${body}`;
    break;
  }

  return { traits, faceSummary };
}

/** Filters to living pandas first so venue field ID doesn't mix historical pandas unless the release has none alive. */
export function buildLivingPool(pandas: readonly PandaListItem[]): PandaListItem[] {
  const living = pandas.filter((panda) => !panda.deceased);
  return living.length > 0 ? living : [...pandas];
}

/** Builds venue filter options from map entries whose residents intersect the active panda pool. */
export function buildIdentifyVenues(
  pool: readonly PandaListItem[],
  mapItems: readonly MapItem[],
): IdentifyVenueOption[] {
  const poolIds = new Set(pool.map((panda) => panda.id));
  const seenSlugs = new Set<string>();
  const out: IdentifyVenueOption[] = [];

  for (const item of mapItems) {
    if (seenSlugs.has(item.slug)) continue;
    const residentIds = new Set<string>();
    for (const resident of item.residents) {
      if (poolIds.has(resident.id)) residentIds.add(resident.id);
    }
    if (residentIds.size === 0) continue;
    seenSlugs.add(item.slug);
    out.push({
      slug: item.slug,
      name: item.name,
      residentCount: residentIds.size,
      pandaIds: residentIds,
    });
  }

  return out.sort(
    (left, right) =>
      right.residentCount - left.residentCount ||
      left.name.localeCompare(right.name, "zh-CN"),
  );
}

/** Validates an incoming `?institution=<slug>` route param against loaded venue options. */
export function resolveInitialVenueSlug(
  venues: readonly IdentifyVenueOption[],
  initialInstitution?: string,
): string | null {
  if (!initialInstitution) return null;
  return venues.some((venue) => venue.slug === initialInstitution) ? initialInstitution : null;
}

/** Places the currently pinned/deep-linked venue first so it stays visible immediately next to 全部. */
export function orderVenueOptions(
  venues: readonly IdentifyVenueOption[],
  pinnedSlug: string | null,
): IdentifyVenueOption[] {
  if (!pinnedSlug) return [...venues];
  const pinned = venues.find((venue) => venue.slug === pinnedSlug);
  if (!pinned) return [...venues];
  return [pinned, ...venues.filter((venue) => venue.slug !== pinnedSlug)];
}

/** Filters candidate pandas by selected venue slug (`null` means all venues; unknown slug yields empty list). */
export function filterIdentifyPool(
  pool: readonly PandaListItem[],
  venues: readonly IdentifyVenueOption[],
  venueSlug: string | null,
): PandaListItem[] {
  if (!venueSlug) return [...pool];
  const venue = venues.find((item) => item.slug === venueSlug);
  if (!venue) return [];
  return pool.filter((panda) => venue.pandaIds.has(panda.id));
}

/** Builds per-panda identification profiles from live index, sourced lineage, and published face guides. */
export function buildIdentifyProfiles(
  pandas: readonly PandaListItem[],
  lineage: readonly LookAlikeLink[],
  faceGuides: readonly CatalogFaceGuide[],
  referenceDate = new Date(),
): Map<string, IdentifyProfile> {
  const twinIds = new Set<string>();
  for (const pair of lookAlikePairs(pandas, lineage, [])) {
    if (pair.kind !== "twins") continue;
    twinIds.add(pair.a.id);
    twinIds.add(pair.b.id);
  }

  const parentIds = new Set<string>();
  for (const link of lineage) {
    if (link.sourceIds.length > 0) parentIds.add(link.parentId);
  }

  const guideBySlug = new Map(faceGuides.map((guide) => [guide.pandaSlug, guide]));
  const profiles = new Map<string, IdentifyProfile>();

  for (const panda of pandas) {
    const traits = new Set<IdentifyTraitId>();
    if (panda.sex === "female") traits.add("sex:female");
    else if (panda.sex === "male") traits.add("sex:male");

    const ageBracket = ageBracketOf(panda.birthDate, referenceDate);
    if (ageBracket) traits.add(ageBracket);
    if (twinIds.has(panda.id)) traits.add("companion:twin");
    if (parentIds.has(panda.id)) traits.add("companion:parent");
    if (panda.hasFullBleedCover) traits.add("media:has_cover");

    const extracted = extractFaceGuideTraits(guideBySlug.get(panda.slug));
    for (const traitId of extracted.traits) traits.add(traitId);

    profiles.set(panda.id, {
      pandaId: panda.id,
      ageBracket,
      traits,
      faceSummary: extracted.faceSummary,
    });
  }

  return profiles;
}

/** Returns trait groups pruned to clues that actually exist (and discriminate) inside the active candidate pool. */
export function buildIdentifyTraitGroups(
  pool: readonly PandaListItem[],
  profiles: ReadonlyMap<string, IdentifyProfile>,
): IdentifyTraitGroup[] {
  if (pool.length === 0) return [];
  const coveredCount = pool.filter((panda) => panda.hasFullBleedCover).length;
  const coverDiscriminates = coveredCount > 0 && coveredCount < pool.length;

  return GROUP_ORDER.map((groupId) => {
    const options = IDENTIFY_TRAITS.filter((trait) => {
      if (trait.groupId !== groupId) return false;
      if (trait.id === "media:has_cover") return coverDiscriminates;
      return pool.some((panda) => profiles.get(panda.id)?.traits.has(trait.id));
    });
    return {
      id: groupId,
      label: GROUP_LABELS[groupId],
      options,
    };
  }).filter((group) => group.options.length > 0);
}

/** Toggles one trait chip; sex chips are mutually exclusive while all other clues multi-select freely. */
export function toggleIdentifyTrait(
  selected: readonly IdentifyTraitId[],
  traitId: IdentifyTraitId,
): IdentifyTraitId[] {
  if (selected.includes(traitId)) {
    return selected.filter((item) => item !== traitId);
  }
  if (traitId === "sex:female") {
    return [...selected.filter((item) => item !== "sex:male"), traitId];
  }
  if (traitId === "sex:male") {
    return [...selected.filter((item) => item !== "sex:female"), traitId];
  }
  return [...selected, traitId];
}

/** Maintains up to 2 selected comparison slugs by evicting the older pick when adding a 3rd. */
export function toggleCompareSlug(selected: readonly string[], slug: string): string[] {
  if (selected.includes(slug)) {
    return selected.filter((item) => item !== slug);
  }
  if (selected.length >= 2) {
    return [selected[selected.length - 1]!, slug];
  }
  return [...selected, slug];
}

/**
 * Ranks every panda in the active pool by soft multi-access evidence: matches add trait weight,
 * known contradictory sex/age subtracts a small penalty, and missing fields stay neutral (0).
 */
export function rankIdentifyCandidates(
  pool: readonly PandaListItem[],
  profiles: ReadonlyMap<string, IdentifyProfile>,
  selectedTraits: readonly IdentifyTraitId[],
): IdentifyRankingResult {
  const uniqueSelected = [...new Set(selectedTraits)];
  const selectedAgeTraits = uniqueSelected.filter((id): id is IdentifyAgeBracket => id.startsWith("age:"));
  const wantsFemale = uniqueSelected.includes("sex:female");
  const wantsMale = uniqueSelected.includes("sex:male");

  const scored = pool.map((panda, index) => {
    const profile = profiles.get(panda.id);
    const matchedTraits: IdentifyTraitDefinition[] = [];
    let score = 0;

    for (const traitId of uniqueSelected) {
      const def = TRAIT_BY_ID.get(traitId);
      if (!def) continue;
      if (profile?.traits.has(traitId)) {
        score += def.weight;
        matchedTraits.push(def);
      }
    }

    if (wantsFemale && panda.sex === "male") score -= CONTRADICTION_PENALTY;
    if (wantsMale && panda.sex === "female") score -= CONTRADICTION_PENALTY;
    if (
      selectedAgeTraits.length > 0 &&
      profile?.ageBracket &&
      !selectedAgeTraits.includes(profile.ageBracket)
    ) {
      score -= CONTRADICTION_PENALTY;
    }

    const faceSummary = profile?.faceSummary ?? null;
    return {
      panda,
      score,
      matchedTraits,
      faceSummary,
      hasCoverScore: panda.hasFullBleedCover ? 1 : 0,
      hasGuideScore: faceSummary ? 1 : 0,
      index,
    };
  });

  scored.sort(
    (left, right) =>
      right.score - left.score ||
      right.matchedTraits.length - left.matchedTraits.length ||
      right.hasCoverScore - left.hasCoverScore ||
      right.hasGuideScore - left.hasGuideScore ||
      left.index - right.index,
  );

  const candidates: IdentifyCandidate[] = scored.map(({ panda, score, matchedTraits, faceSummary }) => ({
    panda,
    score,
    matchedTraits,
    faceSummary,
  }));

  return {
    candidates,
    top3: candidates.slice(0, 3),
    poolCount: pool.length,
  };
}

/** Single-line subtitle for a candidate card, joined with ideographic spaces per repo UI convention. */
export function formatCandidateMeta(panda: Pick<PandaListItem, "place" | "birthDate" | "sex">): string {
  const sex = panda.sex === "female" ? "雌" : panda.sex === "male" ? "雄" : null;
  const birthYear = panda.birthDate ? `${panda.birthDate.slice(0, 4)} 年出生` : null;
  return [panda.place, birthYear, sex].filter(Boolean).join("　");
}
