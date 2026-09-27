import type { PandaDisplayFact, PandaFactSource } from "./panda-fact-selection";
import { classifyPandaProfile, type PandaProfileClassification } from "./panda-profile-classification";
import { toPandaPublicText } from "./panda-public-copy";

export interface PandaMomentSource {
  id: string;
  date: string;
  category: string;
  predicate?: string;
  text: string;
}

export interface PandaStoryChapter {
  id: string;
  title: string;
  facts: PandaFactSource[];
}

export interface PandaDetailProjection {
  classification: PandaProfileClassification;
  recognitionFacts: PandaFactSource[];
  personalityFacts: PandaFactSource[];
  placeFacts: PandaFactSource[];
  lifeStoryChapters: PandaStoryChapter[];
  recentMoments: PandaMomentSource[];
}

const recognitionCategories = new Set(["appearance", "distinguishing_feature"]);
const identityStoryCategories = new Set(["identity", "alias", "name_meaning"]);
const dailyLifeCategories = new Set(["personality", "preference", "diet", "behaviour", "behavior", "enrichment", "routine", "social"]);
const reproductionCategories = new Set(["reproduction", "maternal_care", "hand_rearing", "breeding_context", "birth_event"]);
const careCategories = new Set(["growth", "growth_measurement", "husbandry_training", "health", "veterinary_care", "care"]);
const placeCategories = new Set(["location", "residence", "residency_history", "transfer"]);
const wildStoryCategories = new Set(["rescue", "release", "wild_monitoring"]);
const significanceCategories = new Set(["milestone", "event", "research", "conservation", "diplomacy", "cultural_context", "anecdote", "longevity"]);
const rewildingSignals = /(?:rewilding|wild[_ -]?training|wild_training|野化|野培)/i;

function publicFacts(facts: PandaFactSource[]): PandaFactSource[] {
  return facts.flatMap((fact) => {
    const text = toPandaPublicText(fact);
    return text ? [{ ...fact, text }] : [];
  });
}

const lifeStoryCategoryScore: Record<string, number> = {
  rescue: 100,
  release: 98,
  wild_monitoring: 96,
  diplomacy: 94,
  conservation: 92,
  research: 90,
  milestone: 88,
  maternal_care: 86,
  reproduction: 84,
  hand_rearing: 82,
  care: 78,
  veterinary_care: 76,
  health: 72,
  training: 88,
  husbandry_training: 68,
  breeding_context: 66,
  birth_event: 64,
  longevity: 62,
  cultural_context: 60,
  anecdote: 58,
  growth: 46,
  growth_measurement: 30,
};

const storyMajorBoostPredicates = /(?:first|oldest|youngest|record|release|rescue|gave_birth|twin|offspring|cub|maternal|foster|protective|breeding)/i;
const storyTransitionBoostPredicates = /(?:handover|return|public)/i;
const storyLegacyBoost = /(?:wwf|logo|celebrity|star|television|visitors?|世界自然基金会|标志|明星|电视|游客)/i;
const storyLowValuePredicates = /(?:weight|grams?|_kg|feeding_interval|intake|water_broke|labor_duration|photographed_on|age[_ -]?observed)/i;
const rememberedSignals = /(?:first|oldest|youngest|record|historic|landmark|首次|首只|纪录|最年长|最高龄|科研|保护|外交|重要案例)/i;

function rememberedFactScore(fact: PandaFactSource): number {
  const value = `${fact.predicate} ${fact.text}`;
  if (/(?:purchased|acquisition|exchange_blocked|trade_embargo|收购|进口许可|贸易禁运)/i.test(value)) return 60;
  if (/(?:wwf|logo|世界自然基金会|标志)/i.test(value)) return 120;
  if (/(?:celebrity|star|television|明星|电视)/i.test(value)) return 110;
  if (/(?:visitors?|游客)/i.test(value)) return 100;
  if (/(?:first|record|oldest|首只|第一只|纪录|最年长|最高龄)/i.test(value)) return 90;
  if (fact.category === "diplomacy") return 70;
  return lifeStoryScore(fact);
}

function lifeStoryScore(fact: PandaFactSource): number {
  let score = lifeStoryCategoryScore[fact.category] ?? 50;
  if (storyMajorBoostPredicates.test(fact.predicate)) score += 10;
  if (storyTransitionBoostPredicates.test(fact.predicate)) score += 4;
  if (storyLegacyBoost.test(`${fact.predicate} ${fact.text}`)) score += 40;
  if (storyLowValuePredicates.test(fact.predicate)) score -= 16;
  return score;
}

