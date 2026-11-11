// 比一比: pairs of pandas the team publishes side by side, each with a title and a one-line
// dek. Fans do not pick the pair. The catalog holds drafts too; the public list is published
// entries only, newest first.

export interface PublicComparison {
  id: string;
  title: string;
  dek: string;
  /** Exactly two different pandas, in the order the page shows them. */
  pandaSlugs: [string, string];
  updatedAt: string;
}

export interface PublicComparisons {
  version: string;
  items: PublicComparison[];
}

export interface ComparisonCatalogRow {
  version: string;
  document: unknown;
}

export class ComparisonCatalogError extends Error {}

export const EMPTY_COMPARISONS: PublicComparisons = { version: "", items: [] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ITEM_KEYS = ["id", "status", "title", "dek", "pandaSlugs", "updatedAt"];
const TITLE_MAX = 16;
const DEK_MAX = 30;

function fail(message: string): never {
  throw new ComparisonCatalogError(message);
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${at} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, at: string, max: number): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${at} must be a non-empty string`);
  if ([...value].length > max) fail(`${at} must be ${max} characters or fewer`);
  return value;
}

function slug(value: unknown, at: string): string {
  if (typeof value !== "string" || !SLUG.test(value)) fail(`${at} must be a slug`);
  return value;
}

export function validateComparison(value: unknown, at: string): PublicComparison & { status: "draft" | "published" } {
  const item = record(value, at);
  const extra = Object.keys(item).filter((key) => !ITEM_KEYS.includes(key));
  if (extra.length) fail(`${at} has unknown keys: ${extra.join(", ")}`);
  if (item.status !== "draft" && item.status !== "published") fail(`${at}.status must be draft or published`);
  if (!Array.isArray(item.pandaSlugs) || item.pandaSlugs.length !== 2) fail(`${at}.pandaSlugs must be two slugs`);
  const pair: [string, string] = [
    slug(item.pandaSlugs[0], `${at}.pandaSlugs[0]`),
    slug(item.pandaSlugs[1], `${at}.pandaSlugs[1]`),
  ];
  if (pair[0] === pair[1]) fail(`${at}.pandaSlugs must be two different pandas`);
  if (typeof item.updatedAt !== "string" || !INSTANT.test(item.updatedAt) || Number.isNaN(Date.parse(item.updatedAt))) {
    fail(`${at}.updatedAt must be an ISO date-time with an offset`);
  }
  return {
    id: slug(item.id, `${at}.id`),
    status: item.status,
    title: text(item.title, `${at}.title`, TITLE_MAX),
    dek: text(item.dek, `${at}.dek`, DEK_MAX),
    pandaSlugs: pair,
    updatedAt: item.updatedAt,
  };
}

export function publishedComparisons(row: ComparisonCatalogRow | null): PublicComparisons {
  if (row === null) return EMPTY_COMPARISONS;
  const document = record(row.document, "document");
  if (document.version !== row.version) fail("document version does not match the catalog");
  if (!Array.isArray(document.items)) fail("items must be a list");
  const seen = new Set<string>();
  const items = document.items
    .map((value, index) => validateComparison(value, `items[${index}]`))
    .filter((item) => {
      if (seen.has(item.id)) fail(`duplicate id ${item.id}`);
      seen.add(item.id);
      return item.status === "published";
    })
    .map((item): PublicComparison => {
      const { status, ...rest } = item;
      void status;
      return rest;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  return { version: row.version, items };
}
