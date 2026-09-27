import { cleanPandaPublicText, isPandaNarrativeRecord } from "./panda-public-copy";

export type PandaFactKind =
  | "identity"
  | "birth"
  | "personality"
  | "family"
  | "place"
  | "life"
  | "significance"
  | "status";

export interface PandaDisplayFact {
  id: string;
  kind: PandaFactKind;
  label: string;
  headline: string;
  description: string | null;
  sourceFactId?: string;
}

export interface PandaFactSource {
  id: string;
  category: string;
  predicate: string;
  text: string;
}

export interface PandaFactRelation {
  kind: string;
  name: string;
}

interface SelectPandaFactsInput {
  displayName: string;
  zh: boolean;
  sex: string | null | undefined;
  birthLabel: string | null;
  birthplace: string | null;
  lifeStatus: string | null | undefined;
  deathDate?: string | null;
  place: string | null;
  relations: PandaFactRelation[];
  facts: PandaFactSource[];
  maxItems?: number;
  suppressKinds?: ReadonlySet<PandaFactKind>;
  allowFallbacks?: boolean;
}

const identityCategories = new Set(["identity", "alias", "name_meaning", "appearance", "distinguishing_feature"]);
const personalityCategories = new Set(["personality", "preference", "diet", "behaviour", "behavior", "enrichment", "routine", "social"]);
const lifeCategories = new Set([
  "rescue",
  "release",
  "reproduction",
  "maternal_care",
  "hand_rearing",
  "breeding_context",
  "birth_event",
  "growth",
  "growth_measurement",
  "husbandry_training",
  "health",
  "veterinary_care",
  "care",
]);
const significanceCategories = new Set(["milestone", "event", "research", "conservation", "diplomacy", "cultural_context", "anecdote", "longevity"]);
const placeCategories = new Set(["location", "residence", "residency_history", "transfer"]);

const lowEditorialValue = /(?:现场资料记录|recorded in current profile|age[_ -]?observed)/i;
const lowQuickLifeValue = /(?:feeding_interval|intake|weight|grams?|_kg|birth_weight|labor_duration|water_broke)/i;
const identitySignals = /(?:昵称|称呼|叫作|别名|名字|白毛|白色|白化|特征|辨认|未命名|nickname|called|known as|marking|recogniz|name meaning|public[_ -]?name)/i;
const personalitySignals = /(?:性格|温和|活泼|淘气|习惯|采食|啃食|观察|小鸟|警觉|从容|偏好|喜欢|personality|gentle|playful|habit|feeding|prefer)/i;
const placeSignals = /(?:current[_ -]?location|observed[_ -]?location|arriv|return|residen|transport|stopover|tour|current|现居|已入住|居住在|抵达|来到|送往|停留|巡游|返回|返华|officially[_ -]?reported|返华后的居住地)/i;
const significanceSignals = /(?:oldest|first|record|milestone|longevity|最年长|最高龄|第一只|首次|首只|纪录|记录以来|重要案例|外交|科研|保护|WWF|标志|明星|电视)/i;

function cleanText(value: string): string {
  return cleanPandaPublicText(value);
}

function stripDisplayName(value: string, displayName: string): string {
  if (!value.startsWith(displayName)) return value;
  return value.slice(displayName.length).replace(/^[，,:：\s]+/, "").trim();
}

function headlineFromText(text: string, displayName: string, maxLength: number): string {
  const value = cleanText(text);
  const quoted = [...value.matchAll(/[“「『"']([^”」』"']{2,18})[”」』"']/g)]
    .map((match) => match[1]?.trim())
    .filter((item): item is string => Boolean(item));
  const isNameMeaning = /(?:名字意为|名字意思|name means|name meaning)/i.test(value);
  const quotedHeadline = isNameMeaning && quoted.length > 1
    ? quoted.at(-1)!
    : quoted.find((item) => item !== displayName) ?? quoted[0] ?? null;
  if (quotedHeadline) return quotedHeadline;

  const normalized = stripDisplayName(value, displayName)
    .replace(/^\d{4}-\d{2}-\d{2}\s*/, "")
    .replace(/^\d{4}年[，,\s]*/, "")
    .replace(/^于(?:北京时间)?(?:\d{4}年\d{1,2}月\d{1,2}日)?(?:当日)?(?:约?\d{1,2}时(?:\d{1,2}分)?)?/, "")
    .replace(/^(?:因|因为|由于)/, "");
  const clause = normalized.split(/[。；;，,:：]/)[0]?.trim() || normalized;
  if (clause.length <= maxLength) return clause;
  return `${clause.slice(0, Math.max(8, maxLength - 1)).trim()}…`;
}