function prioritizeLifeStoryFacts(facts: PandaFactSource[]): PandaFactSource[] {
  return facts
    .map((fact, index) => ({ fact, index, score: lifeStoryScore(fact) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ fact }) => fact);
}

function prioritizePlaceFacts(facts: PandaFactSource[]): PandaFactSource[] {
  const score = (fact: PandaFactSource) => {
    const predicate = fact.predicate;
    if (/(?:returned_to|return)/i.test(predicate)) return 100;
    if (/(?:exact_.*arriv|stopover)/i.test(predicate)) return 96;
    if (/(?:transported_to|sent_to)/i.test(predicate)) return 94;
    if (/(?:european_.*tour|zoo_tour|tour)/i.test(predicate)) return 90;
    if (/(?:arrived|arrival)/i.test(predicate)) return 88;
    if (/(?:adaptation|adapted)/i.test(predicate)) return 86;
    if (/(?:current_location|observed_location|residence|residency)/i.test(predicate)) return 82;
    if (fact.category === "transfer") return 70;
    return 60;
  };

  return facts
    .map((fact, index) => ({ fact, index, score: score(fact) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ fact }) => fact);
}

function placeNarrativeFact(fact: PandaFactSource, zh: boolean): PandaFactSource {
  if (!zh) return fact;
  const text = fact.text;

  if (/(?:returned_to|return)/i.test(fact.predicate)) {
    const route = text.match(/^(.+?)于(\d{4}年\d{1,2}月\d{1,2}日)[^，,]*离开([^，,。]+)/u);
    if (route) return { ...fact, text: `${route[1]}于${route[2]}离开${route[3]}，启程返回中国。` };
  }

  if (/(?:arrived|arrival)/i.test(fact.predicate)) {
    return {
      ...fact,
      text: text
        .replace("北京时间", "")
        .replace(/(\d{4}年\d{1,2}月\d{1,2}日)\d{1,2}时/u, "$1"),
    };
  }

  if (/(?:adaptation|adapted)/i.test(fact.predicate)) {
    const adaptation = text.match(/^抵达([^，,]+)后[，,]([^，,]+?)可在/u);
    if (adaptation) return { ...fact, text: `抵达${adaptation[1]}后，${adaptation[2]}逐步适应新的生活环境。` };
  }

  return fact;
}

