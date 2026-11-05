import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { type Kysely, sql } from "kysely";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertVerifiedDatabase } from "./batch-database.js";
import { type PublicLearningCatalog, publishedCatalog } from "./modules/learning/application/learning-catalog.js";
import { ConfigModule } from "./platform/config/config.module.js";
import { DatabaseModule } from "./platform/database/database.module.js";
import { DatabaseService } from "./platform/database/database.service.js";
import type { Database } from "./platform/database/database.types.js";

// Entry point of the curation.learning batch adapter (contracts/batch-operations.v1.json):
//   node services/api/dist/learning-command.js
// Writes data/curation/learning/learning.json (the manifest, validated in CI by
// scripts/curation/validate_learning_content.py) into learning.catalog. The protected job supplies
// DATABASE_URL after production-batch approval.

const REPORT_DIRECTORY = ".batch-work/learning";
const COLLECTIONS = ["articles", "cards", "topics", "terms", "faceGuides", "challenges", "monthThemes"] as const;

@Module({ imports: [ConfigModule, DatabaseModule] })
class LearningCommandModule {}

export interface LearningReport {
  version: string;
  previousVersion?: string;
  outcome: "written" | "already current";
  published: Record<(typeof COLLECTIONS)[number], number>;
}

/** The stored document is the file without its comment: the version and its collections. */
export function storedDocument(file: unknown): { version: string; document: Record<string, unknown>; catalog: PublicLearningCatalog } {
  if (typeof file !== "object" || file === null) throw new Error("The learning manifest is not a JSON object.");
  const source = file as Record<string, unknown>;
  const document = Object.fromEntries(["version", ...COLLECTIONS].filter((key) => key in source).map((key) => [key, source[key]]));
  const version = typeof document.version === "string" ? document.version : "";
  // The API parses the stored document with this function, so a document it would refuse is never written.
  // Published entries may be Chinese only; a missing en is served as an empty string.
  return { version, document, catalog: publishedCatalog({ version, document }) };
}

/** Upserts the one catalog row; a changed document must carry a new version. */
export async function writeLearningCatalog(
  db: Kysely<Database>,
  version: string,
  document: Record<string, unknown>,
): Promise<Pick<LearningReport, "outcome" | "previousVersion">> {
  const json = JSON.stringify(document);
  const current = await db
    .selectFrom("learning.catalog")
    .select(["version", sql<boolean>`document = ${json}::jsonb`.as("same")])
    .where("catalog_id", "=", 1)
    .executeTakeFirst();
  if (current?.same === true) return { outcome: "already current" };
  if (current?.version === version) {
    throw new Error(`learning.catalog already holds ${version} with different content; give the changed file a new version.`);
  }
  await db
    .insertInto("learning.catalog")
    .values({ catalog_id: 1, version, document: json, updated_at: sql`now()` })
    .onConflict((conflict) => conflict.column("catalog_id").doUpdateSet({ version, document: json, updated_at: sql`now()` }))
    .execute();
  return { outcome: "written", ...(current === undefined ? {} : { previousVersion: current.version }) };
}

export function renderLearningReport(report: LearningReport): string {
  return [
    `## 科普 catalog ${report.version}: ${report.outcome}`,
    "",
    `Replaced: ${report.previousVersion ?? "nothing"}.`,
    "",
    "| Collection | Published entries |",
    "|---|---:|",
    ...COLLECTIONS.map((name) => `| ${name} | ${report.published[name]} |`),
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const manifestPath = process.env.BATCH_MANIFEST_PATH;
  if (!manifestPath) throw new Error("BATCH_MANIFEST_PATH is required.");
  const { version, document, catalog } = storedDocument(JSON.parse(await readFile(manifestPath, "utf8")));
  assertVerifiedDatabase();

  const app = await NestFactory.createApplicationContext(LearningCommandModule, { logger: ["error", "warn"] });
  try {
    const written = await writeLearningCatalog(app.get(DatabaseService).db, version, document);
    const report: LearningReport = {
      version,
      ...written,
      published: Object.fromEntries(COLLECTIONS.map((name) => [name, catalog[name].length])) as LearningReport["published"],
    };
    await mkdir(REPORT_DIRECTORY, { recursive: true });
    await writeFile(path.join(REPORT_DIRECTORY, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const markdown = renderLearningReport(report);
    console.log(markdown);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
  } finally {
    await app.close();
  }
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith("learning-command")) {
  main().catch((error: unknown) => {
    console.error(`[learning] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
