export const PANDA_ENRICHMENT_ACCESS_STATES = [
  "accessible",
  "redirected",
  "changed",
  "unavailable",
  "archived",
  "restricted",
] as const;
export type PandaEnrichmentAccessState = (typeof PANDA_ENRICHMENT_ACCESS_STATES)[number];

export const PANDA_ENRICHMENT_FACT_KEYS = [
  "sex",
  "birth_date",
  "birth_date_precision",
  "life_status",
  "death_date",
  "birthplace",
] as const;
export type PandaEnrichmentFactKey = (typeof PANDA_ENRICHMENT_FACT_KEYS)[number];

export const PANDA_ENRICHMENT_CERTAINTIES = ["confirmed", "provisional"] as const;
export type PandaEnrichmentCertainty = (typeof PANDA_ENRICHMENT_CERTAINTIES)[number];

export const PANDA_ENRICHMENT_DATE_PRECISIONS = ["day", "month", "year", "unknown"] as const;
export type PandaEnrichmentDatePrecision = (typeof PANDA_ENRICHMENT_DATE_PRECISIONS)[number];

export const PANDA_ENRICHMENT_RESIDENCY_STATUSES = [
  "confirmed",
  "confirmed_country_level",
  "provisional",
] as const;
export type PandaEnrichmentResidencyStatus = (typeof PANDA_ENRICHMENT_RESIDENCY_STATUSES)[number];

export const PANDA_ENRICHMENT_LINEAGE_STATUSES = ["confirmed", "tentative"] as const;
export type PandaEnrichmentLineageStatus = (typeof PANDA_ENRICHMENT_LINEAGE_STATUSES)[number];

export interface PandaEnrichmentSource {
  key: string;
  publisher: string;
  title: string;
  url: string;
  lastVerifiedOn: string;
  publishedOn?: string;
  languageTag: string;
  accessState: PandaEnrichmentAccessState;
  evidenceTier?: string;
  publicSummary?: string;
}

export interface PandaEnrichmentFact {
  fieldKey: PandaEnrichmentFactKey;
  value: string;
  certainty: PandaEnrichmentCertainty;
  lastVerifiedOn: string;
  sourceKeys: string[];
}

export interface PandaEnrichmentResidency {
  placeSlug: string;
  startOn: string | null;
  startPrecision: PandaEnrichmentDatePrecision;
  status: PandaEnrichmentResidencyStatus;
  lastVerifiedOn?: string;
  sourceKeys: string[];
}

export interface PandaEnrichmentParent {
  parentSlug: string;
  status: PandaEnrichmentLineageStatus;
  reviewedOn?: string;
  sourceKeys: string[];
}

export interface PandaEnrichmentLineage {
  mother?: PandaEnrichmentParent;
  father?: PandaEnrichmentParent;
}

export interface PandaEnrichmentItem {
  pandaSlug: string;
  facts: PandaEnrichmentFact[];
  currentResidency?: PandaEnrichmentResidency;
  lineage?: PandaEnrichmentLineage;
}

export interface PandaEnrichmentDocument {
  version: string;
  updatedAt: string;
  sources: PandaEnrichmentSource[];
  items: PandaEnrichmentItem[];
}

export class PandaEnrichmentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PandaEnrichmentError";
  }
}

const VERSION = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_KEY = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DOC_KEYS = ["version", "updatedAt", "sources", "items"];
const SOURCE_KEYS = [
  "key",
  "publisher",
  "title",
  "url",
  "lastVerifiedOn",
  "publishedOn",
  "languageTag",
  "accessState",
  "evidenceTier",
  "publicSummary",
];
const ITEM_KEYS = ["pandaSlug", "facts", "currentResidency", "lineage"];
const FACT_KEYS = ["fieldKey", "value", "certainty", "lastVerifiedOn", "sourceKeys"];
const RESIDENCY_KEYS = ["placeSlug", "startOn", "startPrecision", "status", "lastVerifiedOn", "sourceKeys"];
const LINEAGE_KEYS = ["mother", "father"];
const PARENT_KEYS = ["parentSlug", "status", "reviewedOn", "sourceKeys"];

