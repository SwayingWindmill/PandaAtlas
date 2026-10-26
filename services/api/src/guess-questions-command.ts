import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertVerifiedDatabase } from "./batch-database.js";
import { type GeneratedQuestion, generateGuessQuestions } from "./modules/game/application/guess-question-generation.js";
import { parseGuessQuestionManifest } from "./modules/game/application/guess-question-manifest.js";
import { PostgresGuessQuestionSource } from "./modules/game/infrastructure/postgres-guess-question-source.js";
import { ConfigModule } from "./platform/config/config.module.js";
import { DatabaseModule } from "./platform/database/database.module.js";
import { DatabaseService } from "./platform/database/database.service.js";

// Entry point of the curation.guess-questions batch adapter (contracts/batch-operations.v1.json):
//   node services/api/dist/guess-questions-command.js
// Draws 猜熊猫 questions from the active public release and publishes the ones not already present. The batch
// runner supplies BATCH_MANIFEST_PATH; the protected job supplies DATABASE_URL after production-batch approval.

const REPORT_DIRECTORY = ".batch-work/guess-questions";

@Module({ imports: [ConfigModule, DatabaseModule] })
class GuessQuestionsCommandModule {}

export interface GuessQuestionReport {
  batch: string;
  releaseVersion: string;
  proposed: number;
  published: number;
  byDifficulty: Record<GeneratedQuestion["difficulty"], number>;
}

export function renderGuessQuestionReport(report: GuessQuestionReport): string {
  return [
    `## 猜熊猫 questions ${report.batch}`,
    "",
    `Drawn from release \`${report.releaseVersion}\`: ${report.proposed} questions, ${report.published} newly published, ${report.proposed - report.published} already present.`,
    "",
    "| Difficulty | Questions |",
    "|---|---|",
    ...(["easy", "medium", "hard"] as const).map((level) => `| ${level} | ${report.byDifficulty[level]} |`),
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const manifestPath = process.env.BATCH_MANIFEST_PATH;
  if (!manifestPath) throw new Error("BATCH_MANIFEST_PATH is required.");
  const manifest = parseGuessQuestionManifest(JSON.parse(await readFile(manifestPath, "utf8")), path.basename(manifestPath));
  assertVerifiedDatabase();

  const app = await NestFactory.createApplicationContext(GuessQuestionsCommandModule, { logger: ["error", "warn"] });
  try {
    const source = new PostgresGuessQuestionSource(app.get(DatabaseService));
    const release = await source.activeRelease();
    if (!release) throw new Error("No public release is active.");
    const questions = generateGuessQuestions(await source.candidates(release.releaseId));
    const published = await source.publish(questions);
    const byDifficulty = { easy: 0, medium: 0, hard: 0 };
    for (const question of questions) byDifficulty[question.difficulty] += 1;
    const report: GuessQuestionReport = {
      batch: manifest.batch,
      releaseVersion: release.version,
      proposed: questions.length,
      published,
      byDifficulty,
    };
    await mkdir(REPORT_DIRECTORY, { recursive: true });
    await writeFile(path.join(REPORT_DIRECTORY, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const markdown = renderGuessQuestionReport(report);
    console.log(markdown);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
  } finally {
    await app.close();
  }
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith("guess-questions-command")) {
  main().catch((error: unknown) => {
    console.error(`[guess-questions] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