function afterMonths(dateValue: string, months: number): string | null {
  const date = new Date(`${dateValue.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

export function projectPandaDetailSections({
  facts,
  classificationFacts,
  moments,
  displayFacts,
  reservedFactIds,
  lifeStatus,
  deathDate,
  asOfDate,
  zh,
}: {
  facts: PandaFactSource[];
  classificationFacts?: PandaFactSource[];
  moments: PandaMomentSource[];
  displayFacts: PandaDisplayFact[];
  reservedFactIds?: ReadonlySet<string>;
  lifeStatus: string | null | undefined;
  deathDate?: string | null;
  asOfDate: string | null;
  zh: boolean;
}): PandaDetailProjection {
  const safeFacts = publicFacts(facts);
  const usedFactIds = new Set([
    ...(reservedFactIds ?? []),
    ...displayFacts.flatMap((fact) => fact.sourceFactId ? [fact.sourceFactId] : []),
  ]);
  const cutoff = asOfDate ? afterMonths(asOfDate, 18) : null;
  const recentMoments = lifeStatus === "alive" && cutoff
    ? moments
      .flatMap((moment) => {
        const text = toPandaPublicText(moment);
        return text ? [{ ...moment, text }] : [];
      })
      .filter((moment) => moment.date >= cutoff && !usedFactIds.has(moment.id.replace(/^research:/, "")))
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 3)
    : [];
  const recentFactIds = new Set(recentMoments.map((moment) => moment.id.replace(/^research:/, "")));
  const deeperFacts = safeFacts.filter((fact) => !usedFactIds.has(fact.id) && !recentFactIds.has(fact.id));

  const rewildingFacts = prioritizeLifeStoryFacts(
    deeperFacts.filter((fact) => rewildingSignals.test(`${fact.predicate} ${fact.text}`)),
  ).slice(0, 10);
  const rewildingIds = new Set(rewildingFacts.map((fact) => fact.id));
  const byCategory = (categories: Set<string>) => deeperFacts.filter((fact) => categories.has(fact.category) && !rewildingIds.has(fact.id));
  const recognitionFacts = byCategory(recognitionCategories).slice(0, 4);
  const dailyLifeFacts = byCategory(dailyLifeCategories).slice(0, 6);
  const reproductionFacts = prioritizeLifeStoryFacts(byCategory(reproductionCategories))
    .filter((fact) => !storyLowValuePredicates.test(fact.predicate))
    .slice(0, 10);
  const careFacts = prioritizeLifeStoryFacts(byCategory(careCategories))
    .filter((fact) => !storyLowValuePredicates.test(fact.predicate))
    .slice(0, 10);
  const placeCandidateFacts = byCategory(placeCategories).filter((fact) =>
    fact.category !== "transfer" || /(?:arriv|return|residen|location|transport|stopover|tour|relocat|moved|sent_to)/i.test(fact.predicate),
  );
  const placeFacts = prioritizePlaceFacts(placeCandidateFacts).map((fact) => placeNarrativeFact(fact, zh)).slice(0, 6);
  const wildStoryFacts = prioritizeLifeStoryFacts(byCategory(wildStoryCategories)).slice(0, 10);
  const significancePool = prioritizeLifeStoryFacts(byCategory(significanceCategories)).slice(0, 10);
  const rememberedFacts = significancePool
    .filter((fact) => fact.category !== "milestone" || rememberedSignals.test(`${fact.predicate} ${fact.text}`))
    .sort((left, right) => rememberedFactScore(right) - rememberedFactScore(left));
  const milestoneFacts = significancePool.filter((fact) => !rememberedFacts.includes(fact));

  // A dedicated trait chapter should add depth beyond the quick Facts cards.
  // One leftover observation is kept in About / Facts rather than becoming another full-width module.
  const personalityFacts = dailyLifeFacts.length >= 2 ? dailyLifeFacts : [];
  const recognitionSectionFacts = recognitionFacts.length >= 2 ? recognitionFacts : [];
  // Profile classification is a non-display projection: it may use qualified raw predicates
  // even when the corresponding prose is filtered from public copy for editorial/internal wording.
  const classification = classifyPandaProfile({ facts: classificationFacts ?? facts, lifeStatus, deathDate });

  const rewildingTitle = classification.journey === "rewilding_training"
    ? (zh ? "学习在野外生活" : "Learning to live in the wild")
    : classification.journey === "rewilding_released"
      ? (zh ? "回到野外之前" : "Before returning to the wild")
      : (zh ? "野化训练" : "Rewilding training");
  const candidateLifeStoryChapters = [
    { id: "reproduction", title: zh ? "成为父母以后" : "Becoming a parent", facts: reproductionFacts },
    { id: "wild-story", title: zh ? "从救护到野外" : "From rescue back to the wild", facts: wildStoryFacts },
    { id: "rewilding", title: rewildingTitle, facts: rewildingFacts },
    { id: "milestones", title: zh ? "人生里的几个转折" : "Turning points", facts: milestoneFacts },
    { id: "care", title: zh ? "成长和被照顾的日子" : "Growing up and care", facts: careFacts },
    { id: "significance", title: zh ? "为什么人们记得它" : "Why people remember this panda", facts: rememberedFacts },
  ]
    .filter((chapter) => chapter.facts.some((fact) => !storyLowValuePredicates.test(fact.predicate)))
    .map((chapter, index) => ({
      ...chapter,
      index,
      score: lifeStoryScore(chapter.facts[0]),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ id, title, facts }) => ({ id, title, facts }));
  const lifeStoryFactCount = candidateLifeStoryChapters.reduce((total, chapter) => total + chapter.facts.length, 0);
  const lifeStoryChapters = lifeStoryFactCount >= 2 ? candidateLifeStoryChapters : [];

  return {
    classification,
    recognitionFacts: recognitionSectionFacts,
    personalityFacts,
    placeFacts,
    lifeStoryChapters,
    recentMoments,
  };
}

export { identityStoryCategories, dailyLifeCategories, reproductionCategories, careCategories, placeCategories, wildStoryCategories, significanceCategories, recognitionCategories };
