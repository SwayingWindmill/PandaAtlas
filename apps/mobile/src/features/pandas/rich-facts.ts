import type { components } from "@zhipanda/api-client";

import { ageAt, type PlaceLived } from "./profile-facts";

type Schemas = components["schemas"];
type Panda = Schemas["PublicPandaSummaryDto"];
type FactDto = Schemas["PublicPandaFactDto"];

export type HighlightIcon = "house" | "sparkles" | "ruler" | "clock" | "calendar";

export interface ProfileHighlight {
  key: string;
  icon: HighlightIcon;
  label: string;
  value: string;
  note?: string;
}

export interface ExtractedRelative {
  slug: string | null;
  name: string;
  relation: string;
}

export interface RouteSummary {
  fromPlace: string;
  fromYears: string;
  toPlace: string;
  toYears: string;
  note: string | null;
}

export interface LifeStageInfo {
  stageIndex: 0 | 1 | 2 | 3;
  stageLabel: string;
  /** Position along the 4-segment track (4..96%). */
  dotPercent: number;
  countdownText: string;
}

export interface RichProfileFacts {
  studbookNumber: string | null;
  adoptionName: string | null;
  highlights: ProfileHighlight[];
  traits: { pills: string[]; careNote: string | null } | null;
  extraRelatives: ExtractedRelative[];
  routeSummary: RouteSummary | null;
  lifeStage: LifeStageInfo | null;
  leadBio: string | null;
  recommendedArticleSlug: string;
}

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;

const KNOWN_PLACES_ZH: [RegExp, string][] = [
  [/everland/i, "爱宝乐园"],
  [/shenshuping/i, "卧龙神树坪"],
  [/chengdu/i, "成都大熊猫基地"],
  [/beijing\s+zoo/i, "北京动物园"],
  [/smithsonian|national\s+zoo/i, "华盛顿国家动物园"],
  [/ueno/i, "上野动物园"],
  [/adventure\s+world|shirahama/i, "白浜冒险大世界"],
  [/atlanta/i, "亚特兰大动物园"],
  [/san\s+diego/i, "圣地亚哥动物园"],
  [/dujiangyan/i, "都江堰基地"],
  [/bifengxia/i, "雅安碧峰峡"],
];