function fail(message: string): never {
  throw new PandaEnrichmentError(message);
}

function record(value: unknown, at: string, allowedKeys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${at} must be an object`);
  }
  const obj = value as Record<string, unknown>;
  const extra = Object.keys(obj).filter((key) => !allowedKeys.includes(key));
  if (extra.length > 0) {
    fail(`${at} has unknown keys: ${extra.join(", ")}`);
  }
  return obj;
}

function nonEmptyString(value: unknown, at: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${at} must be a non-empty string`);
  }
  return value.trim();
}

function matchPattern(value: unknown, pattern: RegExp, at: string): string {
  const text = nonEmptyString(value, at);
  if (!pattern.test(text)) {
    fail(`${at} is malformed`);
  }
  return text;
}

function realDay(value: unknown, at: string): string {
  const day = matchPattern(value, DAY, at);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
    fail(`${at} is not a real day`);
  }
  return day;
}

function httpsUrl(value: unknown, at: string): string {
  const raw = nonEmptyString(value, at);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail(`${at} is not a URL`);
  }
  if (url.protocol !== "https:") {
    fail(`${at} must use https`);
  }
  if (url.hostname === "vertexaisearch.cloud.google.com") {
    fail(`${at} must be a direct source URL, not a search redirect`);
  }
  return raw;
}

function oneOf<T extends string>(value: unknown, choices: readonly T[], at: string): T {
  const text = nonEmptyString(value, at);
  if (!(choices as readonly string[]).includes(text)) {
    fail(`${at} must be one of ${choices.join(", ")}`);
  }
  return text as T;
}