function supportingText(text: string, headline: string, displayName: string, maxLength = 62): string | null {
  const value = cleanText(text);
  const comparable = stripDisplayName(value, displayName).replace(/[。.!！]$/, "").trim();
  if (!value || value === headline || comparable === headline) return null;
  if (comparable.includes(headline)) {
    const clauses = comparable.split(/[；;。]/).map((item) => item.trim()).filter(Boolean);
    const remainder = clauses.filter((item) => !item.includes(headline) && !headline.includes(item)).join("；");
    if (!remainder) return null;
    return remainder.length <= maxLength ? `${remainder}。` : `${remainder.slice(0, maxLength - 1).trim()}…`;
  }
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function pickFact(
  facts: PandaFactSource[],
  categories: Set<string>,
  signal: RegExp | null,
  requireSignal = false,
): PandaFactSource | null {
  return facts
    .map((fact) => ({ ...fact, text: cleanText(fact.text) }))
    .filter((fact) => categories.has(fact.category)
      && !lowEditorialValue.test(`${fact.predicate} ${fact.text}`)
      && isPandaNarrativeRecord(fact))
    .map((fact, index) => ({
      fact,
      index,
      score: signal && signal.test(`${fact.predicate} ${fact.text}`) ? 2 : 0,
    }))
    .filter((item) => !requireSignal || item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.fact ?? null;
}

function pickPlaceFact(facts: PandaFactSource[]): PandaFactSource | null {
  return facts
    .map((fact) => ({ ...fact, text: cleanText(fact.text) }))
    .filter((fact) => placeCategories.has(fact.category) && placeSignals.test(`${fact.predicate} ${fact.text}`) && isPandaNarrativeRecord(fact))
    .map((fact, index) => {
      const value = `${fact.predicate} ${fact.text}`;
      const score = /^(?:current[_ -]?location|observed[_ -]?location)$/i.test(fact.predicate)
        ? 120
        : /(?:目前生活在|现在生活在|已入住)/i.test(value)
          ? 100
          : /(?:adaptation|adapted|逐步适应)/i.test(value)
          ? 94
          : /(?:residen|居住)/i.test(value)
            ? 90
            : /(?:arriv|抵达|飞抵|来到)/i.test(value)
              ? 84
              : /(?:return|返回|返华)/i.test(value)
                ? 80
                : 70;
      return { fact, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.fact ?? null;
}

function relationCard(
  relations: PandaFactRelation[],
  sex: string | null | undefined,
  zh: boolean,
): PandaDisplayFact | null {
  if (!relations.length) return null;

  const twin = relations.find((relation) => relation.kind === "twin");
  if (twin) {
    return {
      id: `family:twin:${twin.name}`,
      kind: "family",
      label: zh ? "家人" : "Family",
      headline: zh ? `与${twin.name}是双胞胎` : `Twin of ${twin.name}`,
      description: null,
    };
  }

  const parentRank = (kind: string) => kind === "mother" ? 0 : kind === "father" ? 1 : 2;
  const parents = relations
    .filter((relation) => ["mother", "father", "parent"].includes(relation.kind))
    .sort((left, right) => parentRank(left.kind) - parentRank(right.kind));
  if (parents.length) {
    const parent = parents[0];
    const role = sex === "female"
      ? (zh ? "女儿" : "daughter")
      : sex === "male"
        ? (zh ? "儿子" : "son")
        : (zh ? "孩子" : "offspring");
    const parentNames = parents.slice(0, 2).map((relation) => relation.name);
    return {
      id: `family:parent:${parent.name}`,
      kind: "family",
      label: zh ? "家人" : "Family",
      headline: zh ? `${parentNames.join("和")}的${role}` : `${role} of ${parentNames.join(" and ")}`,
      description: null,
    };
  }

  const children = relations.filter((relation) => relation.kind === "child");
  if (children.length) {
    const names = children.slice(0, 3).map((relation) => relation.name).join(zh ? "、" : ", ");
    return {
      id: "family:children",
      kind: "family",
      label: zh ? "家人" : "Family",
      headline: zh ? `有${children.length}个孩子` : `${children.length} ${children.length === 1 ? "child" : "children"}`,
      description: names ? (zh ? `包括${names}` : `Including ${names}`) : null,
    };
  }

  const sibling = relations.find((relation) => relation.kind === "sibling");
  if (sibling) {
    return {
      id: `family:sibling:${sibling.name}`,
      kind: "family",
      label: zh ? "家人" : "Family",
      headline: zh ? `与${sibling.name}是兄弟姐妹` : `Sibling of ${sibling.name}`,
      description: null,
    };
  }

  return null;
}

function semanticFactCopy(
  fact: PandaFactSource,
  displayName: string,
  zh: boolean,
): { headline: string; description: string | null } | null {
  if (!zh) return null;
  const text = cleanText(fact.text);

  if (fact.category === "name_meaning") {
    const meaning = text.match(/名字(?:意为|寓意|意思是)[“「『"']?([^”」』"'。；]+)[”」』"']?/u)?.[1]?.trim() ?? null;
    if (meaning) return { headline: meaning, description: null };
  }

  const firstTwin = text.match(/^(.+?)与(.+?)是(.+?)首次出生的(.+?)双胞胎[。.]?$/u);
  if (firstTwin) {
    return {
      headline: `${firstTwin[3]}首对${firstTwin[4]}双胞胎`,
      description: `与${firstTwin[2]}一起出生于${firstTwin[3]}。`,
    };
  }

  if (/(?:quarantine|隔离检疫)/i.test(`${fact.predicate} ${text}`)) {
    const headline = stripDisplayName(text, displayName)
      .replace(/^于(?:北京时间)?(?:\d{4}年\d{1,2}月\d{1,2}日)?(?:当日)?(?:约?\d{1,2}时(?:\d{1,2}分)?)?/, "")
      .replace(/[。.]$/, "")
      .trim();
    if (headline) return { headline, description: null };
  }

  if (fact.predicate === "wild_condition_2026") {
    return {
      headline: "已经长成壮年",
      description: "2026年的影像里，它体态健硕、行动自如，野外生活状态良好。",
    };
  }

  if (fact.predicate === "first_public_documentation") {
    return {
      headline: "2019年首次被公开记录",
      description: "当时根据体形估计约1至2岁。",
    };
  }

  if (/(?:longevity|长寿|活到这一年龄)/i.test(`${fact.predicate} ${text}`)) {
    return { headline: "圈养长寿纪录", description: text };
  }

  return null;
}

function factCard(
  fact: PandaFactSource,
  kind: PandaFactKind,
  label: string,
  displayName: string,
  maxHeadline: number,
  zh: boolean,
): PandaDisplayFact {
  const semantic = semanticFactCopy(fact, displayName, zh);
  const headline = semantic?.headline ?? headlineFromText(fact.text, displayName, maxHeadline);
  return {
    id: `${kind}:${fact.id}`,
    kind,
    label,
    headline,
    description: semantic ? semantic.description : supportingText(fact.text, headline, displayName),
    sourceFactId: fact.id,
  };
}

function placeCard(fact: PandaFactSource, displayName: string, zh: boolean): PandaDisplayFact {
  const text = cleanText(fact.text);
  const patterns = zh
    ? [/已入住([^。；]+)/, /居住地列为([^。；]+)/, /居住在([^。；]+)/, /生活在([^。；]+)/, /飞抵([^。；]+)/, /抵达([^。；]+)/, /前往([^。；]+)/]
    : [/(?:lives at|resides at|residence at|arrived at|returned to)\s+([^.;]+)/i];
  const extracted = patterns.map((pattern) => text.match(pattern)?.[1]?.trim()).find(Boolean) ?? null;
  const placeName = extracted?.split(/[，,]/)[0]?.trim() ?? null;
  const headline = placeName || headlineFromText(text, displayName, zh ? 18 : 30);
  const isCurrent = /(?:current[_ -]?location|observed[_ -]?location|early_adaptation|current)/i.test(fact.predicate)
    || /(?:目前生活在|现在生活在|已入住)/.test(text);
  return {
    id: `place:${fact.id}`,
    kind: "place",
    label: zh ? (isCurrent ? "现在在哪" : "去过的地方") : (isCurrent ? "Lives at" : "Place"),
    headline,
    description: supportingText(text, headline, displayName),
    sourceFactId: fact.id,
  };
}

export function selectPandaDisplayFacts({
  displayName,
  zh,
  sex,
  birthLabel,
  birthplace,
  lifeStatus,
  deathDate,
  place,
  relations,
  facts,
  maxItems = 6,
  suppressKinds = new Set<PandaFactKind>(),
  allowFallbacks = true,
}: SelectPandaFactsInput): PandaDisplayFact[] {
  const candidates: PandaDisplayFact[] = [];

  const identity = pickFact(facts, identityCategories, identitySignals, true);
  if (identity) {
    const label = identity.category === "name_meaning"
      ? (zh ? "名字的意思" : "Name meaning")
      : identity.category === "alias"
        ? (zh ? "昵称" : "Nickname")
        : (zh ? "怎么认出它" : "How to recognize");
    candidates.push(factCard(identity, "identity", label, displayName, zh ? 16 : 28, zh));
  }

  if (birthLabel) {
    candidates.push({
      id: "birth:core",
      kind: "birth",
      label: zh ? "出生" : "Born",
      headline: birthLabel,
      description: birthplace ? (zh ? `出生于${birthplace}` : `Born at ${birthplace}`) : null,
    });
  }

  const personality = pickFact(facts, personalityCategories, personalitySignals, true);
  if (personality) candidates.push(factCard(personality, "personality", zh ? "平时的样子" : "Personality", displayName, zh ? 18 : 30, zh));

  const family = relationCard(relations, sex, zh);
  if (family) candidates.push(family);

  if (lifeStatus === "alive" && place) {
    candidates.push({
      id: "place:current",
      kind: "place",
      label: zh ? "现在在哪" : "Lives at",
      headline: place,
      description: null,
    });
  } else {
    const placeFact = pickPlaceFact(facts);
    if (placeFact) candidates.push(placeCard(placeFact, displayName, zh));
  }

  const life = pickFact(facts.filter((fact) => !lowQuickLifeValue.test(`${fact.predicate} ${fact.text}`)), lifeCategories, null);
  if (life) {
    const label = ["rescue", "release"].includes(life.category)
      ? (zh ? "在野外" : "Wild story")
      : ["reproduction", "maternal_care", "hand_rearing", "breeding_context", "birth_event"].includes(life.category)
        ? (zh ? "经历" : "Life story")
        : (zh ? "成长" : "Growth & care");
    candidates.push(factCard(life, "life", label, displayName, zh ? 18 : 30, zh));
  }

  const significance = pickFact(facts, significanceCategories, significanceSignals, true);
  if (significance) candidates.push(factCard(significance, "significance", zh ? "特别之处" : "Why remembered", displayName, zh ? 18 : 30, zh));

  const selected = candidates.filter((item) => !suppressKinds.has(item.kind)).slice(0, maxItems);
  const selectedKinds = new Set(selected.map((item) => item.kind));

  if (allowFallbacks && selected.length < 2 && sex && !selectedKinds.has("identity") && !suppressKinds.has("identity")) {
    const headline = sex === "female"
      ? (zh ? "雌性大熊猫" : "Female giant panda")
      : sex === "male"
        ? (zh ? "雄性大熊猫" : "Male giant panda")
        : null;
    if (headline) selected.push({ id: "identity:sex", kind: "identity", label: zh ? "身份" : "Identity", headline, description: null });
  }

  if (allowFallbacks && selected.length < 2 && lifeStatus === "deceased" && !selectedKinds.has("status")) {
    selected.push({
      id: "status:deceased",
      kind: "status",
      label: zh ? "生平" : "Life",
      headline: zh ? "已离世" : "Deceased",
      description: deathDate ? (zh ? `记录离世日期：${deathDate}` : `Recorded death date: ${deathDate}`) : null,
    });
  }

  const seen = new Set<string>();
  return selected
    .filter((item) => item.headline && !seen.has(item.headline) && (seen.add(item.headline), true))
    .slice(0, maxItems);
}