const FEATURE_ZH: [RegExp, string][] = [
  [/eye\s*patch.*wider\s*above|wider\s*above.*narrower\s*below/i, "眼斑上宽下窄"],
  [/pointed\s*muzzle/i, "嘴筒微尖"],
  [/short\s*lower\s*jaw/i, "下颌较短"],
  [/short\s*and\s*round\s*body/i, "体态短圆"],
  [/fluffy\s*coat/i, "毛色偏蓬松"],
  [/slow\s*walking/i, "步态偏慢"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function factMap(facts: FactDto[]): Map<string, FactDto> {
  const map = new Map<string, FactDto>();
  for (const item of facts) {
    if (item.status === "disputed") continue;
    if (item.value === null || item.value === undefined || item.value === "") continue;
    if (!map.has(item.fieldKey)) map.set(item.fieldKey, item);
  }
  return map;
}

function cleanChineseName(raw: string): string | null {
  const parts = raw.split(/\s*\/\s*/).map((part) => part.trim());
  const hanPart = (parts.length > 1 ? parts.find((part) => HAN.test(part)) : parts[0]) ?? raw.trim();
  const stripped = hanPart.replace(/[（(][^）)]*[）)]?$/g, "").trim();
  if (!stripped || !HAN.test(stripped)) return null;
  return stripped;
}

function mapPlaceZh(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (HAN.test(trimmed)) return trimmed;
  for (const [pattern, zh] of KNOWN_PLACES_ZH) {
    if (pattern.test(trimmed)) return zh;
  }
  return null;
}

function parseStudbook(facts: Map<string, FactDto>): string | null {
  const entry =
    facts.get("studbook_number") ??
    facts.get("local.studbook_number") ??
    facts.get("international_studbook_number") ??
    facts.get("local.international_studbook_number");
  if (!entry) return null;
  const raw = typeof entry.value === "number" ? String(entry.value) : typeof entry.value === "string" ? entry.value.trim() : "";
  const normalized = raw.replace(/^#/, "").trim();
  return normalized && /^[A-Za-z0-9-]+$/.test(normalized) ? `#${normalized}` : null;
}

function parseAdoptionName(facts: Map<string, FactDto>): string | null {
  const val = facts.get("local.lifetime_adoption_name")?.value;
  if (typeof val === "string") return cleanChineseName(val);
  if (isRecord(val) && typeof val.name === "string") return cleanChineseName(val.name);
  return null;
}

function splitEnclosure(area: string): { value: string; note?: string } | null {
  const trimmed = area.trim();
  if (!trimmed || !HAN.test(trimmed)) return null;
  const match = trimmed.match(/^(.+[馆区])\s*(\d+\S*圈舍)$/);
  if (match && match[1] && match[2]) {
    return { value: match[1], note: match[2].replace(/^(\d+)(\D)/, "$1 $2") };
  }
  return { value: trimmed };
}

function formatYearMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  if (!y) return "";
  return m ? `${y} 年 ${Number(m)} 月` : `${y} 年`;
}

function dotDate(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return y && m && d ? `${y}.${m}.${d}` : y ?? "";
}

function twinSummary(
  facts: Map<string, FactDto>,
  sex: "male" | "female" | null,
): { badge: string; siblingName: string | null; siblingRelation: string; siblingSlug: string | null } | null {
  const twin = facts.get("local.twin")?.value;
  if (isRecord(twin)) {
    const siblingName = typeof twin.name === "string" ? cleanChineseName(twin.name) : null;
    const siblingSlug = typeof twin.subject_id === "string" ? twin.subject_id : null;
    const mixed = twin.litter_type === "mixed_sex";
    const siblingYounger = twin.birth_order === "younger";
    const siblingOlder = twin.birth_order === "older";
    let badge = "双胞胎";
    let siblingRelation = "双胞胎";
    if (mixed && sex === "female") {
      badge = siblingOlder ? "龙凤胎妹妹" : "龙凤胎姐姐";
      siblingRelation = siblingOlder ? "龙凤胎哥哥" : "龙凤胎弟弟";
    } else if (mixed && sex === "male") {
      badge = siblingOlder ? "龙凤胎弟弟" : "龙凤胎哥哥";
      siblingRelation = siblingOlder ? "龙凤胎姐姐" : "龙凤胎妹妹";
    } else if (siblingYounger) {
      badge = sex === "female" ? "双胞胎姐姐" : sex === "male" ? "双胞胎哥哥" : "双胞胎";
      siblingRelation = sex === "female" ? "双胞胎妹妹" : sex === "male" ? "双胞胎弟弟" : "双胞胎";
    } else if (siblingOlder) {
      badge = sex === "female" ? "双胞胎妹妹" : sex === "male" ? "双胞胎弟弟" : "双胞胎";
    }
    return { badge, siblingName, siblingRelation, siblingSlug };
  }

  const twinSibling = facts.get("local.twin_sibling")?.value;
  if (isRecord(twinSibling)) {
    const slug = typeof twinSibling.twin_id === "string" ? twinSibling.twin_id : null;
    const rel = typeof twinSibling.relation === "string" ? twinSibling.relation.toLowerCase() : "";
    const siblingRelation = rel.includes("younger") && rel.includes("sister")
      ? "双胞胎妹妹"
      : rel.includes("older") && rel.includes("brother")
        ? "双胞胎哥哥"
        : "双胞胎";
    return { badge: "双胞胎", siblingName: null, siblingRelation, siblingSlug: slug };
  }

  return null;
}

function periodOfTime(hhmm: string): string {
  const hour = Number(hhmm.split(":")[0]);
  if (Number.isNaN(hour)) return "出生时刻";
  if (hour < 6) return "凌晨出生";
  if (hour < 12) return "上午出生";
  if (hour < 14) return "中午出生";
  if (hour < 18) return "下午出生";
  return "夜间出生";
}

function parseHighlights(
  facts: Map<string, FactDto>,
  sex: "male" | "female" | null,
  twin: ReturnType<typeof twinSummary>,
  birthPlaceZh: string | null,
  deceased: boolean,
): ProfileHighlight[] {
  const items: ProfileHighlight[] = [];

  if (!deceased) {
    const loc = facts.get("local.current_location")?.value;
    if (isRecord(loc) && typeof loc.area === "string") {
      const enclosure = splitEnclosure(loc.area);
      if (enclosure) {
        items.push({ key: "enclosure", icon: "house", label: "住在", value: enclosure.value, note: enclosure.note });
      }
    }
  }

  if (twin) {
    items.push({
      key: "twin",
      icon: "sparkles",
      label: "同胎排行",
      value: twin.badge,
      note: twin.siblingName
        ? `${twin.siblingRelation.replace(/^双胞胎|^龙凤胎/, "") || "同胎"}是${twin.siblingName}`
        : undefined,
    });
  }

  const birthSize = facts.get("local.birth_size")?.value;
  const birthWeightG = facts.get("local.birth_weight_g")?.value;
  if (isRecord(birthSize) && typeof birthSize.weight_grams === "number") {
    const length = typeof birthSize.length_cm === "number" ? `身长 ${birthSize.length_cm} cm` : undefined;
    items.push({ key: "birth-size", icon: "ruler", label: "出生时", value: `${birthSize.weight_grams} g`, note: length });
  } else if (typeof birthWeightG === "number") {
    items.push({
      key: "birth-weight",
      icon: "ruler",
      label: "出生体重",
      value: `${birthWeightG} g`,
      note: twin?.badge.includes("姐姐") || twin?.badge.includes("哥哥") ? "双胎先降生" : undefined,
    });
  }

  const rawTime =
    (typeof facts.get("local.birth_time")?.value === "string" && (facts.get("local.birth_time")?.value as string)) ||
    (isRecord(facts.get("local.birth_datetime")?.value) &&
      typeof (facts.get("local.birth_datetime")?.value as Record<string, unknown>).time === "string" &&
      ((facts.get("local.birth_datetime")?.value as Record<string, unknown>).time as string)) ||
    null;
  if (rawTime && /^\d{1,2}:\d{2}$/.test(rawTime.trim())) {
    const clean = rawTime.trim();
    items.push({ key: "birth-time", icon: "clock", label: "出生时刻", value: clean, note: periodOfTime(clean) });
  }

  const firstBdayWeight = facts.get("local.first_birthday_weight_kg")?.value;
  const hundredDays = facts.get("local.measurements_at_100_days")?.value;
  if (typeof firstBdayWeight === "number") {
    items.push({
      key: "first-year-weight",
      icon: "calendar",
      label: "周岁体重",
      value: `${firstBdayWeight} kg`,
      note: birthPlaceZh ?? undefined,
    });
  } else if (isRecord(hundredDays) && typeof hundredDays.weight_kg === "number") {
    const length = typeof hundredDays.length_cm === "number" ? `身长 ${hundredDays.length_cm} cm` : undefined;
    items.push({ key: "hundred-days", icon: "calendar", label: "百日体格", value: `${hundredDays.weight_kg} kg`, note: length });
  }

  return items.slice(0, 4);
}

function parseTraits(facts: Map<string, FactDto>): RichProfileFacts["traits"] {
  const pills: string[] = [];
  const rawFeatures = facts.get("local.institutional_identifying_features")?.value;
  const featureList = isRecord(rawFeatures) && Array.isArray(rawFeatures.features) ? rawFeatures.features : [];
  for (const item of featureList) {
    if (typeof item !== "string") continue;
    for (const [pattern, zh] of FEATURE_ZH) {
      if (pattern.test(item) && !pills.includes(zh)) pills.push(zh);
    }
  }

  const notes: string[] = [];
  const bite = facts.get("local.bite_force_feeding_adjustment")?.value;
  if (isRecord(bite) && (bite.bite_force === "lower" || String(bite.adjustment ?? "").includes("smaller pieces"))) {
    notes.push("咬合力偏弱，食物通常会切成小块");
  }
  const hind = facts.get("local.hind_limb_exercise_support")?.value;
  if (isRecord(hind) && String(hind.method ?? "").includes("pole")) {
    notes.push("平时也会通过长杆吊挂食物鼓励站立与锻炼后肢");
  }

  const careNote = notes.length > 0 ? `${notes.join("；")}。` : null;
  if (pills.length === 0 && !careNote) return null;
  return { pills: pills.slice(0, 4), careNote };
}

function parseExtraRelatives(
  facts: Map<string, FactDto>,
  twin: ReturnType<typeof twinSummary>,
): ExtractedRelative[] {
  const out: ExtractedRelative[] = [];
  const pushUnique = (rel: ExtractedRelative) => {
    if (out.some((item) => (rel.slug && item.slug === rel.slug) || item.name === rel.name)) return;
    out.push(rel);
  };

  const mother = facts.get("local.mother")?.value;
  if (isRecord(mother) && typeof mother.name === "string") {
    const name = cleanChineseName(mother.name);
    if (name) pushUnique({ slug: typeof mother.subject_id === "string" ? mother.subject_id : null, name, relation: "妈妈" });
  }
  const father = facts.get("local.father")?.value;
  if (isRecord(father) && typeof father.name === "string") {
    const name = cleanChineseName(father.name);
    if (name) pushUnique({ slug: typeof father.subject_id === "string" ? father.subject_id : null, name, relation: "爸爸" });
  }

  const parents = facts.get("local.parents")?.value;
  if (isRecord(parents)) {
    if (typeof parents.mother_name === "string") {
      const name = cleanChineseName(parents.mother_name);
      if (name) pushUnique({ slug: typeof parents.mother_id === "string" ? parents.mother_id : null, name, relation: "妈妈" });
    }
    if (typeof parents.father_name === "string") {
      const name = cleanChineseName(parents.father_name);
      if (name) pushUnique({ slug: typeof parents.father_id === "string" ? parents.father_id : null, name, relation: "爸爸" });
    }
  }

  if (twin?.siblingName) {
    pushUnique({ slug: twin.siblingSlug, name: twin.siblingName, relation: twin.siblingRelation });
  }

  const halfBrother = facts.get("local.paternal_half_brother")?.value;
  if (isRecord(halfBrother) && typeof halfBrother.sibling_label === "string") {
    const name = cleanChineseName(halfBrother.sibling_label);
    if (name) {
      pushUnique({
        slug: typeof halfBrother.sibling_id === "string" ? halfBrother.sibling_id : null,
        name,
        relation: "同父兄弟",
      });
    }
  }

  return out;
}

function parseRouteSummary(
  facts: Map<string, FactDto>,
  placesLived: PlaceLived[],
  birthDate: string | null,
  birthPlaceZh: string | null,
  currentPlace: { short: string; sub: string | null } | null,
): { routeSummary: RouteSummary | null; returnDate: string | null } {
  const departedKorea = facts.get("local.departed_everland_for_china")?.value;
  const departedChina = facts.get("local.departed_dujiangyan_for_washington")?.value;
  const arrivedDc = facts.get("local.arrived_dulles_and_entered_national_zoo")?.value;
  const debutHome = facts.get("local.first_public_appearance")?.value;
  const debutReturn = facts.get("local.first_public_viewing_after_return_to_china")?.value;

  const returnDate =
    isRecord(departedKorea) && typeof departedKorea.date === "string" ? departedKorea.date : null;

  const milestoneNotes: string[] = [];
  if (typeof debutHome === "string" && /^\d{4}-\d{2}-\d{2}/.test(debutHome)) {
    milestoneNotes.push(`${dotDate(debutHome)} 首次公开亮相`);
  }
  if (returnDate) {
    milestoneNotes.push(`${dotDate(returnDate)} 返回四川`);
  } else if (isRecord(arrivedDc) && typeof arrivedDc.date === "string") {
    milestoneNotes.push(`${dotDate(arrivedDc.date)} 抵达华盛顿`);
  } else if (isRecord(departedChina) && typeof departedChina.date === "string") {
    milestoneNotes.push(`${dotDate(departedChina.date)} 赴美`);
  } else if (isRecord(debutReturn) && typeof debutReturn.date === "string") {
    milestoneNotes.push(`${dotDate(debutReturn.date)} 回国首次亮相`);
  }
  const note = milestoneNotes.length > 0 ? milestoneNotes.slice(0, 2).join("　") : null;

  if (placesLived.length >= 2) {
    const oldest = placesLived[placesLived.length - 1]!;
    const latest = placesLived[0]!;
    return {
      returnDate,
      routeSummary: {
        fromPlace: oldest.place,
        fromYears: oldest.years || "早年",
        toPlace: latest.place,
        toYears: latest.years || (latest.current ? "常驻" : "近况"),
        note,
      },
    };
  }

  const latestPlace = placesLived[0];
  const destinationName = currentPlace?.sub ? `${currentPlace.short}${currentPlace.sub.replace(/基地$/, "")}` : latestPlace?.place ?? currentPlace?.short ?? null;
  if (birthPlaceZh && destinationName && birthPlaceZh !== destinationName && !destinationName.includes(birthPlaceZh)) {
    const birthYear = birthDate?.slice(0, 4) ?? "";
    const endYear = returnDate?.slice(0, 4) ?? latestPlace?.years.match(/\d{4}/)?.[0] ?? "";
    const fromYears = birthYear && endYear ? `${birthYear}–${endYear}　出生` : "出生";
    const toYears = latestPlace?.years ? `${latestPlace.years}　常驻` : "常驻";
    return {
      returnDate,
      routeSummary: {
        fromPlace: birthPlaceZh,
        fromYears,
        toPlace: destinationName,
        toYears,
        note,
      },
    };
  }

  return { returnDate, routeSummary: null };
}

function daysBetweenDates(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((utc2 - utc1) / 86_400_000));
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * 4 equal-looking visual weights across `[幼崽(0-2), 亚成体(2-5), 成年(5-20), 老年(20-30)]`.
 * Segment ratios match the UI track widths `[0.9, 1.1, 1.7, 1.1]`.
 */
const STAGE_WEIGHTS = [0.9, 1.1, 1.7, 1.1] as const;
const TOTAL_STAGE_WEIGHT = STAGE_WEIGHTS.reduce((sum, w) => sum + w, 0);

function stagePosition(exactYears: number): { index: 0 | 1 | 2 | 3; label: string; dotPercent: number } {
  if (exactYears < 2) {
    const pct = ((Math.min(Math.max(exactYears / 2, 0.1), 0.95) * STAGE_WEIGHTS[0]) / TOTAL_STAGE_WEIGHT) * 100;
    return { index: 0, label: "幼崽", dotPercent: Math.max(4, pct) };
  }
  if (exactYears < 5) {
    const start = STAGE_WEIGHTS[0];
    const progress = Math.min(Math.max((exactYears - 2) / 3, 0.08), 0.95);
    const pct = ((start + progress * STAGE_WEIGHTS[1]) / TOTAL_STAGE_WEIGHT) * 100;
    return { index: 1, label: "亚成体", dotPercent: pct };
  }
  if (exactYears < 20) {
    const start = STAGE_WEIGHTS[0] + STAGE_WEIGHTS[1];
    const progress = Math.min(Math.max((exactYears - 5) / 15, 0.08), 0.95);
    const pct = ((start + progress * STAGE_WEIGHTS[2]) / TOTAL_STAGE_WEIGHT) * 100;
    return { index: 2, label: "成年", dotPercent: pct };
  }
  const start = STAGE_WEIGHTS[0] + STAGE_WEIGHTS[1] + STAGE_WEIGHTS[2];
  const progress = Math.min(Math.max((exactYears - 20) / 12, 0.08), 0.95);
  const pct = ((start + progress * STAGE_WEIGHTS[3]) / TOTAL_STAGE_WEIGHT) * 100;
  return { index: 3, label: "老年", dotPercent: Math.min(96, pct) };
}

export function computeLifeStage(birthDate: string | null, deceased: boolean, today: string): LifeStageInfo | null {
  if (deceased || !birthDate || !/^\d{4}/.test(birthDate)) return null;
  const ageYears = Math.max(0, ageAt(birthDate, today));

  if (birthDate.length >= 10) {
    const [, bmStr, bdStr] = birthDate.slice(0, 10).split("-");
    const bm = Number(bmStr);
    const bd = Number(bdStr);
    const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
    if (bm && bd && ty && tm && td) {
      const thisYearBday = `${ty}-${pad2(bm)}-${pad2(bd)}`;
      const isToday = tm === bm && td === bd;
      const nextBdayYear = today.slice(0, 10) <= thisYearBday ? ty : ty + 1;
      const nextBday = `${nextBdayYear}-${pad2(bm)}-${pad2(bd)}`;
      const days = isToday ? 0 : daysBetweenDates(today.slice(0, 10), nextBday);
      const exactAge = ageYears + (1 - days / 365);
      const pos = stagePosition(exactAge);
      const nextAge = ageYears + 1;
      return {
        stageIndex: pos.index,
        stageLabel: pos.label,
        dotPercent: Math.round(pos.dotPercent),
        countdownText: isToday ? `今天 ${ageYears} 岁生日` : `距 ${nextAge} 岁生日 ${days} 天`,
      };
    }
  }

  const pos = stagePosition(ageYears + 0.3);
  return {
    stageIndex: pos.index,
    stageLabel: pos.label,
    dotPercent: Math.round(pos.dotPercent),
    countdownText: `${ageYears} 岁`,
  };
}

function buildLeadBio(input: {
  birthDate: string | null;
  sex: "male" | "female" | null;
  deceased: boolean;
  birthPlaceZh: string | null;
  returnDate: string | null;
  currentPlaceFull: string | null;
  studbookNumber: string | null;
  motherName: string | null;
  twin: ReturnType<typeof twinSummary>;
  traitPills: string[];
}): string | null {
  const year = input.birthDate?.slice(0, 4) ?? null;
  const sexNoun = input.sex === "female" ? "雌性" : input.sex === "male" ? "雄性" : null;
  const hasRichIdentity = Boolean(
    input.birthPlaceZh ||
      input.returnDate ||
      input.studbookNumber ||
      input.motherName ||
      input.twin ||
      input.traitPills.length > 0 ||
      (year && input.currentPlaceFull && sexNoun),
  );
  if (!hasRichIdentity) return null;

  const clauses: string[] = [];
  if (year && input.birthPlaceZh) {
    clauses.push(`${year} 年生于${input.birthPlaceZh}的${sexNoun ?? ""}大熊猫`);
  } else if (year) {
    clauses.push(`${year} 年出生的${sexNoun ?? ""}大熊猫`);
  } else if (input.birthPlaceZh) {
    clauses.push(`生于${input.birthPlaceZh}的${sexNoun ?? ""}大熊猫`);
  } else if (sexNoun) {
    clauses.push(`${sexNoun}大熊猫`);
  }

  if (input.returnDate) {
    clauses.push(`${formatYearMonth(input.returnDate)}回国`);
  }
  if (!input.deceased && input.currentPlaceFull) {
    clauses.push(`现居${input.currentPlaceFull}`);
  }
  if (input.studbookNumber && clauses.length < 3) {
    clauses.push(`国际谱系 ${input.studbookNumber}`);
  }
  if (input.motherName && !input.birthPlaceZh && clauses.length < 3) {
    clauses.push(`妈妈是${input.motherName}`);
  }
  if (input.twin?.siblingName && !input.birthPlaceZh && clauses.length < 4) {
    const pairKind = input.twin.badge.startsWith("龙凤胎") ? "龙凤胎" : "双胞胎";
    clauses.push(`与${input.twin.siblingName}为${pairKind}`);
  }
  if (input.traitPills.length >= 2 && clauses.length < 3) {
    clauses.push(`${input.traitPills[0]}、${input.traitPills[1]}`);
  }

  if (clauses.length < 2) return null;
  return `${clauses.join("，")}。`;
}

export function extractRichFacts(input: {
  panda: Panda;
  birthPlace: string | null;
  currentPlace: { short: string; sub: string | null } | null;
  currentPlaceFull: string | null;
  placesLived: PlaceLived[];
  canonicalMotherName: string | null;
  today: string;
}): RichProfileFacts {
  const facts = factMap(input.panda.facts);
  const sexValue = facts.get("sex")?.value ?? facts.get("local.sex")?.value;
  const sex: "male" | "female" | null = sexValue === "male" || sexValue === "female" ? sexValue : null;
  const birthValue = facts.get("birth_date")?.value ?? facts.get("local.birth_date")?.value;
  const birthDate = typeof birthValue === "string" && /^\d{4}/.test(birthValue) ? birthValue : null;
  const lifeValue = facts.get("life_status")?.value ?? facts.get("local.life_status")?.value;
  const deceased = lifeValue === "deceased";

  const birthDtVal = facts.get("local.birth_datetime")?.value;
  const rawBirthPlace =
    input.birthPlace ??
    (isRecord(birthDtVal) && typeof birthDtVal.place === "string" ? birthDtVal.place : null) ??
    (typeof facts.get("birthplace")?.value === "string" ? (facts.get("birthplace")?.value as string) : null);
  const birthPlaceZh = rawBirthPlace ? mapPlaceZh(rawBirthPlace) : null;

  const studbookNumber = parseStudbook(facts);
  const adoptionName = parseAdoptionName(facts);
  const twin = twinSummary(facts, sex);
  const highlights = parseHighlights(facts, sex, twin, birthPlaceZh, deceased);
  const traits = parseTraits(facts);
  const extraRelatives = parseExtraRelatives(facts, twin);
  const { routeSummary, returnDate } = parseRouteSummary(
    facts,
    input.placesLived,
    birthDate,
    birthPlaceZh,
    input.currentPlace,
  );
  const lifeStage = computeLifeStage(birthDate, deceased, input.today);

  const motherName =
    input.canonicalMotherName ?? extraRelatives.find((member) => member.relation === "妈妈")?.name ?? null;

  const leadBio = buildLeadBio({
    birthDate,
    sex,
    deceased,
    birthPlaceZh,
    returnDate,
    currentPlaceFull: input.currentPlaceFull,
    studbookNumber,
    motherName,
    twin,
    traitPills: traits?.pills ?? [],
  });

  const recommendedArticleSlug = traits
    ? "telling-faces-apart"
    : highlights.some((item) => item.key === "birth-size" || item.key === "birth-weight" || item.key === "twin") ||
        (lifeStage && lifeStage.stageIndex <= 1)
      ? "cubs"
      : deceased || (lifeStage && lifeStage.stageIndex === 3)
        ? "lifespan-and-health"
        : returnDate
          ? "captive-breeding"
          : "telling-faces-apart";

  return {
    studbookNumber,
    adoptionName,
    highlights,
    traits,
    extraRelatives,
    routeSummary,
    lifeStage,
    leadBio,
    recommendedArticleSlug,
  };
}
