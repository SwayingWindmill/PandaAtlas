// 场馆动态: neutral facts from institutions' own announcements. Each entry
// carries the announcement's URL, its publisher, the date it was published and
// when the entry was last checked. The catalog holds drafts too; the public
// list is published entries only, newest first.

export const VENUE_NEWS_KINDS = ["enclosure", "schedule", "closure", "arrival", "departure", "event", "other"] as const;
export type VenueNewsKind = (typeof VENUE_NEWS_KINDS)[number];

export interface PublicVenueNewsItem {
  id: string;
  institutionSlug: string;
  kind: VenueNewsKind;
  /** The announcement's own headline, verbatim. */
  headline: string;
  pandaSlugs: string[];
  sourceUrl: string;
  sourcePublisher: string;
  publishedOn: string;
  updatedAt: string;
}

export interface PublicVenueNews {
  version: string;
  items: PublicVenueNewsItem[];
}

export interface VenueNewsCatalogRow {
  version: string;
  document: unknown;
}

export class VenueNewsCatalogError extends Error {}

export const EMPTY_VENUE_NEWS: PublicVenueNews = { version: "", items: [] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ITEM_KEYS = ["id", "status", "institutionSlug", "kind", "headline", "pandaSlugs", "sourceUrl", "sourcePublisher", "publishedOn", "updatedAt"];

function fail(message: string): never {
  throw new VenueNewsCatalogError(message);
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

export function validateVenueNewsItem(value: unknown, at: string): PublicVenueNewsItem & { status: "draft" | "published" } {
  const item = record(value, at);
  const extra = Object.keys(item).filter((k) => !ITEM_KEYS.includes(k));
  if (extra.length) fail(`${at} has unknown keys: ${extra.join(", ")}`);
  if (item.status !== "draft" && item.status !== "published") fail(`${at}.status must be draft or published`);
  if (!VENUE_NEWS_KINDS.includes(item.kind as VenueNewsKind)) fail(`${at}.kind is not a known kind`);
  if (!Array.isArray(item.pandaSlugs)) fail(`${at}.pandaSlugs must be a list`);
  const publishedOn = match(item.publishedOn, DAY, `${at}.publishedOn`);
  const updatedAt = match(item.updatedAt, INSTANT, `${at}.updatedAt`);
  if (Number.isNaN(Date.parse(updatedAt))) fail(`${at}.updatedAt is not a date`);
  return {
    id: match(item.id, SLUG, `${at}.id`),
    status: item.status,
    institutionSlug: match(item.institutionSlug, SLUG, `${at}.institutionSlug`),
    kind: item.kind as VenueNewsKind,
    headline: str(item.headline, `${at}.headline`),
    pandaSlugs: item.pandaSlugs.map((s, i) => match(s, SLUG, `${at}.pandaSlugs[${i}]`)),
    sourceUrl: httpsUrl(item.sourceUrl, `${at}.sourceUrl`),
    sourcePublisher: str(item.sourcePublisher, `${at}.sourcePublisher`),
    publishedOn,
    updatedAt,
  };
}

export function publishedVenueNews(row: VenueNewsCatalogRow | null, institutionSlug?: string): PublicVenueNews {
  if (row === null) return EMPTY_VENUE_NEWS;
  const document = record(row.document, "document");
  if (document.version !== row.version) fail("document version does not match the catalog");
  if (!Array.isArray(document.items)) fail("items must be a list");
  const seen = new Set<string>();
  const items = document.items
    .map((value, index) => validateVenueNewsItem(value, `items[${index}]`))
    .filter((item) => {
      if (seen.has(item.id)) fail(`duplicate id ${item.id}`);
      seen.add(item.id);
      return item.status === "published" && (institutionSlug === undefined || item.institutionSlug === institutionSlug);
    })
    .map((item): PublicVenueNewsItem => {
      const { status, ...rest } = item;
      void status;
      return rest;
    })
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || b.updatedAt.localeCompare(a.updatedAt));
  return { version: row.version, items };
}
