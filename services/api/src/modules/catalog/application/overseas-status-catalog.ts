// 海外大熊猫状态 / 归国: where an overseas-born or loaned panda is, the announced return, and the
// quarantine stage. Facts only, each entry with the announcement it came from and when it was last
// checked. The catalog holds drafts too; the public list is published entries only.

export const OVERSEAS_STAGES = ["abroad", "return_announced", "in_transit", "quarantine", "returned"] as const;
export type OverseasStage = (typeof OVERSEAS_STAGES)[number];

/** A day, month or year, as precise as the announcement is. */
export interface PartialDate {
  on: string;
  precision: "day" | "month" | "year";
}

export interface PublicOverseasStatusItem {
  pandaSlug: string;
  stage: OverseasStage;
  /** Where the panda is now: the overseas home, or the quarantine base once back. */
  institutionSlug: string;
  expectedReturn?: PartialDate;
  /** The day it arrived back in China, once it has. */
  returnedOn?: string;
  sourceUrl: string;
  sourcePublisher: string;
  updatedAt: string;
}

export interface PublicOverseasStatus {
  version: string;
  items: PublicOverseasStatusItem[];
}

export interface OverseasStatusCatalogRow {
  version: string;
  document: unknown;
}

export class OverseasStatusCatalogError extends Error {}

export const EMPTY_OVERSEAS_STATUS: PublicOverseasStatus = { version: "", items: [] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PARTIAL = { day: DAY, month: /^\d{4}-\d{2}$/, year: /^\d{4}$/ } as const;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ITEM_KEYS = ["status", "pandaSlug", "stage", "institutionSlug", "expectedReturn", "returnedOn", "sourceUrl", "sourcePublisher", "updatedAt"];
const STAGE_ORDER: Record<OverseasStage, number> = { quarantine: 0, in_transit: 1, return_announced: 2, abroad: 3, returned: 4 };

function fail(message: string): never {
  throw new OverseasStatusCatalogError(message);
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${at} must be an object`);
  return value as Record<string, unknown>;
}

function str(value: unknown, at: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${at} must be a non-empty string`);
  return value;
}

function match(value: unknown, pattern: RegExp, at: string): string {
  const s = str(value, at);
  if (!pattern.test(s)) fail(`${at} is malformed`);
  return s;
}

function realDay(value: unknown, at: string): string {
  const day = match(value, DAY, at);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) fail(`${at} is not a real day`);
  return day;
}

function httpsUrl(value: unknown, at: string): string {
  const s = str(value, at);
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    fail(`${at} is not a URL`);
  }
  if (url.protocol !== "https:") fail(`${at} must be https`);
  return s;
}

function partialDate(value: unknown, at: string): PartialDate {
  const date = record(value, at);
  const extra = Object.keys(date).filter((k) => k !== "on" && k !== "precision");
  if (extra.length) fail(`${at} has unknown keys: ${extra.join(", ")}`);
  const precision = date.precision;
  if (precision !== "day" && precision !== "month" && precision !== "year") fail(`${at}.precision must be day, month or year`);
  const on = precision === "day" ? realDay(date.on, `${at}.on`) : match(date.on, PARTIAL[precision], `${at}.on`);
  return { on, precision };
}

export function validateOverseasStatusItem(value: unknown, at: string): PublicOverseasStatusItem & { status: "draft" | "published" } {
  const item = record(value, at);
  const extra = Object.keys(item).filter((k) => !ITEM_KEYS.includes(k));
  if (extra.length) fail(`${at} has unknown keys: ${extra.join(", ")}`);
  if (item.status !== "draft" && item.status !== "published") fail(`${at}.status must be draft or published`);
  if (!OVERSEAS_STAGES.includes(item.stage as OverseasStage)) fail(`${at}.stage is not a known stage`);
  const stage = item.stage as OverseasStage;
  const updatedAt = match(item.updatedAt, INSTANT, `${at}.updatedAt`);
  if (Number.isNaN(Date.parse(updatedAt))) fail(`${at}.updatedAt is not a date`);
  if (stage === "returned" && item.returnedOn === undefined) fail(`${at}.returnedOn is required once returned`);
  if (stage !== "returned" && stage !== "quarantine" && item.returnedOn !== undefined) fail(`${at}.returnedOn is only for pandas back in China`);
  return {
    status: item.status,
    pandaSlug: match(item.pandaSlug, SLUG, `${at}.pandaSlug`),
    stage,
    institutionSlug: match(item.institutionSlug, SLUG, `${at}.institutionSlug`),
    ...(item.expectedReturn === undefined ? {} : { expectedReturn: partialDate(item.expectedReturn, `${at}.expectedReturn`) }),
    ...(item.returnedOn === undefined ? {} : { returnedOn: realDay(item.returnedOn, `${at}.returnedOn`) }),
    sourceUrl: httpsUrl(item.sourceUrl, `${at}.sourceUrl`),
    sourcePublisher: str(item.sourcePublisher, `${at}.sourcePublisher`),
    updatedAt,
  };
}

/** Published entries, nearest to home first: in quarantine, travelling, announced, abroad, then returned (latest first). */
export function publishedOverseasStatus(row: OverseasStatusCatalogRow | null): PublicOverseasStatus {
  if (row === null) return EMPTY_OVERSEAS_STATUS;
  const document = record(row.document, "document");
  if (document.version !== row.version) fail("document version does not match the catalog");
  if (!Array.isArray(document.items)) fail("items must be a list");
  const seen = new Set<string>();
  const items = document.items
    .map((value, index) => validateOverseasStatusItem(value, `items[${index}]`))
    .filter((item) => {
      if (seen.has(item.pandaSlug)) fail(`duplicate panda ${item.pandaSlug}`);
      seen.add(item.pandaSlug);
      return item.status === "published";
    })
    .map((item): PublicOverseasStatusItem => {
      const { status, ...rest } = item;
      void status;
      return rest;
    })
    .sort(
      (a, b) =>
        STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
        (b.returnedOn ?? "").localeCompare(a.returnedOn ?? "") ||
        (a.expectedReturn?.on ?? "9999").localeCompare(b.expectedReturn?.on ?? "9999") ||
        a.pandaSlug.localeCompare(b.pandaSlug),
    );
  return { version: row.version, items };
}
