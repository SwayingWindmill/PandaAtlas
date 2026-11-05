import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { type Kysely, sql } from "kysely";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertVerifiedDatabase } from "./batch-database.js";
import { publishedOverseasStatus } from "./modules/overseas-status/application/overseas-status-catalog.js";
import { publishedVenueNews } from "./modules/venue-news/application/venue-news-catalog.js";
import { ConfigModule } from "./platform/config/config.module.js";
import { DatabaseModule } from "./platform/database/database.module.js";
import { DatabaseService } from "./platform/database/database.service.js";
import type { Database } from "./platform/database/database.types.js";

// Entry point of the curation.content batch adapter (contracts/batch-operations.v1.json):
//   BATCH_MANIFEST_PATH=data/curation/venue-news/venue-news.json node services/api/dist/content-command.js
// Content ships apart from code: CI validates each file on its pull request (scripts/curation/validate_*.py),
// and after merge the owner runs this batch on main to write the file into the database. The manifest path
// picks what is written; docs/runbooks/content-entry.md is the workflow.

const REPORT_DIRECTORY = ".batch-work/content";

type CatalogTable = "place.venue_news_catalog" | "place.overseas_status_catalog";

export type ContentKind = "venue-news" | "overseas-status" | "institutions";

const KINDS: Record<string, ContentKind> = {
  "data/curation/venue-news/venue-news.json": "venue-news",
  "data/curation/overseas-status/overseas-status.json": "overseas-status",
  "data/curation/institutions/institutions.json": "institutions",
};

