/* eslint-disable @next/next/no-img-element */
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { PhotoGallery, type PhotoGalleryItem } from "@/components/media/photo-gallery";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import type { PandaDetail } from "@/lib/types";

import homeStyles from "../../prototype.module.css";
import { PrototypeHeader } from "../../prototype-header";
import {
  loadFanV08ResearchCatalog,
  type ResearchCatalog,
  type ResearchCatalogPanda,
} from "../research-catalog";
import {
  loadFanV08ResearchDetails,
  type ResearchDetailCatalog,
  type ResearchDetailPanda,
  type ResearchDetailRelation,
} from "../research-details";
import styles from "./detail.module.css";
import { DetailEntrance } from "./detail-motion";
import { FamilyRail } from "./family-rail";
import { HeroPhotoCarousel } from "./hero-photo-carousel";
import { LifeStoriesSection } from "./life-stories-section";
import { LifeTrack } from "./life-track";
import {
  dailyLifeCategories,
  identityStoryCategories,
  projectPandaDetailSections,
  recognitionCategories,
  reproductionCategories,
  significanceCategories,
  wildStoryCategories,
} from "./panda-detail-projection";
import { PandaFactGrid } from "./panda-fact-grid";
import { selectPandaDisplayFacts, type PandaFactKind } from "./panda-fact-selection";
import { PandaPlacesSection } from "./panda-places-section";
import { PandaProfileOverview, type PandaOverviewRow } from "./panda-profile-overview";
import { PandaProfilePhoto } from "./panda-profile-photo";
import { toPandaPublicText } from "./panda-public-copy";
import { PandaTraitScenes } from "./panda-trait-scenes";
import { RecentMomentsSection } from "./recent-moments-section";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

function route(value: string): Route {
  return value as Route;
}

async function loadOptionalPublicAtlas(locale: "zh" | "en") {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      loadV2PublicAtlasDataset(locale),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), 1200);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function sexLabel(value: string | null | undefined, zh: boolean): string | null {
  if (value === "female") return zh ? "雌性" : "Female";
  if (value === "male") return zh ? "雄性" : "Male";
  return null;
}

function compactDate(value: string, locale: "zh" | "en"): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function pandaName(panda: PandaDetail, locale: "zh" | "en"): string {
  return locale === "zh" ? panda.name_zh : panda.name_en || panda.name_zh;
}

function eventPlace(panda: PandaDetail["events"][number], locale: "zh" | "en"): string {
  const from = panda.from_coarse_location;
  const to = panda.to_coarse_location;
  if (from && to && from !== to) return `${from} → ${to}`;
  return to || from || (locale === "zh" ? "生活记录" : "Life event");
}

function localizedPlace(value: string | null | undefined, zh: boolean): string | null {
  if (!value) return null;
  if (!zh) return value;
  const mappings: Array<[RegExp, string]> = [
    [/^Chengdu Research Base of Giant Panda Breeding$/i, "成都大熊猫繁育研究基地"],
    [/^China Conservation and Research Center for the Giant Panda$/i, "中国大熊猫保护研究中心"],
    [/Wolong Shenshuping/i, "卧龙神树坪基地"],
    [/Bifengxia/i, "雅安碧峰峡基地"],
    [/Dujiangyan Base/i, "都江堰基地"],
    [/Beijing Zoo/i, "北京动物园"],
    [/Chongqing Zoo/i, "重庆动物园"],
    [/Smithsonian.*National Zoo/i, "史密森尼国家动物园"],
    [/San Diego Zoo/i, "圣迭戈动物园"],
    [/Zoo Atlanta/i, "亚特兰大动物园"],
    [/Ocean Park Hong Kong/i, "香港海洋公园"],
  ];
  for (const [pattern, label] of mappings) {
    if (pattern.test(value)) return label;
  }
  return value;
}

function uniqueMedia(items: PandaDetail["media"]): PandaDetail["media"] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function relationNameFromChineseSummary(relation: ResearchDetailRelation): string | null {
  const summary = relation.summary_zh?.trim();
  if (!summary) return null;
  const patternsByKind: Record<string, RegExp[]> = {
    mother: [/母亲(?:是|为)([^、，。；]+)/u],
    father: [/父亲(?:是|为)([^、，。；]+)/u],
    twin: [/双胞胎(?:哥哥|弟弟|姐姐|妹妹|兄弟|姐妹)?(?:是|为)([^、，。；]+)/u],
    sibling: [/(?:双胞胎(?:哥哥|弟弟|姐姐|妹妹|兄弟|姐妹)?|兄弟|姐妹|同胞)(?:是|为)([^、，。；]+)/u],
    child: [/(?:女儿|儿子|幼仔|幼崽|后代)(?:是|为)([^、，。；]+)/u],
  };
  for (const pattern of patternsByKind[relation.kind] ?? []) {
    const match = summary.match(pattern)?.[1]?.trim();
    if (match) return match;
  }
  return null;
}

function chineseNameFromRelationLabel(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const candidates = [
    ...label.split(/[\/／]/u).slice(1),
    ...[...label.matchAll(/[（(]([^()（）]+)[）)]/gu)].map((match) => match[1]),
  ];
  for (const candidate of candidates) {
    const clean = candidate
      .split(/[，,；;]/u)[0]
      .replace(/[（(].*$/u, "")
      .trim();
    if (/^[\p{Script=Han}·]{1,12}$/u.test(clean)) return clean;
  }
  return null;
}

function researchRelationName(relation: ResearchDetailRelation, locale: "zh" | "en"): string {
  if (locale === "zh") {
    const factName = relationNameFromChineseSummary(relation);
    if (factName) return factName;
  }
  const localized = locale === "zh" ? relation.target_name_zh : relation.target_name_en;
  if (locale === "zh") {
    if (localized && /\p{Script=Han}/u.test(localized)) return localized;
    const labelName = chineseNameFromRelationLabel(relation.target_label);
    if (labelName) return labelName;
  }
  if (localized) return localized;
  const label = relation.target_label?.trim();
  if (!label) return relation.target_subject_id ?? "—";
  const parts = label.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return label;
  return locale === "zh" ? parts.at(-1)! : parts[0]!;
}

function familyGroupForKind(kind: string, zh: boolean): string | null {
  if (["mother", "father", "parent"].includes(kind)) return zh ? "父母" : "Parents";
  if (kind === "child") return zh ? "子女" : "Children";
  if (["sibling", "twin"].includes(kind)) return zh ? "兄弟姐妹" : "Siblings";
  if (["foster_mother", "foster_child"].includes(kind)) return zh ? "照护关系" : "Care relationships";
  return null;
}

const SIBLING_ROLE_SIGNAL_RE = /(?:哥哥|弟弟|姐姐|妹妹|老大|老二|大仔|大崽|小仔|小崽|先出生|后出生|年长|年幼|兄姐|弟妹|姐弟|兄妹|兄弟|姐妹)/u;

function preferredSiblingSummary(
  subjectId: string | null | undefined,
  relation: ResearchDetailRelation,
  details: ResearchDetailCatalog | null,
): string | null {
  const currentSummary = relation.summary_zh?.trim() ?? null;
  if (!["sibling", "twin"].includes(relation.kind)) return currentSummary;
  if (currentSummary && SIBLING_ROLE_SIGNAL_RE.test(currentSummary)) return currentSummary;
  if (!subjectId || !relation.target_subject_id) return currentSummary;
  const targetDetail = details?.subjects[relation.target_subject_id];
  const reciprocalCandidates = (targetDetail?.relations ?? []).filter((candidate) =>
    ["sibling", "twin"].includes(candidate.kind)
    && candidate.target_subject_id === subjectId
    && Boolean(candidate.summary_zh?.trim()),
  );
  const reciprocal = reciprocalCandidates.find((candidate) =>
    SIBLING_ROLE_SIGNAL_RE.test(candidate.summary_zh ?? ""),
  ) ?? reciprocalCandidates[0] ?? null;
  return reciprocal?.summary_zh?.trim() ?? currentSummary;
}

function isDisplayableFamilyRelation(relation: ResearchDetailRelation): boolean {
  if (relation.target_slug || relation.target_subject_id) return true;
  const label = relation.target_label?.trim() ?? "";
  if (!label) return false;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(label)) return false;
  if (/^(?:older|younger)\s+twin$/iu.test(label)) return false;
  if (/^(?:unknown|未知|未确认)$/iu.test(label)) return false;
  if (/(?:Zoo|Wildlife Park|Breeding Center|动物园|野生动物园|基地|保护区|繁育中心)$/iu.test(label)) return false;
  const words = label.split(/\s+/u).filter(Boolean);
  if (label.length > 48 && words.length >= 6) return false;
  if (/\b(?:alternated|nursing|hand-feeding|hand-rearing|maternal care|keeper|often follows|follows older|follows younger)\b/iu.test(label)) return false;
  return true;
}