function sourceKeyList(value: unknown, knownSources: ReadonlySet<string>, at: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${at} must be a non-empty array`);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = matchPattern(value[index], SOURCE_KEY, `${at}[${index}]`);
    if (!knownSources.has(key)) {
      fail(`${at}[${index}] references unknown source key ${key}`);
    }
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

function parseSource(raw: unknown, at: string): PandaEnrichmentSource {
  const source = record(raw, at, SOURCE_KEYS);
  return {
    key: matchPattern(source.key, SOURCE_KEY, `${at}.key`),
    publisher: nonEmptyString(source.publisher, `${at}.publisher`),
    title: nonEmptyString(source.title, `${at}.title`),
    url: httpsUrl(source.url, `${at}.url`),
    lastVerifiedOn: realDay(source.lastVerifiedOn, `${at}.lastVerifiedOn`),
    ...(source.publishedOn === undefined ? {} : { publishedOn: realDay(source.publishedOn, `${at}.publishedOn`) }),
    languageTag: nonEmptyString(source.languageTag, `${at}.languageTag`),
    accessState: oneOf(source.accessState, PANDA_ENRICHMENT_ACCESS_STATES, `${at}.accessState`),
    ...(source.evidenceTier === undefined ? {} : { evidenceTier: nonEmptyString(source.evidenceTier, `${at}.evidenceTier`) }),
    ...(source.publicSummary === undefined
      ? {}
      : { publicSummary: nonEmptyString(source.publicSummary, `${at}.publicSummary`) }),
  };
}

function validateFactValue(fieldKey: PandaEnrichmentFactKey, rawValue: unknown, at: string): string {
  if (fieldKey === "sex") return oneOf(rawValue, ["male", "female"], at);
  if (fieldKey === "life_status") return oneOf(rawValue, ["alive", "deceased"], at);
  if (fieldKey === "birth_date" || fieldKey === "death_date") return realDay(rawValue, at);
  if (fieldKey === "birth_date_precision") return oneOf(rawValue, ["day", "month", "year"], at);
  return nonEmptyString(rawValue, at);
}

function parseFact(raw: unknown, knownSources: ReadonlySet<string>, at: string): PandaEnrichmentFact {
  const fact = record(raw, at, FACT_KEYS);
  const fieldKey = oneOf(fact.fieldKey, PANDA_ENRICHMENT_FACT_KEYS, `${at}.fieldKey`);
  return {
    fieldKey,
    value: validateFactValue(fieldKey, fact.value, `${at}.value`),
    certainty: oneOf(fact.certainty, PANDA_ENRICHMENT_CERTAINTIES, `${at}.certainty`),
    lastVerifiedOn: realDay(fact.lastVerifiedOn, `${at}.lastVerifiedOn`),
    sourceKeys: sourceKeyList(fact.sourceKeys, knownSources, `${at}.sourceKeys`),
  };
}

function parseResidency(raw: unknown, knownSources: ReadonlySet<string>, at: string): PandaEnrichmentResidency {
  const residency = record(raw, at, RESIDENCY_KEYS);
  const startPrecision = oneOf(residency.startPrecision, PANDA_ENRICHMENT_DATE_PRECISIONS, `${at}.startPrecision`);
  let startOn: string | null = null;
  if (startPrecision === "unknown") {
    if (residency.startOn !== undefined && residency.startOn !== null) {
      fail(`${at}.startOn must be omitted or null when startPrecision is unknown`);
    }
  } else {
    startOn = realDay(residency.startOn, `${at}.startOn`);
  }
  return {
    placeSlug: matchPattern(residency.placeSlug, SLUG, `${at}.placeSlug`),
    startOn,
    startPrecision,
    status: oneOf(residency.status, PANDA_ENRICHMENT_RESIDENCY_STATUSES, `${at}.status`),
    ...(residency.lastVerifiedOn === undefined
      ? {}
      : { lastVerifiedOn: realDay(residency.lastVerifiedOn, `${at}.lastVerifiedOn`) }),
    sourceKeys: sourceKeyList(residency.sourceKeys, knownSources, `${at}.sourceKeys`),
  };
}

function parseParent(
  raw: unknown,
  pandaSlug: string,
  knownSources: ReadonlySet<string>,
  at: string,
): PandaEnrichmentParent {
  const parent = record(raw, at, PARENT_KEYS);
  const parentSlug = matchPattern(parent.parentSlug, SLUG, `${at}.parentSlug`);
  if (parentSlug === pandaSlug) {
    fail(`${at}.parentSlug cannot equal pandaSlug ${pandaSlug}`);
  }
  const status =
    parent.status === undefined ? "confirmed" : oneOf(parent.status, PANDA_ENRICHMENT_LINEAGE_STATUSES, `${at}.status`);
  return {
    parentSlug,
    status,
    ...(parent.reviewedOn === undefined ? {} : { reviewedOn: realDay(parent.reviewedOn, `${at}.reviewedOn`) }),
    sourceKeys: sourceKeyList(parent.sourceKeys, knownSources, `${at}.sourceKeys`),
  };
}

function parseLineage(
  raw: unknown,
  pandaSlug: string,
  knownSources: ReadonlySet<string>,
  at: string,
): PandaEnrichmentLineage {
  const lineage = record(raw, at, LINEAGE_KEYS);
  const mother =
    lineage.mother === undefined ? undefined : parseParent(lineage.mother, pandaSlug, knownSources, `${at}.mother`);
  const father =
    lineage.father === undefined ? undefined : parseParent(lineage.father, pandaSlug, knownSources, `${at}.father`);
  if (mother === undefined && father === undefined) {
    fail(`${at} must define mother and/or father`);
  }
  if (mother !== undefined && father !== undefined && mother.parentSlug === father.parentSlug) {
    fail(`${at}.mother.parentSlug and father.parentSlug cannot match (${mother.parentSlug})`);
  }
  return {
    ...(mother === undefined ? {} : { mother }),
    ...(father === undefined ? {} : { father }),
  };
}

function parseItem(raw: unknown, knownSources: ReadonlySet<string>, at: string): PandaEnrichmentItem {
  const item = record(raw, at, ITEM_KEYS);
  const pandaSlug = matchPattern(item.pandaSlug, SLUG, `${at}.pandaSlug`);
  const factsRaw = item.facts === undefined ? [] : item.facts;
  if (!Array.isArray(factsRaw)) {
    fail(`${at}.facts must be an array`);
  }
  const facts: PandaEnrichmentFact[] = [];
  const seenFacts = new Set<PandaEnrichmentFactKey>();
  for (let index = 0; index < factsRaw.length; index += 1) {
    const parsed = parseFact(factsRaw[index], knownSources, `${at}.facts[${index}]`);
    if (seenFacts.has(parsed.fieldKey)) {
      fail(`${at}.facts has duplicate fieldKey ${parsed.fieldKey}`);
    }
    seenFacts.add(parsed.fieldKey);
    facts.push(parsed);
  }

  const birthDate = facts.find((fact) => fact.fieldKey === "birth_date")?.value;
  const deathDate = facts.find((fact) => fact.fieldKey === "death_date")?.value;
  if (birthDate !== undefined && deathDate !== undefined && deathDate < birthDate) {
    fail(`${at} has death_date (${deathDate}) earlier than birth_date (${birthDate})`);
  }

  const currentResidency =
    item.currentResidency === undefined
      ? undefined
      : parseResidency(item.currentResidency, knownSources, `${at}.currentResidency`);
  const lifeStatus = facts.find((fact) => fact.fieldKey === "life_status")?.value;
  if (lifeStatus === "deceased" && currentResidency !== undefined) {
    fail(`${at} cannot set currentResidency when life_status is deceased`);
  }
  const lineage =
    item.lineage === undefined ? undefined : parseLineage(item.lineage, pandaSlug, knownSources, `${at}.lineage`);

  if (facts.length === 0 && currentResidency === undefined && lineage === undefined) {
    fail(`${at} must specify at least one of facts, currentResidency, or lineage`);
  }

  return {
    pandaSlug,
    facts,
    ...(currentResidency === undefined ? {} : { currentResidency }),
    ...(lineage === undefined ? {} : { lineage }),
  };
}

export function parsePandaEnrichment(raw: unknown): PandaEnrichmentDocument {
  const doc = record(raw, "panda-enrichment", DOC_KEYS);
  const version = matchPattern(doc.version, VERSION, "version");
  const updatedAt = matchPattern(doc.updatedAt, INSTANT, "updatedAt");
  if (Number.isNaN(Date.parse(updatedAt))) {
    fail("updatedAt is not a valid timestamp");
  }

  if (!Array.isArray(doc.sources) || doc.sources.length === 0) {
    fail("sources must be a non-empty array");
  }
  const seenSourceKeys = new Set<string>();
  const sources: PandaEnrichmentSource[] = [];
  for (let index = 0; index < doc.sources.length; index += 1) {
    const parsed = parseSource(doc.sources[index], `sources[${index}]`);
    if (seenSourceKeys.has(parsed.key)) {
      fail(`duplicate source key ${parsed.key}`);
    }
    seenSourceKeys.add(parsed.key);
    sources.push(parsed);
  }

  if (!Array.isArray(doc.items) || doc.items.length === 0) {
    fail("items must be a non-empty array");
  }
  const seenPandas = new Set<string>();
  const items: PandaEnrichmentItem[] = [];
  for (let index = 0; index < doc.items.length; index += 1) {
    const parsed = parseItem(doc.items[index], seenSourceKeys, `items[${index}]`);
    if (seenPandas.has(parsed.pandaSlug)) {
      fail(`duplicate pandaSlug ${parsed.pandaSlug}`);
    }
    seenPandas.add(parsed.pandaSlug);
    items.push(parsed);
  }

  return { version, updatedAt, sources, items };
}
