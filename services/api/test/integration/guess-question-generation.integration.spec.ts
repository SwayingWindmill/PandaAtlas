import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { generateGuessQuestions } from "../../src/modules/game/application/guess-question-generation.js";
import { PostgresGuessQuestionSource } from "../../src/modules/game/infrastructure/postgres-guess-question-source.js";
import { MEDIA_PORT, type MediaPort } from "../../src/modules/media/application/media.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { PUBLICATION_PORT, type PublicationPort } from "../../src/modules/publication/application/publication.application.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { injectHttp } from "../inject-http.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let app: NestExpressApplication;

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;
  app = await createApplication();
});

afterAll(async () => {
  await app.close();
});

describe("猜熊猫 questions from the active release", () => {
  it("draws one question per living panda with a public cover, publishes it once, and serves it", async () => {
    const suffix = randomUUID().slice(0, 8);
    const sourceId = `guess-generation:${suffix}`;
    await app.get<EvidencePort>(EVIDENCE_PORT).createSource({
      sourceId,
      publisher: "Guess Generation Fixture",
      title: "Guess generation fixture",
      url: `https://example.test/guess/${suffix}`,
      publishedOn: "2026-10-27",
      lastVerifiedOn: "2026-10-27",
      languageTag: "zh-Hans",
      accessState: "accessible",
      evidenceTier: "institutional",
    });
    const pandas = app.get<PandaPort>(PANDA_PORT);
    const media = app.get<MediaPort>(MEDIA_PORT);
    const ids: string[] = [];
    for (const [index, lifeStatus] of ["alive", "alive", "alive", "alive", "deceased"].entries()) {
      const panda = await pandas.createPanda({
        canonicalSlug: `guess-generation-${index}-${suffix}`,
        primaryName: { languageTag: "zh-Hans", value: `出题熊猫${index}${suffix}`, sourceIds: [sourceId] },
      });
      ids.push(panda.pandaId);
      for (const [factIndex, fact] of [
        { fieldKey: "life_status", value: lifeStatus },
        { fieldKey: "birth_date", value: `201${index}-08-01` },
      ].entries()) {
        const assertionId = `guess-generation-${index}-${factIndex}:${suffix}`;
        await pandas.recordFactAssertion({
          assertionId,
          pandaId: panda.pandaId,
          ...fact,
          certainty: "confirmed",
          lastVerifiedOn: "2026-10-27",
          sourceIds: [sourceId],
        });
        await pandas.setFactConclusion({
          pandaId: panda.pandaId,
          ...fact,
          status: "confirmed",
          lastVerifiedOn: "2026-10-27",
          assertionIds: [assertionId],
        });
      }
      const cover = await media.createAsset({
        sourceId,
        storageBucket: "panda-media",
        storageKey: `guess-generation/${suffix}-${index}.jpg`,
        contentSha256: `${index}`.repeat(64),
        mediaType: "image/jpeg",
        byteSize: 1024,
        rightsStatus: "cleared",
        eligibilityStatus: "eligible",
        metadata: { purpose: "guess-generation-integration" },
      });
      await media.attachToPanda(panda.pandaId, cover.assetId, "cover", 0);
    }

    const publication = app.get<PublicationPort>(PUBLICATION_PORT);
    const context = { actor: { kind: "system" as const, systemKey: "guess-generation" }, correlationId: randomUUID() };
    const release = await publication.build(`guess-generation-${suffix}`, context);
    await publication.seal(release.releaseId, context, "Guess generation integration release.");
    await publication.activate(release.releaseId, context, "Guess generation integration release.");

    const source = new PostgresGuessQuestionSource(app.get(DatabaseService));
    expect((await source.activeRelease())?.releaseId).toBe(release.releaseId);
    const ours = (await source.candidates(release.releaseId)).filter((candidate) => ids.includes(candidate.pandaId));
    expect(ours.find((candidate) => candidate.pandaId === ids[1])).toMatchObject({
      name: `出题熊猫1${suffix}`,
      living: true,
      birthYear: 2011,
    });
    expect(ours.find((candidate) => candidate.pandaId === ids[4])?.living).toBe(false);

    const questions = generateGuessQuestions(ours);
    expect(questions.map((question) => question.targetPandaId).sort()).toEqual(ids.slice(0, 4).sort());
    expect(await source.publish(questions)).toBe(4);
    expect(await source.publish(questions)).toBe(0);

    const stored = await app
      .get(DatabaseService)
      .db.selectFrom("game.questions")
      .select(["target_panda_id", "state", "recognition_tips"])
      .where("target_panda_id", "in", ids)
      .execute();
    expect(stored).toHaveLength(4);
    expect(stored.every((row) => row.state === "published")).toBe(true);
    expect(stored.find((row) => row.target_panda_id === ids[1])?.recognition_tips).toEqual([
      `出题熊猫1${suffix}2011 年出生。`,
    ]);

    const served = await injectHttp(app, { method: "GET", url: "/api/v2/games/guess/question" });
    expect(served.statusCode).toBe(200);
  });
});