function familyRoleLabel({
  kind,
  gender,
  subjectGender,
  subjectName,
  targetName,
  targetLabel,
  summaryZh,
  parentageStatus,
  zh,
}: {
  kind: string;
  gender: string | null | undefined;
  subjectGender: string | null | undefined;
  subjectName: string;
  targetName: string;
  targetLabel?: string | null;
  summaryZh?: string | null;
  parentageStatus?: string | null;
  zh: boolean;
}): string {
  const labelText = targetLabel ?? "";
  const summaryText = summaryZh ?? "";
  const targetEvidence = `${targetName} ${labelText}`;
  const targetMaleCue = /(?:之子|儿子|独生子|长子|次子|哥哥|弟弟|父亲|爸爸|父系|雄性|雄仔|\bmale\b|\bson\b|\bfather\b)/iu.test(targetEvidence);
  const targetFemaleCue = /(?:之女|女儿|独生女|长女|次女|姐姐|妹妹|母亲|妈妈|母系|雌性|雌仔|\bfemale\b|\bdaughter\b|\bmother\b)/iu.test(targetEvidence);
  const escapedTargetName = [...targetName]
    .map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\${character}` : character)
    .join("");
  const escapedSubjectName = [...subjectName]
    .map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\${character}` : character)
    .join("");

  if (["sibling", "twin"].includes(kind)) {
    if (/(?:双胞胎|同胎)[^。；]{0,8}兄弟/u.test(summaryText)) return zh ? "兄弟" : "Brother";
    if (/(?:双胞胎|同胎)[^。；]{0,8}姐妹/u.test(summaryText)) return zh ? "姐妹" : "Sister";
    const subjectFirstPair = summaryText.match(new RegExp(`${escapedSubjectName}[^。；]{0,24}${escapedTargetName}[^。；]{0,24}(姐弟|兄妹|兄弟|姐妹)`, "u"))?.[1] ?? null;
    const targetFirstPair = summaryText.match(new RegExp(`${escapedTargetName}[^。；]{0,24}${escapedSubjectName}[^。；]{0,24}(姐弟|兄妹|兄弟|姐妹)`, "u"))?.[1] ?? null;
    const pairRole = subjectFirstPair
      ? ({ 姐弟: "弟弟", 兄妹: "妹妹", 兄弟: "兄弟", 姐妹: "姐妹" } as Record<string, string>)[subjectFirstPair]
      : targetFirstPair
        ? ({ 姐弟: "姐姐", 兄妹: "哥哥", 兄弟: "兄弟", 姐妹: "姐妹" } as Record<string, string>)[targetFirstPair]
        : null;
    if (pairRole) {
      if (zh) return pairRole;
      return ({ 弟弟: "Younger brother", 妹妹: "Younger sister", 哥哥: "Older brother", 姐姐: "Older sister", 兄弟: "Brother", 姐妹: "Sister" } as Record<string, string>)[pairRole] ?? "Sibling";
    }
    const labelRole = labelText.match(/(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)/u)?.[1] ?? null;
    const targetRole = summaryText.match(new RegExp(`(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)[^。；，、]{0,12}${escapedTargetName}`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`${escapedTargetName}(?:是|为|列为)(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`${escapedTargetName}(?:是|为|列为)${escapedSubjectName}(?:的)?(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)`, "u"))?.[1]
      ?? null;
    const subjectRole = summaryText.match(new RegExp(`${escapedSubjectName}(?:是|为|列为)(?:${escapedTargetName}(?:的)?)?(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`${escapedSubjectName}[^。；，]{0,12}${escapedTargetName}(?:的)?(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)(?:是|为)?[^。；，、]{0,8}${escapedSubjectName}`, "u"))?.[1]
      ?? null;
    const targetOrderCue = summaryText.match(new RegExp(`${escapedTargetName}[^。；，、]{0,12}(老大|老二|大仔|大崽|小仔|小崽|先出生(?:个体)?|后出生(?:个体)?|年长|年幼)`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`(老大|老二|大仔|大崽|小仔|小崽|先出生(?:个体)?|后出生(?:个体)?|年长|年幼)[^。；，、]{0,12}${escapedTargetName}`, "u"))?.[1]
      ?? null;
    const subjectOrderCue = summaryText.match(new RegExp(`${escapedSubjectName}[^。；，、]{0,12}(老大|老二|大仔|大崽|小仔|小崽|先出生(?:个体)?|后出生(?:个体)?|年长|年幼)`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`(老大|老二|大仔|大崽|小仔|小崽|先出生(?:个体)?|后出生(?:个体)?|年长|年幼)[^。；，、]{0,12}${escapedSubjectName}`, "u"))?.[1]
      ?? null;
    const olderOrderCue = /^(?:老大|大仔|大崽|先出生|先出生个体|年长)$/u;
    const youngerOrderCue = /^(?:老二|小仔|小崽|后出生|后出生个体|年幼)$/u;
    const targetOrderFromCue = targetOrderCue
      ? (olderOrderCue.test(targetOrderCue) ? "older" : youngerOrderCue.test(targetOrderCue) ? "younger" : null)
      : subjectOrderCue
        ? (olderOrderCue.test(subjectOrderCue) ? "younger" : youngerOrderCue.test(subjectOrderCue) ? "older" : null)
        : null;
    const subjectGroupOrderCue = summaryText.match(new RegExp(`${escapedSubjectName}[^。；，]{0,20}(兄姐|弟妹)`, "u"))?.[1] ?? null;
    const targetGroupOrderCue = summaryText.match(new RegExp(`${escapedTargetName}[^。；，]{0,20}(兄姐|弟妹)`, "u"))?.[1] ?? null;
    const targetOrderFromGroup = subjectGroupOrderCue
      ? (subjectGroupOrderCue === "兄姐" ? "older" : "younger")
      : targetGroupOrderCue
        ? (targetGroupOrderCue === "兄姐" ? "younger" : "older")
        : null;
    const inferredTargetGender = gender === "male" || gender === "female"
      ? gender
      : targetMaleCue && !targetFemaleCue
        ? "male"
        : targetFemaleCue && !targetMaleCue
          ? "female"
          : null;
    const targetOrderFromSubjectRole = subjectRole
      ? (["哥哥", "姐姐"].includes(subjectRole) ? "younger" : "older")
      : null;
    const targetOrder = targetOrderFromCue ?? targetOrderFromSubjectRole ?? targetOrderFromGroup;
    const inverseRole = targetOrder && inferredTargetGender
      ? targetOrder === "older"
        ? (inferredTargetGender === "male" ? "哥哥" : "姐姐")
        : (inferredTargetGender === "male" ? "弟弟" : "妹妹")
      : null;
    const orderOnlyRole = targetOrder === "older" ? "年长同胞" : targetOrder === "younger" ? "年幼同胞" : null;
    const siblingZh = labelRole ?? targetRole ?? inverseRole ?? orderOnlyRole;
    if (siblingZh) {
      if (zh) return siblingZh;
      return ({ 哥哥: "Older brother", 弟弟: "Younger brother", 姐姐: "Older sister", 妹妹: "Younger sister", 年长同胞: "Older sibling", 年幼同胞: "Younger sibling" } as Record<string, string>)[siblingZh] ?? "Sibling";
    }
  }

  if (kind === "foster_mother") return zh ? "代养母亲" : "Foster mother";
  if (kind === "foster_child") return zh ? "代养幼崽" : "Foster cub";

  if (parentageStatus === "disputed") {
    if (kind === "father") return zh ? "父本争议候选" : "Disputed sire candidate";
    if (kind === "mother") return zh ? "母本争议候选" : "Disputed dam candidate";
    if (kind === "parent") return zh ? "亲本争议候选" : "Disputed parent candidate";
  }
  if (parentageStatus === "tentative") {
    if (kind === "father") return zh ? "父本候选" : "Sire candidate";
    if (kind === "mother") return zh ? "母本候选" : "Dam candidate";
    if (kind === "parent") return zh ? "亲本候选" : "Parent candidate";
  }
  if (kind === "father") return zh ? "父亲" : "Father";
  if (kind === "mother") return zh ? "母亲" : "Mother";
  if (kind === "parent") {
    if (targetFemaleCue && !targetMaleCue) return zh ? "母亲" : "Mother";
    if (targetMaleCue && !targetFemaleCue) return zh ? "父亲" : "Father";
    if (summaryText && new RegExp(`母亲(?:是|为)?${escapedTargetName}|${escapedTargetName}(?:是|为)?[^。；，]{0,6}母亲`, "u").test(summaryText)) return zh ? "母亲" : "Mother";
    if (summaryText && new RegExp(`父亲(?:是|为)?${escapedTargetName}|${escapedTargetName}(?:是|为)?[^。；，]{0,6}父亲`, "u").test(summaryText)) return zh ? "父亲" : "Father";
    if (/仅保留母亲名称|母本名称/u.test(summaryText)) return zh ? "母亲" : "Mother";
    if (/仅保留父亲名称|父本名称/u.test(summaryText)) return zh ? "父亲" : "Father";
    if (gender === "male") return zh ? "父亲" : "Father";
    if (gender === "female") return zh ? "母亲" : "Mother";
    return zh ? "亲本（身份待确认）" : "Parent (role not yet confirmed)";
  }
  if (kind === "child") {
    if (targetMaleCue && !targetFemaleCue) return zh ? "儿子" : "Son";
    if (targetFemaleCue && !targetMaleCue) return zh ? "女儿" : "Daughter";
    const targetPostRole = summaryText.match(new RegExp(`${escapedTargetName}[^。；，、]{0,12}?(儿子|女儿|之子|之女|雄性(?:幼仔|幼崽|双胞胎)?|雌性(?:幼仔|幼崽|双胞胎)?|雄仔|雌仔)`, "u"))?.[1] ?? null;
    if (targetPostRole && /^(?:儿子|之子|雄性|雄仔)/u.test(targetPostRole)) return zh ? "儿子" : "Son";
    if (targetPostRole && /^(?:女儿|之女|雌性|雌仔)/u.test(targetPostRole)) return zh ? "女儿" : "Daughter";
    const targetMaleSummary = summaryText && new RegExp(`(?:之子|儿子|独生子|长子|次子|雄性(?:幼仔|幼崽|双胞胎)?|雄仔)[^。；，、]{0,10}${escapedTargetName}|${escapedTargetName}[^。；，、]{0,10}(?:之子|儿子|独生子|长子|次子|雄性(?:幼仔|幼崽|双胞胎)?|雄仔)`, "u").test(summaryText);
    const targetFemaleSummary = summaryText && new RegExp(`(?:之女|女儿|独生女|长女|次女|雌性(?:幼仔|幼崽|双胞胎)?|雌仔)[^。；，、]{0,10}${escapedTargetName}|${escapedTargetName}[^。；，、]{0,10}(?:之女|女儿|独生女|长女|次女|雌性(?:幼仔|幼崽|双胞胎)?|雌仔)`, "u").test(summaryText);
    const groupedMaleSummary = summaryText && (
      new RegExp(`(?:育有|共有|包括|：|:|^|女儿[及和与]|[，；。])(?:(?!儿子|女儿)[^。；]){0,80}${escapedTargetName}(?:(?!儿子|女儿)[^。；]){0,80}(?:[一二三四五六七八九十两0-9]+只)?儿子`, "u").test(summaryText)
      || new RegExp(`(?:[一二三四五六七八九十两0-9]+只)?儿子(?:为|有|包括|是|：)(?:(?!儿子|女儿)[^。；]){0,80}${escapedTargetName}`, "u").test(summaryText)
    );
    const groupedFemaleSummary = summaryText && (
      new RegExp(`(?:育有|共有|包括|：|:|^|儿子[及和与]|[，；。])(?:(?!儿子|女儿)[^。；]){0,80}${escapedTargetName}(?:(?!儿子|女儿)[^。；]){0,80}(?:[一二三四五六七八九十两0-9]+只)?女儿`, "u").test(summaryText)
      || new RegExp(`(?:[一二三四五六七八九十两0-9]+只)?女儿(?:为|有|包括|是|：)(?:(?!儿子|女儿)[^。；]){0,80}${escapedTargetName}`, "u").test(summaryText)
    );
    if ((targetMaleSummary || groupedMaleSummary) && !(targetFemaleSummary || groupedFemaleSummary)) return zh ? "儿子" : "Son";
    if ((targetFemaleSummary || groupedFemaleSummary) && !(targetMaleSummary || groupedMaleSummary)) return zh ? "女儿" : "Daughter";
    if (gender === "male") return zh ? "儿子" : "Son";
    if (gender === "female") return zh ? "女儿" : "Daughter";
    const childOrderEvidence = `${targetName} ${labelText}`;
    const olderChildCue = /(?:大仔|大崽)/u.test(childOrderEvidence);
    const youngerChildCue = /(?:小仔|小崽)/u.test(childOrderEvidence);
    if (olderChildCue && !youngerChildCue) return zh ? "年长孩子" : "Older child";
    if (youngerChildCue && !olderChildCue) return zh ? "年幼孩子" : "Younger child";
    const summaryMale = /(?:之子|儿子|独生子|长子|次子|雄性|雄仔|母子|父子)/u.test(summaryText);
    const summaryFemale = /(?:之女|女儿|独生女|长女|次女|雌性|雌仔|母女|父女)/u.test(summaryText);
    if (summaryMale && !summaryFemale) return zh ? "儿子" : "Son";
    if (summaryFemale && !summaryMale) return zh ? "女儿" : "Daughter";
    return zh ? "孩子（性别待确认）" : "Child (sex not yet confirmed)";
  }
  if (["sibling", "twin"].includes(kind)) {
    if (targetMaleCue && !targetFemaleCue) return zh ? "兄弟" : "Brother";
    if (targetFemaleCue && !targetMaleCue) return zh ? "姐妹" : "Sister";
    if (gender === "male") return zh ? "兄弟" : "Brother";
    if (gender === "female") return zh ? "姐妹" : "Sister";
    const targetMaleSummary = summaryText && new RegExp(`${escapedTargetName}[^。；，、]{0,8}(?:（雄）|\(雄\)|为雄性|是雄性|雄性幼仔|雄性幼崽)`, "u").test(summaryText);
    const targetFemaleSummary = summaryText && new RegExp(`${escapedTargetName}[^。；，、]{0,8}(?:（雌）|\(雌\)|为雌性|是雌性|雌性幼仔|雌性幼崽)`, "u").test(summaryText);
    if (targetMaleSummary && !targetFemaleSummary) return zh ? "兄弟" : "Brother";
    if (targetFemaleSummary && !targetMaleSummary) return zh ? "姐妹" : "Sister";
    if (/(?:双胞胎|同胎)?兄弟|雄性双胞胎/u.test(summaryText)) return zh ? "兄弟" : "Brother";
    if (/(?:双胞胎|同胎)?姐妹|雌性双胞胎/u.test(summaryText)) return zh ? "姐妹" : "Sister";
    if (/(?:兄妹|姐弟|龙凤胎)/u.test(summaryText)) {
      if (subjectGender === "male") return zh ? "姐妹" : "Sister";
      if (subjectGender === "female") return zh ? "兄弟" : "Brother";
    }
    return zh ? "同胞（性别待确认）" : "Sibling (sex not yet confirmed)";
  }
  return zh ? "亲属" : "Relative";
}