export function contentKind(manifestPath: string): ContentKind {
  const kind = KINDS[manifestPath.replaceAll("\\", "/").replace(/^\.\//, "")];
  if (!kind) throw new Error(`curation.content writes ${Object.keys(KINDS).join(", ")}; not ${manifestPath}.`);
  return kind;
}

export interface ContentReport {
  kind: ContentKind;
  outcome: "written" | "already current";
  version?: string;
  previousVersion?: string;
  /** Published entries for a catalog; institutions and the places updated for institutions. */
  counts: Record<string, number>;
}

/** Upserts a one-row catalog. The same content is a no-op; changed content needs a new version. */
export async function writeCatalog(
  db: Kysely<Database>,
  table: CatalogTable,
  version: string,
  document: unknown,
): Promise<Pick<ContentReport, "outcome" | "previousVersion">> {
  const json = JSON.stringify(document);
  const current = await db
    .selectFrom(table)
    .select(["version", sql<boolean>`document = ${json}::jsonb`.as("same")])
    .where("catalog_id", "=", 1)
    .executeTakeFirst();
  if (current?.same === true) return { outcome: "already current" };
  if (current?.version === version)
    throw new Error(`${table} already holds ${version} with different content; give the file a new version.`);
  await db
    .insertInto(table)
    .values({ catalog_id: 1, version, document: json, updated_at: sql`now()` })
    .onConflict((conflict) => conflict.column("catalog_id").doUpdateSet({ version, document: json, updated_at: sql`now()` }))
    .execute();
  return { outcome: "written", ...(current === undefined ? {} : { previousVersion: current.version }) };
}

interface InstitutionPlace {
  slug: string;
  longitude?: number;
  latitude?: number;
  visitGuide?: unknown;
  legacySlugs?: string[];
}

interface InstitutionEntry {
  slug: string;
  nameZh?: string | null;
  nameEn?: string | null;
  countryCode?: string | null;
  profile: unknown;
  places?: InstitutionPlace[];
}

function institutionsOf(file: unknown): InstitutionEntry[] {
  const institutions = (file as { institutions?: unknown } | null)?.institutions;
  if (!Array.isArray(institutions) || institutions.some((entry) => typeof (entry as { slug?: unknown })?.slug !== "string")) {
    throw new Error("institutions.json needs an institutions list of entries with a slug.");
  }
  return institutions as InstitutionEntry[];
}

/**
 * One transaction: merges each place's legacy slugs into it, upserts institutions by slug, then updates the
 * facility places that already exist by slug. A place not in the database yet is skipped, not created.
 */
export async function writeInstitutions(db: Kysely<Database>, institutions: readonly InstitutionEntry[]): Promise<Record<string, number>> {
  const inTransaction = <T>(work: (trx: Kysely<Database>) => Promise<T>) => (db.isTransaction ? work(db) : db.transaction().execute(work));
  return inTransaction(async (trx) => {
    let merged = 0;
    let places = 0;
    for (const place of institutions.flatMap((institution) => institution.places ?? [])) {
      for (const old of place.legacySlugs ?? []) {
        await sql`select place.merge_place(${old}, ${place.slug})`.execute(trx);
        merged += 1;
      }
    }
    for (const institution of institutions) {
      const profile = JSON.stringify(institution.profile);
      const row = await trx
        .insertInto("place.institutions")
        .values({
          slug: institution.slug,
          name_zh: institution.nameZh ?? null,
          name_en: institution.nameEn ?? null,
          country_code: institution.countryCode ?? null,
          profile,
        })
        .onConflict((conflict) =>
          conflict.column("slug").doUpdateSet((eb) => ({
            name_zh: eb.ref("excluded.name_zh"),
            name_en: eb.ref("excluded.name_en"),
            country_code: eb.ref("excluded.country_code"),
            profile: eb.ref("excluded.profile"),
            updated_at: sql`now()`,
          })),
        )
        .returning("institution_id")
        .executeTakeFirstOrThrow();
      for (const place of institution.places ?? []) {
        const result = await trx
          .updateTable("place.places")
          .set({
            institution_id: row.institution_id,
            visit_guide: place.visitGuide === undefined || place.visitGuide === null ? null : JSON.stringify(place.visitGuide),
            updated_at: sql`now()`,
            ...(typeof place.longitude === "number" && typeof place.latitude === "number"
              ? { center: sql<string>`ST_SetSRID(ST_MakePoint(${place.longitude}, ${place.latitude}), 4326)` }
              : {}),
          })
          .where("slug", "=", place.slug)
          .where("place_type", "=", "facility")
          .executeTakeFirst();
        places += Number(result.numUpdatedRows);
      }
    }
    return { institutions: institutions.length, places, merged };
  });
}

/** Parses the file as the API will read it, so a document the API would refuse is never written. */
export async function writeContent(db: Kysely<Database>, kind: ContentKind, file: unknown): Promise<ContentReport> {
  if (kind === "institutions") {
    return { kind, outcome: "written", counts: await writeInstitutions(db, institutionsOf(file)) };
  }
  const document = file as { version?: unknown; items?: unknown };
  const version = typeof document?.version === "string" ? document.version : "";
  if (!version) throw new Error(`${kind} needs a version.`);
  const row = { version, document: file };
  const published = kind === "venue-news" ? publishedVenueNews(row).items.length : publishedOverseasStatus(row).items.length;
  const table = kind === "venue-news" ? "place.venue_news_catalog" : "place.overseas_status_catalog";
  return { kind, version, ...(await writeCatalog(db, table, version, file)), counts: { published } };
}

export function renderContentReport(report: ContentReport): string {
  return [
    `## ${report.kind}${report.version ? ` ${report.version}` : ""}: ${report.outcome}`,
    "",
    ...(report.version ? [`Replaced: ${report.previousVersion ?? "nothing"}.`, ""] : []),
    "| | Count |",
    "|---|---:|",
    ...Object.entries(report.counts).map(([name, count]) => `| ${name} | ${count} |`),
    "",
    ...(report.kind === "institutions" ? ["Publish a release next (`release.publish`) so the app serves the change.", ""] : []),
  ].join("\n");
}

@Module({ imports: [ConfigModule, DatabaseModule] })
class ContentCommandModule {}

async function main(): Promise<void> {
  const manifestPath = process.env.BATCH_MANIFEST_PATH;
  if (!manifestPath) throw new Error("BATCH_MANIFEST_PATH is required.");
  const kind = contentKind(manifestPath);
  const file: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  assertVerifiedDatabase();

  const app = await NestFactory.createApplicationContext(ContentCommandModule, { logger: ["error", "warn"] });
  try {
    const report = await writeContent(app.get(DatabaseService).db, kind, file);
    await mkdir(REPORT_DIRECTORY, { recursive: true });
    await writeFile(path.join(REPORT_DIRECTORY, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const markdown = renderContentReport(report);
    console.log(markdown);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
  } finally {
    await app.close();
  }
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith("content-command")) {
  main().catch((error: unknown) => {
    console.error(`[content] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