interface ProfileMediaCandidate {
  id: string;
  rawId: string;
  url: string;
  credit: string | null;
  rights: string | null;
  sourceUrl: string | null;
  description: string | null;
}

const preferredHeroMediaBySlug: Record<string, string> = {
  "chi-chi-london-1957": "local-media-commons-e52a9a325aa67b925119",
};

function isLikelyNonPhotographic(candidate: ProfileMediaCandidate): boolean {
  const value = `${candidate.rawId} ${candidate.url} ${candidate.description ?? ""} ${candidate.rights ?? ""}`;
  if (candidate.rawId === "local-media-batch371-wolong-white-panda-tracked-2019") return true;
  if (/(?:illustration|cartoon|avatar|logo|插画|卡通|头像|示意图)/i.test(value)) return true;
  if (/pandapia\.com\/upload\/misc\/crop\//i.test(candidate.url) && /\.png(?:$|\?)/i.test(candidate.url)) return true;
  return false;
}

function heroMediaScore(candidate: ProfileMediaCandidate): number {
  const value = `${candidate.rawId} ${candidate.url} ${candidate.credit ?? ""} ${candidate.rights ?? ""}`;
  let score = 0;
  if (/portrait/i.test(value)) score += 42;
  if (/(?:history|archive)/i.test(value)) score += 14;
  if (/(?:CC BY|CC0|public domain|Wikimedia Commons)/i.test(value)) score += 18;
  if (/(?:official|zoo|reserve|保护区|动物园)/i.test(value)) score += 8;
  if (/\.(?:jpe?g)(?:$|\?)/i.test(candidate.url)) score += 6;
  if (/\.png(?:$|\?)/i.test(candidate.url)) score -= 2;
  return score;
}

function pickHeroMedia(slug: string, candidates: ProfileMediaCandidate[]): ProfileMediaCandidate | null {
  const usable = candidates.filter((candidate) => !isLikelyNonPhotographic(candidate));
  const preferredRawId = preferredHeroMediaBySlug[slug];
  if (preferredRawId) {
    const preferred = usable.find((candidate) => candidate.rawId === preferredRawId);
    if (preferred) return preferred;
  }
  return usable
    .map((candidate, index) => ({ candidate, index, score: heroMediaScore(candidate) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.candidate ?? null;
}

function normalizeMention(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s·・._'’"-]+/g, "");
}

function resolveResearchPandaMention(
  name: string,
  catalog: ResearchCatalog | null,
  details: ResearchDetailCatalog | null,
): ResearchCatalogPanda | null {
  if (!catalog) return null;
  const normalized = normalizeMention(name);
  const exact = catalog.pandas.find((panda) =>
    [panda.name_zh, panda.name_en, panda.label].filter(Boolean).some((value) => normalizeMention(String(value)) === normalized),
  );
  if (exact) return exact;
  if (!details || !/[\u3400-\u9fff]/u.test(name)) return null;

  let best: { panda: ResearchCatalogPanda; score: number } | null = null;
  for (const panda of catalog.pandas) {
    const detail = details.subjects[panda.id];
    if (!detail) continue;
    const score = (detail.facts ?? detail.highlights ?? []).reduce((total, fact) => {
      const text = fact.summary_zh?.trim() ?? "";
      return total + (text.startsWith(name) ? 2 : 0);
    }, 0);
    if (score >= 2 && (!best || score > best.score)) best = { panda, score };
  }
  return best?.panda ?? null;
}

function inferredSiblingRelations(
  detail: ResearchDetailPanda | null,
  displayName: string,
  catalog: ResearchCatalog | null,
  details: ResearchDetailCatalog | null,
): Array<{ id: string; name: string; slug: string | null }> {
  if (!detail) return [];
  const names = new Set<string>();
  const escapedName = [...displayName]
    .map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\${character}` : character)
    .join("");
  for (const fact of detail.facts ?? detail.highlights ?? []) {
    const text = fact.summary_zh?.trim() ?? "";
    if (!text || !(/twin|sibling/i.test(fact.predicate) || /双胞胎|兄弟姐妹/.test(text))) continue;
    const direct = text.match(/双胞胎(?:妹妹|姐姐|弟弟|哥哥|姐妹|兄弟)?(?:是|为)([^、，。；]+)/u)?.[1]?.trim();
    if (direct) names.add(direct);
    const paired = text.match(new RegExp(`${escapedName}与([^、，。；]+)是[^。；]*双胞胎`, "u"))?.[1]?.trim();
    if (paired) names.add(paired);
  }
  return [...names]
    .filter((name) => name && name !== displayName)
    .map((name) => {
      const match = resolveResearchPandaMention(name, catalog, details);
      return {
        id: match?.id ?? `inferred-twin:${name}`,
        name,
        slug: match?.slug ?? null,
      };
    });
}

function inferredParentRelations(
  detail: ResearchDetailPanda | null,
  displayName: string,
  catalog: ResearchCatalog | null,
  details: ResearchDetailCatalog | null,
): Array<{ id: string; name: string; slug: string | null }> {
  if (!detail) return [];
  const names = new Set<string>();
  const escapedName = [...displayName]
    .map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\${character}` : character)
    .join("");
  for (const fact of detail.facts ?? detail.highlights ?? []) {
    const text = fact.summary_zh?.trim() ?? "";
    if (!text) continue;
    const mother = text.match(/与母亲([^在、，。；]{1,12})(?=在|一起|、|，|。|；)/u)?.[1]?.trim()
      ?? text.match(new RegExp(`[‘“「]([^’”」]{1,12})照顾(?:儿子|女儿|幼仔)?${escapedName}[’”」]`, "u"))?.[1]?.trim()
      ?? null;
    if (mother) names.add(mother);
  }
  return [...names]
    .filter((name) => name && name !== displayName)
    .map((name) => {
      const match = resolveResearchPandaMention(name, catalog, details);
      return {
        id: match?.id ?? `inferred-parent:${name}`,
        name,
        slug: match?.slug ?? null,
      };
    });
}

function journeyLabel(journey: string, era: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    managed: ["迁地保护个体", "Managed-care panda"],
    wild_native: ["野生个体", "Wild panda"],
    wild_rescued_in_care: ["野生救护个体", "Wild-rescued panda"],
    wild_rescued_released: ["野生救护后放归", "Wild-rescued and released"],
    rewilding_training: ["野化培训中", "In rewilding training"],
    rewilding_released: ["野化后放归", "Rewilded and released"],
    released_to_wild: ["已放归野外", "Released to the wild"],
  };
  if (labels[journey]) return labels[journey][zh ? 0 : 1];
  if (era === "historical") return zh ? "历史个体" : "Historical panda";
  return zh ? "大熊猫个体" : "Giant panda";
}

function statusLabel(lifeStatus: string | null | undefined, deathDate: string | null, zh: boolean): string {
  if (lifeStatus === "alive") return zh ? "在世" : "Living";
  if (lifeStatus === "deceased" || deathDate) {
    if (deathDate) return zh ? `已离世 · ${compactDate(deathDate, "zh")}` : `Deceased · ${compactDate(deathDate, "en")}`;
    return zh ? "已离世" : "Deceased";
  }
  return zh ? "状态待确认" : "Status not yet confirmed";
}

function familySummary(
  groups: Array<{ items: Array<{ name: string; role: string }> }>,
  zh: boolean,
): string | null {
  const namesByRole = new Map<string, Map<string, string>>();
  for (const item of groups.flatMap((group) => group.items)) {
    const names = namesByRole.get(item.role) ?? new Map<string, string>();
    const name = item.name.trim();
    if (name) names.set(name.toLocaleLowerCase(), name);
    namesByRole.set(item.role, names);
  }
  if (!namesByRole.size) return null;
  return [...namesByRole.entries()]
    .map(([role, names]) => `${role}${zh ? "：" : ": "}${[...names.values()].slice(0, 4).join(zh ? "、" : ", ")}`)
    .join(zh ? "；" : "; ");
}

function extractOverviewPlace(
  facts: Array<{ category: string; predicate: string; text: string }>,
  journey: string,
  zh: boolean,
): string | null {
  if (journey === "wild_native") return null;
  const ranked = facts
    .map((fact, index) => {
      const value = `${fact.predicate} ${fact.text}`;
      const score = /current[_ -]?location|observed[_ -]?(?:location|residence)/i.test(fact.predicate)
        ? 100
        : /现在生活在|目前生活在|正在[^。；]*(?:基地|动物园|圈舍)/.test(value)
          ? 94
          : /residence|居住在|入住/.test(value)
            ? 82
            : 40;
      return { fact, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  for (const { fact } of ranked) {
    const text = fact.text;
    const match = zh
      ? [
        /(?:现在|目前)?生活在([^，。；]+)/u,
        /居住在([^，。；]+)/u,
        /入住([^，。；]+)/u,
        /正在([^，。；]{2,28}(?:圈舍|基地|动物园|保护区))进行/u,
        /返回([^，。；]{2,28}(?:基地|动物园))/u,
        /抵达([^，。；]{2,28}(?:基地|动物园|保护区))/u,
        /来到([^，。；]{2,28}(?:基地|动物园|保护区))/u,
      ].map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean)
      : [/(?:lives at|resides at|staying at|returned to)\s+([^.;]+)/i].map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean);
    if (match) return localizedPlace(match, zh);
  }
  return null;
}

function datedJourneyFact(
  detail: ResearchDetailPanda | null,
  category: "rescue" | "release",
  locale: "zh" | "en",
): string | null {
  const fact = (detail?.facts ?? []).find((item) => item.category === category && item.date);
  if (!fact?.date) return null;
  const text = locale === "zh" ? fact.summary_zh ?? "" : fact.summary_en ?? fact.summary_zh ?? "";
  const location = locale === "zh"
    ? text.match(/(?:在|误入)([^，。；]{2,30}(?:保护区|基地|动物园|闹市))/u)?.[1]?.trim() ?? null
    : null;
  return `${compactDate(fact.date, locale)}${location ? ` · ${location}` : ""}`;
}

const lifeJourneyCategories = new Set([
  "birth",
  "death",
  "transfer",
  "location",
  "residency_history",
  "public_debut",
  "reproduction",
  "maternal_care",
  "health",
  "veterinary_care",
  "milestone",
  "rescue",
  "release",
  "wild_monitoring",
  "rewilding",
  "research",
  "conservation",
  "diplomacy",
]);

const timelineDetailNoise = /(?:birth_date|natural_mating|water_broke|feeding|intake|weight|grams?|documented_|photographed_on|age[_ -]?observed)/i;

function aboutIdentityParagraph({
  displayName,
  zh,
  sex,
  birthLabel,
  birthplace,
  place,
  familyGroups,
}: {
  displayName: string;
  zh: boolean;
  sex: string;
  birthLabel: string | null;
  birthplace: string | null;
  place: string | null;
  familyGroups: Array<{
    items: Array<{
      name: string;
      role: string;
      relationKind: string;
      targetLabel?: string | null;
      summaryZh?: string | null;
    }>;
  }>;
}): string | null {
  const family = familyGroups.flatMap((group) => group.items);
  const father = family.find((item) => item.role === (zh ? "父亲" : "Father")) ?? null;
  const mother = family.find((item) => item.role === (zh ? "母亲" : "Mother")) ?? null;
  const exactSiblingRoles = zh
    ? new Set(["哥哥", "弟弟", "姐姐", "妹妹"])
    : new Set(["Older brother", "Younger brother", "Older sister", "Younger sister"]);
  const sibling = family.find((item) => exactSiblingRoles.has(item.role))
    ?? family.find((item) => item.relationKind === "twin" || item.relationKind === "sibling")
    ?? null;
  const siblingIsTwin = Boolean(sibling && (
    sibling.relationKind === "twin"
    || /(?:双胞胎|同胎|twin)/iu.test(`${sibling.targetLabel ?? ""} ${sibling.summaryZh ?? ""}`)
  ));

  const hasIdentityDetail = Boolean(birthLabel || birthplace || place || father || mother || sibling || sex === "male" || sex === "female");
  if (!hasIdentityDetail) return null;

  if (!zh) {
    const identity = sex === "male" ? "a male giant panda" : sex === "female" ? "a female giant panda" : "a giant panda";
    const born = birthLabel
      ? ` born ${birthplace ? `at ${birthplace} on ${birthLabel}` : `on ${birthLabel}`}`
      : birthplace ? ` born at ${birthplace}` : "";
    const sentences = [`${displayName} is ${identity}${born}.`];
    if (father && mother) sentences.push(`Its parents are ${father.name} and ${mother.name}.`);
    else if (father) sentences.push(`Its father is ${father.name}.`);
    else if (mother) sentences.push(`Its mother is ${mother.name}.`);
    if (sibling) sentences.push(`${sibling.name} is a sibling${siblingIsTwin ? " and twin" : ""}.`);
    if (place) sentences.push(`${displayName} currently lives at ${place}.`);
    return sentences.join(" ");
  }

  const subjectChildRole = sex === "male" ? "儿子" : sex === "female" ? "女儿" : null;
  const parts: string[] = [];
  if (birthLabel && birthplace) parts.push(`${displayName}于${birthLabel}出生在${birthplace}`);
  else if (birthLabel) parts.push(`${displayName}出生于${birthLabel}`);
  else if (birthplace) parts.push(`${displayName}出生在${birthplace}`);
  else if (sex === "male") parts.push(`${displayName}是一只雄性大熊猫`);
  else if (sex === "female") parts.push(`${displayName}是一只雌性大熊猫`);
  else parts.push(`${displayName}是一只大熊猫`);

  if (father && mother && subjectChildRole) {
    parts.push(`是${father.name}和${mother.name}的${subjectChildRole}`);
  } else if (father && mother) {
    parts.push(`父亲是${father.name}，母亲是${mother.name}`);
  } else if (father) {
    parts.push(`父亲是${father.name}`);
  } else if (mother) {
    parts.push(`母亲是${mother.name}`);
  }

  let paragraph = `${parts.join("，")}。`;
  if (sibling) {
    const role = sibling.role.replace(/^双胞胎/u, "");
    const exactRole = exactSiblingRoles.has(sibling.role);
    if (siblingIsTwin && exactRole) paragraph += `${displayName}和${sibling.name}是双胞胎，${sibling.name}是${role}。`;
    else if (siblingIsTwin) paragraph += `${displayName}和${sibling.name}是双胞胎。`;
    else if (exactRole) paragraph += `${sibling.name}是${displayName}的${role}。`;
    else paragraph += `${displayName}和${sibling.name}是同胞。`;
  } else if (place) {
    paragraph += `目前生活在${place}。`;
  }
  if (!birthLabel && !birthplace && sex !== "male" && sex !== "female" && !place && (father || mother)) {
    paragraph += "现有资料没有完整留下它的出生日期和后续经历。";
  }
  return paragraph;
}

function articleParagraphs({
  displayName,
  zh,
  identityParagraph,
  identityStoryFacts,
  recognitionFacts,
  dailyLifeFacts,
  careFacts,
  reproductionFacts,
  wildStoryFacts,
  significanceFacts,
  journeyFacts,
  story,
}: {
  displayName: string;
  zh: boolean;
  identityParagraph: string | null;
  identityStoryFacts: Array<{ id: string; text: string; predicate?: string }>;
  recognitionFacts: Array<{ id: string; text: string; predicate?: string }>;
  dailyLifeFacts: Array<{ id: string; text: string; predicate?: string }>;
  careFacts: Array<{ id: string; text: string; predicate?: string }>;
  reproductionFacts: Array<{ id: string; text: string; predicate?: string }>;
  wildStoryFacts: Array<{ id: string; text: string; predicate?: string }>;
  significanceFacts: Array<{ id: string; text: string; predicate?: string }>;
  journeyFacts: Array<{ id: string; text: string; predicate?: string; date?: string }>;
  story: string | null;
}): { paragraphs: string[]; usedFactIds: Set<string> } {
  const paragraphs: string[] = identityParagraph ? [identityParagraph] : [];
  const usedFactIds = new Set<string>();
  const usedText = new Set<string>();
  const personalizeNarrative = (value: string) => {
    if (!zh) return value;
    return value
      .replace(/^(?:该野生个体|该个体|该大熊猫)/u, displayName)
      .replace(/^(.+?)于(\d{4}年\d{1,2}月\d{1,2}日)在([^，。]+)完成回国前最后一天的公众展示[。.]?$/u, "$2是$1回国前最后一次在$3与公众见面的日子。")
      .replace(/，运输初期因紧张接受预防性镇静，并于次日约\d{1,2}时抵达([^。]+)[。.]?$/u, "，第二天抵达$1。")
      .replace(/^(.+?)于(\d{4}年\d{1,2}月\d{1,2}日)\d{1,2}时\d{1,2}分离开/u, "$2，$1离开")
      .replace(/^(.+?)于(\d{4}年\d{1,2}月\d{1,2}日)在([^，。]+)完成(.+)$/u, "$2，$1在$3进行了$4");
  };
  const ensureSentence = (value: string) => {
    const personalized = personalizeNarrative(value.trim());
    return /[。！？.!?]$/u.test(personalized) ? personalized : `${personalized}${zh ? "。" : "."}`;
  };
  const aiLikeSummary = zh
    ? /(?:构成了?|属于.+?的故事|值得(?:被)?(?:记住|关注)|具有.{0,8}意义|历史的一部分|见证了?|陪伴了?|留下了?.{0,8}(?:印记|记忆)|共同构成|意义在于)/u
    : /(?:part of .* history|worth remembering|worth knowing|tells the story|shaped .* story|meaningful legacy|bears witness|has accompanied)/i;
  const usableNarrative = (text: string) => Boolean(text.trim()) && !aiLikeSummary.test(text);
  const take = (items: Array<{ id: string; text: string }>, predicate: (text: string) => boolean = usableNarrative) => {
    const item = items.find((candidate) => {
      const text = candidate.text.trim();
      return text && !usedText.has(text) && usableNarrative(text) && predicate(text);
    }) ?? null;
    if (item) {
      usedFactIds.add(item.id);
      usedText.add(item.text.trim());
    }
    return item;
  };
  const takeBest = <T extends { id: string; text: string }>(items: T[], score: (item: T) => number) => {
    const item = items
      .filter((candidate) => candidate.text.trim() && !usedText.has(candidate.text.trim()) && usableNarrative(candidate.text))
      .map((candidate, index) => ({ candidate, index, score: score(candidate) }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.candidate ?? null;
    if (item) {
      usedFactIds.add(item.id);
      usedText.add(item.text.trim());
    }
    return item;
  };

  const hookPatterns = zh
    ? /昵称|称呼|白毛|白色|白化|白手套|未命名|外貌|特征|名字寓意|性格|温和|活泼|淘气/u
    : /nickname|called|known as|marking|recogniz|unnamed|name meaning|personality|gentle|playful/i;
  const wildLead = take(wildStoryFacts, (text) => /救|放归|野外|野化|野培|误入|rescue|release|rewild|wild/i.test(text));
  const identityLead = take([...identityStoryFacts, ...recognitionFacts, ...dailyLifeFacts], (text) => hookPatterns.test(text));
  const significanceLead = takeBest(significanceFacts, (item) => {
    const predicate = item.predicate ?? "";
    const text = item.text;
    if (/(?:first|record|oldest|youngest)/i.test(predicate) || /(?:第一只|首次|首只|纪录|最高龄|最年长)/u.test(text)) return 8;
    if (/WWF|世界自然基金会|标志|logo/i.test(`${predicate} ${text}`)) return 7;
    if (/明星|电视|celebrity|television/i.test(`${predicate} ${text}`)) return 6;
    return 0;
  });

  if (wildLead && paragraphs.length < 4) {
    const pieces = [wildLead.text, identityLead?.text].filter((value): value is string => Boolean(value));
    paragraphs.push(pieces.map((value) => ensureSentence(value.trim())).join(""));
  } else if ((significanceLead || identityLead) && paragraphs.length < 4) {
    const pieces = [significanceLead?.text, identityLead?.text].filter((value): value is string => Boolean(value));
    paragraphs.push(pieces.map((value) => ensureSentence(value.trim())).join(""));
  }

  const careLead = takeBest(careFacts, (item) => {
    const value = `${item.predicate ?? ""} ${item.text}`;
    if (/health_management_training|husbandry_training|健康管理训练|采血|血压|X光/i.test(value)) return 10;
    if (/hand_rearing|人工照护|保温箱|母亲未带崽/i.test(value)) return 9;
    if (/health|veterinary|训练|照护|护理/i.test(value)) return 7;
    return 3;
  });
  const everyday = take([...dailyLifeFacts, ...recognitionFacts]);
  if ((careLead || everyday) && paragraphs.length < 4) {
    const pieces = [everyday?.text, careLead?.text].filter((value): value is string => Boolean(value));
    paragraphs.push(pieces.map((value) => ensureSentence(value.trim())).join(""));
  }

  const journeyPriority = (item: { text: string; predicate?: string }) => {
    const value = `${item.predicate ?? ""} ${item.text}`;
    if (/final_public_viewing|最后一天的公众展示|最后公众展示/i.test(value)) return 10;
    if (/returned_to|离开上野|返回中国|启程返回/i.test(value)) return 9;
    if (/arrived_chengdu|飞抵成都|抵达成都|抵达雅安/i.test(value)) return 8;
    if (/quarantine|入住.*雅安|隔离检疫/i.test(value)) return 7;
    if (/adaptation|适应新的生活环境|逐步适应/i.test(value)) return 6;
    if (/transfer|location|residency|迁居|抵达|入住/i.test(value)) return 4;
    return 0;
  };
  const dateKey = (item: { text: string; date?: string }) => {
    if (item.date) return item.date.slice(0, 10);
    const match = item.text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/u);
    return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : "9999-12-31";
  };
  const selectedJourney = journeyFacts
    .filter((item) => usableNarrative(item.text) && !usedText.has(item.text.trim()))
    .map((item, index) => ({ item, index, score: journeyPriority(item) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 4)
    .map(({ item }) => item)
    .sort((left, right) => dateKey(left).localeCompare(dateKey(right)));
  const hasReturnJourney = selectedJourney.some((item) => /returned_to|离开.+返回|启程返回/i.test(`${item.predicate ?? ""} ${item.text}`));
  const conciseJourney = hasReturnJourney
    ? selectedJourney.filter((item) => !/arrived_chengdu|airport|飞抵成都天府/i.test(`${item.predicate ?? ""} ${item.text}`))
    : selectedJourney;
  if (conciseJourney.length && paragraphs.length < 4) {
    for (const item of conciseJourney) {
      usedFactIds.add(item.id);
      usedText.add(item.text.trim());
    }
    paragraphs.push(conciseJourney.map((item) => ensureSentence(item.text.trim())).join(""));
  }

  const life = take([...reproductionFacts, ...wildStoryFacts, ...significanceFacts]);
  if (life && paragraphs.length < 4) paragraphs.push(ensureSentence(life.text.trim()));

  if (story?.trim() && usableNarrative(story.trim()) && !usedText.has(story.trim()) && paragraphs.length < 4) {
    usedText.add(story.trim());
    paragraphs.push(ensureSentence(story.trim()));
  }

  if (!paragraphs.length) {
    paragraphs.push(zh
      ? `关于${displayName}，目前留下的公开资料不多。`
      : `There is not much public information about ${displayName} yet.`);
  }

  return { paragraphs: paragraphs.slice(0, 4), usedFactIds };
}

function inferredChineseResearchName(detail: { facts?: Array<{ category: string; summary_zh: string | null }> } | null): string | null {
  const text = detail?.facts?.find((fact) => fact.category === "name_meaning" && fact.summary_zh)?.summary_zh ?? null;
  const match = text?.match(/^[“「『"']([^”」』"']{1,12})[”」』"']/u)?.[1]?.trim() ?? null;
  return match && /[\u3400-\u9fff]/u.test(match) ? match : null;
}

function inferredResearchGender(
  detail: ResearchDetailPanda | null,
  names: Array<string | null | undefined>,
): "male" | "female" | null {
  const usableNames = names.map((name) => name?.trim()).filter((name): name is string => Boolean(name));
  for (const fact of detail?.facts ?? detail?.highlights ?? []) {
    const texts = [fact.summary_zh, fact.summary_en].filter((text): text is string => Boolean(text?.trim()));
    for (const rawText of texts) {
      const text = rawText.trim();
      if (/^(?:雄性|雄仔|公大熊猫|male\b)/iu.test(text) || /(?:性别|sex)[:：]?\s*(?:雄性|male)\b/iu.test(text)) return "male";
      if (/^(?:雌性|雌仔|母大熊猫|female\b)/iu.test(text) || /(?:性别|sex)[:：]?\s*(?:雌性|female)\b/iu.test(text)) return "female";
      for (const name of usableNames) {
        const escapedName = [...name]
          .map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\${character}` : character)
          .join("");
        if (new RegExp(`${escapedName}[^。；]{0,16}(?:为|是|，)?[^。；]{0,4}(?:雄性|雄仔|male\\b)`, "iu").test(text)) return "male";
        if (new RegExp(`${escapedName}[^。；]{0,16}(?:为|是|，)?[^。；]{0,4}(?:雌性|雌仔|female\\b)`, "iu").test(text)) return "female";
        if (new RegExp(`^${escapedName}[^。；]{0,32}(?:他|he\\b)`, "iu").test(text)) return "male";
        if (new RegExp(`^${escapedName}[^。；]{0,32}(?:她|she\\b)`, "iu").test(text)) return "female";
        if (new RegExp(`${escapedName}[^。；]{0,40}(?:产下|生下|分娩|产仔|诞下)`, "u").test(text)) return "female";
        if (new RegExp(`${escapedName}[^。；]{0,24}(?:母女|姐妹)`, "u").test(text)) return "female";
        if (new RegExp(`${escapedName}[^。；]{0,24}(?:父子|兄弟)`, "u").test(text)) return "male";
      }
    }
  }
  return null;
}

export default async function FanV08PandaDetailPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";

  const [researchCatalog, researchDetails, atlas] = await Promise.all([
    loadFanV08ResearchCatalog(true),
    loadFanV08ResearchDetails(true),
    loadOptionalPublicAtlas(locale),
  ]);
  const researchPanda = researchCatalog?.pandas.find((panda) => panda.slug === slug) ?? null;
  const researchDetail = researchPanda ? researchDetails?.subjects[researchPanda.id] ?? null : null;
  const publicPanda = atlas?.data.pandas.find((panda) => panda.slug === slug) ?? null;
  if (!researchPanda && !publicPanda) notFound();

  const inferredZhName = zh && researchPanda && !/[\u3400-\u9fff]/u.test(researchPanda.name_zh)
    ? inferredChineseResearchName(researchDetail)
    : null;
  const displayName = researchPanda
    ? (zh ? inferredZhName ?? researchPanda.name_zh : researchPanda.name_en || researchPanda.name_zh)
    : pandaName(publicPanda!, locale);
  const alternateName = researchPanda
    ? (zh ? researchPanda.name_en ?? (inferredZhName ? researchPanda.name_zh : null) : researchPanda.name_zh)
    : (zh ? publicPanda?.name_en : publicPanda?.name_zh);

  const exactBirthDate = typeof researchDetail?.core.birth_date === "string" ? researchDetail.core.birth_date : null;
  const birthYear = exactBirthDate?.slice(0, 4) ?? researchPanda?.birth_year ?? publicPanda?.birth_date?.slice(0, 4) ?? null;
  const sex = researchDetail?.core.sex ?? researchPanda?.gender ?? publicPanda?.gender ?? "unknown";
  const lifeStatus = researchDetail?.core.life_status ?? researchPanda?.status ?? publicPanda?.status ?? "unknown";
  const place = localizedPlace(publicPanda?.current_place?.coarse_location ?? publicPanda?.current_location ?? null, zh);

  const publicMedia = publicPanda ? uniqueMedia(publicPanda.media.filter((item) => item.status === "available")) : [];
  const rawMediaCandidates: ProfileMediaCandidate[] = [
    ...(researchDetail?.media ?? []).map((item) => ({
      id: `research:${item.id}`,
      rawId: item.id,
      url: item.url,
      credit: item.credit,
      rights: item.rights,
      sourceUrl: item.source_url,
      description: item.description,
    })),
    ...(researchPanda?.media ? [{
      id: `catalog:${researchPanda.media.media_id ?? researchPanda.id}`,
      rawId: researchPanda.media.media_id ?? researchPanda.id,
      url: researchPanda.media.url,
      credit: researchPanda.media.credit,
      rights: researchPanda.media.rights,
      sourceUrl: researchPanda.media.source_url,
      description: null,
    }] : []),
    ...publicMedia.flatMap((item) => item.url ? [{
      id: `public:${item.id}`,
      rawId: item.id,
      url: item.url,
      credit: item.credit,
      rights: item.rights,
      sourceUrl: null,
      description: zh ? item.alt_zh : item.alt_en,
    }] : []),
  ];
  const mediaByUrl = new Map<string, ProfileMediaCandidate>();
  for (const candidate of rawMediaCandidates) {
    if (!mediaByUrl.has(candidate.url)) mediaByUrl.set(candidate.url, candidate);
  }
  const usableMediaCandidates = [...mediaByUrl.values()].filter((candidate) => !isLikelyNonPhotographic(candidate));
  const heroMedia = pickHeroMedia(slug, usableMediaCandidates);
  const image = heroMedia?.url ?? null;
  const imageCredit = heroMedia?.credit ?? null;
  const imageRights = heroMedia?.rights ?? null;

  const birthLabel = exactBirthDate ? compactDate(exactBirthDate, locale) : birthYear;
  const birthplace = localizedPlace(typeof researchDetail?.core.birthplace === "string" ? researchDetail.core.birthplace : null, zh);
  const otherLocale = zh ? "en" : "zh";

  const familyByLabel = new Map<string, Array<{
    id: string;
    name: string;
    slug: string | null;
    relationKind: string;
    targetLabel: string | null;
    summaryZh: string | null;
    parentageStatus: string | null;
  }>>();
  const researchBySlug = new Map((researchCatalog?.pandas ?? []).map((panda) => [panda.slug, panda]));
  const researchById = new Map((researchCatalog?.pandas ?? []).map((panda) => [panda.id, panda]));
  const researchByMention = new Map<string, ResearchCatalogPanda | null>();
  for (const panda of researchCatalog?.pandas ?? []) {
    for (const alias of [panda.name_zh, panda.name_en, panda.label].filter((value): value is string => Boolean(value))) {
      const key = normalizeMention(alias);
      if (!researchByMention.has(key)) researchByMention.set(key, panda);
      else if (researchByMention.get(key)?.id !== panda.id) researchByMention.set(key, null);
    }
  }
  const researchByChineseName = new Map<string, ResearchCatalogPanda | null>();
  for (const panda of researchCatalog?.pandas ?? []) {
    const name = panda.name_zh?.trim();
    if (!name || !/[\u3400-\u9fff]/u.test(name) || name.length > 12) continue;
    if (!researchByChineseName.has(name)) researchByChineseName.set(name, panda);
    else if (researchByChineseName.get(name)?.id !== panda.id) researchByChineseName.set(name, null);
  }
  const researchChineseNamesByInitial = new Map<string, Array<{ name: string; panda: ResearchCatalogPanda }>>();
  for (const [name, panda] of researchByChineseName) {
    if (!panda) continue;
    const initial = [...name][0];
    if (!initial) continue;
    const names = researchChineseNamesByInitial.get(initial) ?? [];
    names.push({ name, panda });
    researchChineseNamesByInitial.set(initial, names);
  }
  for (const names of researchChineseNamesByInitial.values()) names.sort((left, right) => right.name.length - left.name.length);
  const researchGenderHints = new Map<string, "male" | "female" | "conflict">();
  const addGenderHint = (targetId: string, hint: "male" | "female") => {
    const current = researchGenderHints.get(targetId);
    if (!current) researchGenderHints.set(targetId, hint);
    else if (current !== hint) researchGenderHints.set(targetId, "conflict");
  };
  for (const detail of Object.values(researchDetails?.subjects ?? {})) {
    for (const relation of detail.relations ?? []) {
      const mention = researchRelationName(relation, "zh");
      const target = relation.target_subject_id
        ? researchById.get(relation.target_subject_id)
        : relation.target_slug
          ? researchBySlug.get(relation.target_slug)
          : researchByMention.get(normalizeMention(mention)) ?? null;
      if (!target) continue;
      if (relation.kind === "father" || relation.kind === "mother") {
        addGenderHint(target.id, relation.kind === "father" ? "male" : "female");
        continue;
      }
      const evidence = `${relation.target_name_zh ?? ""} ${relation.target_label ?? ""}`;
      const maleCue = /(?:之子|儿子|哥哥|弟弟|父亲|雄性|雄仔|\bmale\b|\bson\b|\bfather\b)/iu.test(evidence);
      const femaleCue = /(?:之女|女儿|姐姐|妹妹|母亲|雌性|雌仔|\bfemale\b|\bdaughter\b|\bmother\b)/iu.test(evidence);
      if (maleCue !== femaleCue) {
        addGenderHint(target.id, maleCue ? "male" : "female");
        continue;
      }
      const summary = relation.summary_zh ?? "";
      const targetNames = [target.name_zh, target.name_en, mention].filter((value): value is string => Boolean(value));
      for (const targetName of targetNames) {
        const escaped = [...targetName]
          .map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\${character}` : character)
          .join("");
        if (new RegExp(`${escaped}[^。；，、]{0,12}(?:哥哥|弟弟|之子|儿子|雄性|雄仔)`, "u").test(summary)) addGenderHint(target.id, "male");
        if (new RegExp(`${escaped}[^。；，、]{0,12}(?:姐姐|妹妹|之女|女儿|雌性|雌仔)`, "u").test(summary)) addGenderHint(target.id, "female");
      }
    }
    for (const fact of detail.facts ?? []) {
      const summary = fact.summary_zh?.trim() ?? "";
      if (!summary) continue;
      for (const match of summary.matchAll(/(哥哥|弟弟|儿子|之子|雄性|雄仔|姐姐|妹妹|女儿|之女|雌性|雌仔)[“”"'‘’\s]*/gu)) {
        const afterRole = summary.slice((match.index ?? 0) + match[0].length);
        const initial = [...afterRole][0];
        if (!initial) continue;
        const target = (researchChineseNamesByInitial.get(initial) ?? []).find(({ name }) => afterRole.startsWith(name))?.panda ?? null;
        if (!target) continue;
        const role = match[1];
        addGenderHint(target.id, /^(?:哥哥|弟弟|儿子|之子|雄性|雄仔)$/u.test(role) ? "male" : "female");
      }
    }
  }
  for (const relation of researchDetail?.relations ?? []) {
    if (!isDisplayableFamilyRelation(relation)) continue;
    const label = familyGroupForKind(relation.kind, zh);
    if (!label) continue;
    const items = familyByLabel.get(label) ?? [];
    const name = researchRelationName(relation, locale);
    const targetById = relation.target_subject_id ? researchById.get(relation.target_subject_id) : null;
    const labelSlug = relation.target_label?.trim() ?? null;
    const mentionedTarget = !relation.target_slug && !targetById
      ? resolveResearchPandaMention(name, researchCatalog, researchDetails)
      : null;
    const resolvedTargetSlug = relation.target_slug
      ?? targetById?.slug
      ?? (labelSlug && researchBySlug.has(labelSlug) ? labelSlug : null)
      ?? mentionedTarget?.slug
      ?? null;
    const key = resolvedTargetSlug ?? `${relation.kind}:${name}`;
    if (!items.some((item) => (item.slug ?? item.id) === key)) {
      items.push({
        id: key,
        name,
        slug: resolvedTargetSlug,
        relationKind: relation.kind,
        targetLabel: relation.target_label,
        summaryZh: preferredSiblingSummary(researchPanda?.id, relation, researchDetails),
        parentageStatus: relation.parentage_status ?? null,
      });
    }
    familyByLabel.set(label, items);
  }
  const inferredSiblings = inferredSiblingRelations(researchDetail, displayName, researchCatalog, researchDetails);
  if (inferredSiblings.length) {
    const label = zh ? "兄弟姐妹" : "Siblings";
    const items = familyByLabel.get(label) ?? [];
    for (const sibling of inferredSiblings) {
      if (!items.some((item) => item.slug === sibling.slug || item.name === sibling.name)) {
        items.push({ ...sibling, relationKind: "sibling", targetLabel: sibling.name, summaryZh: null, parentageStatus: null });
      }
    }
    familyByLabel.set(label, items);
  }
  const inferredParents = inferredParentRelations(researchDetail, displayName, researchCatalog, researchDetails);
  if (inferredParents.length) {
    const label = zh ? "父母" : "Parents";
    const items = familyByLabel.get(label) ?? [];
    for (const parent of inferredParents) {
      if (!items.some((item) => item.slug === parent.slug || item.name === parent.name)) {
        items.push({ ...parent, relationKind: "mother", targetLabel: parent.name, summaryZh: null, parentageStatus: null });
      }
    }
    familyByLabel.set(label, items);
  }

  const publishedById = new Map((atlas?.data.pandas ?? []).map((panda) => [panda.id, panda]));
  const publishedBySlug = new Map((atlas?.data.pandas ?? []).map((panda) => [panda.slug, panda]));
  const publicFamilyGroups = publicPanda ? [
    {
      label: zh ? "父母" : "Parents",
      items: [publicPanda.father_id, publicPanda.mother_id]
        .filter((id): id is string => Boolean(id))
        .map((id) => publishedById.get(id))
        .filter((panda): panda is PandaDetail => Boolean(panda)),
    },
    {
      label: zh ? "子女" : "Children",
      items: (atlas?.data.pandas ?? []).filter((panda) => panda.father_id === publicPanda.id || panda.mother_id === publicPanda.id),
    },
  ] : [];
  for (const group of publicFamilyGroups) {
    const items = familyByLabel.get(group.label) ?? [];
    for (const panda of group.items) {
      if (!items.some((item) => item.slug === panda.slug)) {
        const relationKind = group.label === (zh ? "父母" : "Parents")
          ? (panda.id === publicPanda?.father_id ? "father" : panda.id === publicPanda?.mother_id ? "mother" : "parent")
          : "child";
        items.push({
          id: panda.id,
          name: pandaName(panda, locale),
          slug: panda.slug,
          relationKind,
          targetLabel: pandaName(panda, locale),
          summaryZh: null,
          parentageStatus: null,
        });
      }
    }
    if (items.length) familyByLabel.set(group.label, items);
  }
  const familyGroups = [...familyByLabel.entries()].map(([label, items]) => ({
    label,
    items: items.map((item) => {
      const researchMatch = item.slug ? researchBySlug.get(item.slug) : null;
      const researchTargetDetail = researchMatch ? researchDetails?.subjects[researchMatch.id] ?? null : null;
      const publicMatch = item.slug ? publishedBySlug.get(item.slug) : null;
      const explicitGender = [researchTargetDetail?.core.sex, researchMatch?.gender, publicMatch?.gender]
        .find((value) => value === "male" || value === "female");
      const factGender = inferredResearchGender(researchTargetDetail, [item.name, researchMatch?.name_zh, researchMatch?.name_en]);
      const genderHint = researchMatch ? researchGenderHints.get(researchMatch.id) : null;
      const gender = explicitGender
        ?? factGender
        ?? (genderHint === "male" || genderHint === "female" ? genderHint : "unknown");
      return {
        ...item,
        role: familyRoleLabel({
          kind: item.relationKind,
          gender,
          subjectGender: sex,
          subjectName: displayName,
          targetName: item.name,
          targetLabel: item.targetLabel,
          summaryZh: item.summaryZh,
          parentageStatus: item.parentageStatus,
          zh,
        }),
        image: researchMatch?.media?.url ?? publicMatch?.cover_image_url ?? publicMatch?.media.find((media) => media.status === "available" && media.url)?.url ?? null,
      };
    }),
  }));
  const familyRailGroups = familyGroups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      image: item.image,
      href: item.slug ? `/${locale}/prototype/fan-v08/pandas/${item.slug}` : null,
    })),
  }));
  const familyContinuationPanda = familyRailGroups.flatMap((group) => group.items).find((item) => item.href) ?? null;
  const cataloguePandas = researchCatalog?.pandas ?? [];
  const currentCatalogueIndex = researchPanda ? cataloguePandas.findIndex((panda) => panda.id === researchPanda.id) : -1;
  const continuationCandidates = currentCatalogueIndex >= 0
    ? [...cataloguePandas.slice(currentCatalogueIndex + 1), ...cataloguePandas.slice(0, currentCatalogueIndex)]
    : cataloguePandas;
  const fallbackContinuationResearch = continuationCandidates.find((panda) =>
    panda.slug !== slug && panda.media?.url && (!researchPanda || panda.status === researchPanda.status),
  ) ?? continuationCandidates.find((panda) => panda.slug !== slug && panda.media?.url) ?? null;
  const fallbackContinuationPanda = fallbackContinuationResearch
    ? {
      name: zh ? fallbackContinuationResearch.name_zh : fallbackContinuationResearch.name_en || fallbackContinuationResearch.name_zh,
      image: fallbackContinuationResearch.media!.url,
      href: `/${locale}/prototype/fan-v08/pandas/${fallbackContinuationResearch.slug}`,
    }
    : null;
  const continuationPanda = familyContinuationPanda ?? fallbackContinuationPanda;
  const continuationIsFamily = Boolean(familyContinuationPanda);

  const allResearchMoments = (researchDetail?.moments ?? []).flatMap((item) => {
    const rawText = zh ? item.summary_zh ?? item.summary_en : item.summary_en ?? item.summary_zh;
    const text = rawText ? toPandaPublicText({ category: item.category, predicate: item.predicate, text: rawText }) : null;
    return text ? [{ id: `research:${item.id}`, date: item.date, text, category: item.category, predicate: item.predicate }] : [];
  });
  const researchTimeline = allResearchMoments.flatMap((item) => {
    if (!lifeJourneyCategories.has(item.category)) return [];
    if (timelineDetailNoise.test(`${item.predicate} ${item.text}`)) return [];
    const category = /(?:rewilding|wild[_ -]?training|野化|野培)/i.test(`${item.predicate} ${item.text}`)
      ? "rewilding"
      : /(?:captured_on|capture)/i.test(item.predicate)
        ? "capture"
        : item.category;
    return [{ id: item.id, date: item.date, title: item.text, category }];
  });
  const publicTimeline = publicPanda ? publicPanda.events.map((item) => ({
    id: `public:${item.id}`,
    date: item.event_date,
    title: eventPlace(item, locale),
    category: item.event_type,
  })) : [];
  const seenTimeline = new Set<string>();
  const mergedTimeline = [...researchTimeline, ...publicTimeline]
    .filter((item) => {
      const key = `${item.date}:${item.category}`;
      if (seenTimeline.has(key)) return false;
      seenTimeline.add(key);
      return true;
    })
    .sort((left, right) => left.date.localeCompare(right.date));
  const timeline = exactBirthDate && !mergedTimeline.some((item) => item.category === "birth")
    ? [{
      id: "core:birth",
      date: exactBirthDate,
      title: zh ? `${displayName}出生${birthplace ? `于${birthplace}` : ""}。` : `${displayName} was born${birthplace ? ` at ${birthplace}` : ""}.`,
      category: "birth",
    }, ...mergedTimeline]
    : mergedTimeline;

  const footprint = publicPanda
    ? [...publicPanda.residencies].sort((left, right) => left.start_date.localeCompare(right.start_date))
    : [];
  const lifeRanges = footprint.map((stop) => ({
    id: stop.id,
    label: localizedPlace(stop.coarse_location, zh) ?? (zh ? "居住记录" : "Residence"),
    startDate: stop.start_date,
    endDate: stop.end_date,
  }));
  const placeStops = footprint.map((stop) => ({
    id: stop.id,
    label: localizedPlace(stop.coarse_location, zh) ?? (zh ? "居住记录" : "Residence"),
    startLabel: compactDate(stop.start_date, locale),
    endLabel: stop.end_date ? compactDate(stop.end_date, locale) : null,
  }));
  const story = publicPanda?.localized_content.find((item) => item.locale === (zh ? "zh-CN" : "en"))?.summary
    ?? publicPanda?.intro
    ?? null;
  const rawProjectedFacts = (researchDetail?.facts ?? researchDetail?.highlights ?? []).flatMap((item) => {
    const text = zh ? item.summary_zh ?? item.summary_en : item.summary_en ?? item.summary_zh;
    return text ? [{ id: item.id, category: item.category, predicate: item.predicate, text }] : [];
  });
  const rawClassificationFacts = [...rawProjectedFacts];
  const rawClassificationFactIds = new Set(rawClassificationFacts.map((item) => item.id));
  for (const item of researchDetail?.classification_evidence ?? []) {
    if (rawClassificationFactIds.has(item.id)) continue;
    rawClassificationFacts.push({ id: item.id, category: item.category, predicate: item.predicate, text: "" });
    rawClassificationFactIds.add(item.id);
  }
  const projectedFacts = rawProjectedFacts.flatMap((item) => {
    const text = toPandaPublicText(item);
    return text ? [{ ...item, text }] : [];
  });
  const identityStoryFacts = projectedFacts.filter((item) => identityStoryCategories.has(item.category)).slice(0, 6);
  const recognitionFacts = projectedFacts.filter((item) => recognitionCategories.has(item.category)).slice(0, 8);
  const dailyLifeFacts = projectedFacts.filter((item) => dailyLifeCategories.has(item.category)).slice(0, 12);
  const careFacts = projectedFacts.filter((item) =>
    /^(?:husbandry_training|health|veterinary_care|care|hand_rearing|growth)$/i.test(item.category)
    || /(?:training|照护|训练|采血|血压|X光|保温箱)/i.test(`${item.predicate} ${item.text}`),
  ).slice(0, 14);
  const reproductionFacts = projectedFacts.filter((item) => reproductionCategories.has(item.category)).slice(0, 14);
  const wildStoryFacts = projectedFacts.filter((item) =>
    wildStoryCategories.has(item.category) || /(?:rewilding|wild[_ -]?training|野化|野培)/i.test(`${item.predicate} ${item.text}`),
  ).slice(0, 12);
  const significanceFacts = projectedFacts.filter((item) => significanceCategories.has(item.category)).slice(0, 12);
  const projectedJourneyFacts = projectedFacts.filter((item) =>
    /^(?:transfer|location|residency_history|public_debut)$/i.test(item.category)
    || /(?:final_public_viewing|returned_to|arriv|quarantine|adaptation|transfer|relocat)/i.test(item.predicate),
  );
  const momentJourneyFacts = allResearchMoments.filter((item) =>
    /^(?:transfer|location|residency_history|public_debut|health|milestone)$/i.test(item.category)
    && /(?:final_public_viewing|returned_to|arriv|quarantine|adaptation|transfer|relocat|公众展示|返回|抵达|入住|适应)/i.test(`${item.predicate} ${item.text}`),
  );
  const journeyByText = new Map<string, { id: string; text: string; predicate?: string; date?: string }>();
  for (const item of [...projectedJourneyFacts, ...momentJourneyFacts]) {
    const key = item.text.trim();
    if (!journeyByText.has(key)) journeyByText.set(key, item);
  }
  const journeyFacts = [...journeyByText.values()];
  const identityParagraph = aboutIdentityParagraph({
    displayName,
    zh,
    sex,
    birthLabel,
    birthplace,
    place,
    familyGroups,
  });
  const profileIntro = articleParagraphs({
    displayName,
    zh,
    identityParagraph,
    identityStoryFacts,
    recognitionFacts,
    dailyLifeFacts,
    careFacts,
    reproductionFacts,
    wildStoryFacts,
    significanceFacts,
    journeyFacts,
    story,
  });
  const deathDate = researchDetail?.core.death_date ?? null;
  const factsForQuickFacts = projectedFacts.filter((fact) => !profileIntro.usedFactIds.has(fact.id));
  const factRelations = familyGroups.flatMap((group) => group.items).map((item) => ({
    kind: item.relationKind,
    name: item.name,
  }));
  const quickFactSuppressedKinds = new Set<PandaFactKind>(["birth", "family", "place", "status"]);
  const displayFacts = selectPandaDisplayFacts({
    displayName,
    zh,
    sex,
    birthLabel,
    birthplace,
    lifeStatus,
    deathDate,
    place,
    relations: factRelations,
    facts: factsForQuickFacts,
    suppressKinds: quickFactSuppressedKinds,
    allowFallbacks: false,
  });
  const detailProjection = projectPandaDetailSections({
    facts: projectedFacts,
    classificationFacts: rawClassificationFacts,
    moments: allResearchMoments,
    displayFacts,
    reservedFactIds: profileIntro.usedFactIds,
    lifeStatus,
    deathDate,
    asOfDate: researchDetails?.generated_at?.slice(0, 10) ?? null,
    zh,
  });
  const projectedPlaceFacts = detailProjection.placeFacts;
  const lifeStoryChapters = detailProjection.lifeStoryChapters;
  const recentMoments = detailProjection.recentMoments;
  const showTimeline = timeline.length >= 3 || (!lifeStoryChapters.length && timeline.length >= 2);

  const unknownValue = zh ? "暂无确认" : "Not yet confirmed";
  const overviewPlace = place ?? extractOverviewPlace(projectedFacts, detailProjection.classification.journey, zh);
  const overviewFamily = familySummary(familyGroups, zh);
  const rescueRecord = datedJourneyFact(researchDetail, "rescue", locale);
  const releaseRecord = datedJourneyFact(researchDetail, "release", locale);
  const overviewStatus = lifeStatus === "unknown" && ["wild_rescued_released", "released_to_wild"].includes(detailProjection.classification.journey)
    ? (zh ? "已放归，后续有野外监测记录" : "Released; later wild monitoring is documented")
    : statusLabel(lifeStatus, deathDate, zh);
  const overviewRows: PandaOverviewRow[] = [
    {
      kind: "identity",
      label: zh ? "身份" : "Profile",
      value: journeyLabel(detailProjection.classification.journey, detailProjection.classification.era, zh),
    },
    {
      kind: "sex",
      label: zh ? "性别" : "Sex",
      value: sexLabel(sex, zh) ?? unknownValue,
      muted: !sexLabel(sex, zh),
    },
    {
      kind: "birth",
      label: zh ? "出生" : "Born",
      value: birthLabel ?? unknownValue,
      muted: !birthLabel,
    },
    ...(birthplace ? [{ kind: "place" as const, label: zh ? "出生地" : "Birthplace", value: birthplace }] : []),
    ...(rescueRecord ? [{ kind: "rescue" as const, label: zh ? "获救" : "Rescued", value: rescueRecord }] : []),
    ...(releaseRecord ? [{ kind: "release" as const, label: zh ? "放归" : "Released", value: releaseRecord }] : []),
    {
      kind: "place",
      label: lifeStatus === "deceased" ? (zh ? "最后所在地" : "Last known place") : (zh ? "所在地" : "Location"),
      value: detailProjection.classification.journey === "wild_native"
        ? (zh ? "野外监测区域（不公开精确位置）" : "Wild monitoring area (precise location withheld)")
        : overviewPlace ?? unknownValue,
      muted: detailProjection.classification.journey !== "wild_native" && !overviewPlace,
    },
    {
      kind: "status",
      label: zh ? "状态" : "Status",
      value: overviewStatus,
      muted: lifeStatus === "unknown" && !deathDate && overviewStatus === statusLabel(lifeStatus, deathDate, zh),
    },
    {
      kind: "family",
      label: zh ? "家人" : "Family",
      value: overviewFamily ?? (zh ? "暂无确认关系" : "No confirmed family relationship yet"),
      muted: !overviewFamily,
    },
  ];

  const mediaItems = usableMediaCandidates.map((item) => ({
    id: item.id,
    url: item.url,
    alt: displayName,
    credit: item.credit,
    rights: item.rights,
  })).slice(0, 8);

  const sourceMap = new Map<string, { id: string; publisher: string; title: string; url: string }>();
  for (const source of researchDetail?.sources ?? []) {
    if (source.url) sourceMap.set(source.url, { id: `research:${source.id}`, publisher: source.publisher, title: source.title, url: source.url });
  }
  for (const source of publicPanda?.sources ?? []) {
    if (source.url && !sourceMap.has(source.url)) sourceMap.set(source.url, { id: `public:${source.id}`, publisher: source.publisher, title: source.title, url: source.url });
  }
  const sources = [...sourceMap.values()];
  const galleryItems = mediaItems.filter((item) => item.url !== image).slice(0, 8);
  const carouselPool = galleryItems;
  const carouselBySource = new Map<string, typeof carouselPool>();
  for (const item of carouselPool) {
    let sourceKey = item.url;
    try {
      sourceKey = new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      // Keep the URL itself as a stable fallback source key.
    }
    const sourceItems = carouselBySource.get(sourceKey) ?? [];
    sourceItems.push(item);
    carouselBySource.set(sourceKey, sourceItems);
  }
  const heroGalleryItems: typeof carouselPool = [];
  for (let row = 0; heroGalleryItems.length < 4; row += 1) {
    let added = false;
    for (const sourceItems of carouselBySource.values()) {
      const item = sourceItems[row];
      if (!item) continue;
      heroGalleryItems.push(item);
      added = true;
      if (heroGalleryItems.length === 4) break;
    }
    if (!added) break;
  }
  const carouselIds = new Set(heroGalleryItems.map((item) => item.id));
  const remainingStoryMedia = carouselPool.filter((item) => !carouselIds.has(item.id));
  const aboutMedia = remainingStoryMedia[0] ?? heroGalleryItems[0] ?? null;
  const traitMediaPool = remainingStoryMedia.filter((item) => item.id !== aboutMedia?.id);
  const recognitionMedia = detailProjection.recognitionFacts.length ? traitMediaPool[0] ?? null : null;
  const personalityMedia = detailProjection.personalityFacts.length
    ? traitMediaPool[recognitionMedia ? 1 : 0] ?? null
    : null;
  const storyMediaIds = new Set([
    ...carouselIds,
    ...(aboutMedia ? [aboutMedia.id] : []),
    ...(recognitionMedia ? [recognitionMedia.id] : []),
    ...(personalityMedia ? [personalityMedia.id] : []),
  ]);
  const photoGalleryItems: PhotoGalleryItem[] = carouselPool.filter((item) => !storyMediaIds.has(item.id)).map((item) => ({
    src: item.url,
    width: 4,
    height: 5,
    alt: item.alt,
    caption: [item.credit, item.rights].filter(Boolean).join(" · ") || null,
  }));
  return (
    <div
      className={`${homeStyles.page} ${styles.detailPage}`}
      data-testid="fan-v08-panda-detail"
      data-profile-era={detailProjection.classification.era}
      data-profile-journey={detailProjection.classification.journey}
    >
      <DetailEntrance />
      <PrototypeHeader
        locale={locale}
        active="pandas"
        languageHref={`/${otherLocale}/prototype/fan-v08/pandas/${slug}`}
      />

      <main className={styles.detailMain}>
        <section className={styles.hero} aria-labelledby="panda-detail-name">
          <div className={styles.heroSplit}>
            <div className={styles.heroMedia} data-panda-detail-hero>
              <PandaProfilePhoto
                src={image}
                alt={zh ? `${displayName}的大熊猫肖像` : `Portrait of giant panda ${displayName}`}
                name={displayName}
                fallbackText={zh ? "暂无确认个体照片" : "No confirmed individual photograph"}
                fallbackClassName={styles.heroNoPhoto}
                loading="eager"
              />
              {(imageCredit || imageRights) ? (
                <p className={styles.mediaCredit}>{[imageCredit, imageRights].filter(Boolean).join(" · ")}</p>
              ) : null}
            </div>
            <PandaProfileOverview
              displayName={displayName}
              alternateName={alternateName ?? null}
              rows={overviewRows}
              titleId="panda-detail-name"
              openLabel={zh ? "查看档案" : "Open profile"}
              closeLabel={zh ? "收起档案" : "Close profile"}
            />
          </div>
        </section>

        {heroGalleryItems.length ? (
          <section className={styles.photoRailSection} aria-label={zh ? `${displayName}更多照片` : `More photos of ${displayName}`}>
            <HeroPhotoCarousel
              items={heroGalleryItems}
              ariaLabel={zh ? `${displayName}照片轮播` : `${displayName} photo carousel`}
              previousLabel={zh ? "上一张照片" : "Previous photo"}
              nextLabel={zh ? "下一张照片" : "Next photo"}
            />
          </section>
        ) : null}

        <section className={styles.introSection} id="overview" aria-labelledby="panda-profile-intro">
          <div className={styles.aboutShell} data-has-media={aboutMedia ? "true" : "false"}>
            <article className={styles.profileArticle}>
              <h2 id="panda-profile-intro">{zh ? `关于${displayName}` : `About ${displayName}`}</h2>
              {profileIntro.paragraphs.map((paragraph, index) => <p key={`${displayName}:intro:${index}`}>{paragraph}</p>)}
            </article>
            {aboutMedia ? (
              <figure className={styles.aboutMedia}>
                <img src={aboutMedia.url} alt={zh ? `${displayName}的另一张照片` : `Another photograph of ${displayName}`} loading="lazy" />
                {[aboutMedia.credit, aboutMedia.rights].filter(Boolean).length ? (
                  <figcaption>{[aboutMedia.credit, aboutMedia.rights].filter(Boolean).join(" · ")}</figcaption>
                ) : null}
              </figure>
            ) : null}
          </div>
        </section>

        <PandaFactGrid
          title={zh ? "关于它的几个事实" : "Panda facts"}
          facts={displayFacts}
        />

        <PandaTraitScenes
          displayName={displayName}
          zh={zh}
          recognitionFacts={detailProjection.recognitionFacts}
          personalityFacts={detailProjection.personalityFacts}
          recognitionMedia={recognitionMedia}
          personalityMedia={personalityMedia}
        />

        {familyGroups.length ? (
          <section className={styles.profileSection} id="family">
            <div className={styles.sectionShellWide}>
              <div className={styles.sectionHeading}>
                <h2>{zh ? `${displayName}的家人` : `${displayName}'s family`}</h2>
              </div>
              <div className={styles.sectionBody}>
                <FamilyRail
                  groups={familyRailGroups}
                  noPhotoLabel={zh ? "暂无确认照片" : " has no confirmed photo"}
                  ariaLabel={zh ? `${displayName}的家人` : `${displayName}'s family`}
                />
              </div>
            </div>
          </section>
        ) : null}

        <LifeStoriesSection
          displayName={displayName}
          zh={zh}
          chapters={lifeStoryChapters}
        />

        {showTimeline ? (
          <section className={`${styles.profileSection} ${styles.softSection}`} id="timeline">
            <div className={styles.sectionShellWide}>
              <div className={styles.sectionHeadingInline}>
                <h2>{zh ? "一路走来" : "Along the way"}</h2>
              </div>
              <LifeTrack
                events={timeline}
                ranges={lifeRanges}
                birthDate={exactBirthDate}
                asOfDate={researchDetails?.generated_at?.slice(0, 10) ?? null}
                locale={locale}
              />
            </div>
          </section>
        ) : null}

        <PandaPlacesSection
          displayName={displayName}
          zh={zh}
          stops={placeStops}
          facts={projectedPlaceFacts}
        />

        <RecentMomentsSection
          displayName={displayName}
          locale={locale}
          zh={zh}
          moments={recentMoments}
          slug={slug}
        />

        {photoGalleryItems.length ? (
          <section className={styles.profileSection} id="media">
            <div className={styles.sectionShell}>
              <div className={styles.sectionHeading}>
                <h2>{zh ? `再看看${displayName}` : `More of ${displayName}`}</h2>
              </div>
              <div className={styles.sectionBody}>
                <PhotoGallery
                  photos={photoGalleryItems}
                  openLabel={zh ? `打开${displayName}的照片` : `Open a photo of ${displayName}`}
                  className={styles.photoArchiveGallery}
                  targetRowHeight={310}
                />
              </div>
            </div>
          </section>
        ) : null}

        {sources.length ? (
          <section className={styles.sourcesSection} id="sources">
            <div className={styles.sectionShell}>
              <div className={styles.sectionHeading}>
                <h2>{zh ? "资料来源" : "Sources"}</h2>
              </div>
              <div className={styles.sectionBody}>
                <ol className={styles.sourcesList}>
                  {sources.slice(0, 3).map((source) => (
                    <li key={source.id}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        <span>{source.publisher}</span>
                        <strong>{source.title}</strong>
                        <ArrowUpRight aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ol>
                {sources.length > 3 ? (
                  <details className={styles.sourcesMore}>
                    <summary>{zh ? `更多资料来源 · ${sources.length - 3}` : `More sources · ${sources.length - 3}`}</summary>
                    <ol className={styles.sourcesList}>
                      {sources.slice(3).map((source) => (
                        <li key={source.id}>
                          <a href={source.url} target="_blank" rel="noreferrer">
                            <span>{source.publisher}</span>
                            <strong>{source.title}</strong>
                            <ArrowUpRight aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {continuationPanda?.href ? (
          <section className={styles.continuationSection}>
            <Link className={styles.continuationLink} href={route(continuationPanda.href)}>
              {continuationPanda.image ? <img src={continuationPanda.image} alt="" loading="lazy" /> : <span className={styles.continuationNoPhoto} aria-hidden="true">{continuationPanda.name.slice(0, 1)}</span>}
              <span className={styles.continuationShade} aria-hidden="true" />
              <span className={styles.continuationCopy}>
                <span>{continuationIsFamily
                  ? (zh ? "继续认识它的家人" : "Keep exploring the family")
                  : (zh ? "再认识一只熊猫" : "Meet another panda")}</span>
                <strong>{continuationPanda.name}</strong>
                <em>{continuationIsFamily
                  ? (zh ? "认识这只熊猫" : "Meet this panda")
                  : (zh ? "继续探索" : "Keep exploring")}<ArrowUpRight aria-hidden="true" /></em>
              </span>
            </Link>
          </section>
        ) : null}
      </main>

      <footer className={`${homeStyles.footer} ${styles.detailFooter}`}>
        <div><strong>吱熊猫 ZhiPanda</strong><span>{zh ? "给熊猫爱好者的熊猫世界。" : "A panda world for panda fans."}</span></div>
        <nav><Link href={route(`/${locale}/prototype/fan-v08/pandas`)}>{zh ? "熊猫图鉴" : "Panda directory"}</Link></nav>
      </footer>
    </div>
  );
}
