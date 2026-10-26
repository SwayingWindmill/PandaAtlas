import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Real data for the journeys: a panda created through the API's own domain modules (the compiled output the
// API dev server just built) and published in a local release with the release command, as production does.

const apiDist = path.resolve(__dirname, "../../../services/api/dist");
export const statePath = path.join(__dirname, ".state.json");

async function load<T>(relative: string): Promise<T> {
  return (await import(pathToFileURL(path.join(apiDist, relative)).href)) as T;
}

export default async function globalSetup(): Promise<void> {
  const { createApplication } = await load<{ createApplication(): Promise<{ get<T>(token: unknown): T; close(): Promise<void> }> }>("bootstrap.js");
  const { EVIDENCE_PORT } = await load<{ EVIDENCE_PORT: symbol }>("modules/evidence/application/evidence.application.js");
  const { PANDA_PORT } = await load<{ PANDA_PORT: symbol }>("modules/panda/application/panda.application.js");
  const { MEDIA_PORT } = await load<{ MEDIA_PORT: symbol }>("modules/media/application/media.application.js");
  const { DatabaseService } = await load<{ DatabaseService: unknown }>("platform/database/database.service.js");
  const { createReleaseCommandContext } = await load<{
    createReleaseCommandContext(): Promise<{ app: { close(): Promise<void> }; ports: unknown }>;
  }>("modules/publication/release-command.module.js");
  const { buildRelease, publishRelease } = await load<{
    buildRelease(ports: unknown, manifest: object, context: object): Promise<unknown>;
    publishRelease(ports: unknown, manifest: object, context: object, reason: string): Promise<unknown>;
  }>("modules/publication/application/release-command.js");

  const app = await createApplication();
  const command = await createReleaseCommandContext();
  try {
    const run = randomUUID().slice(0, 8);
    const sourceId = `e2e:${run}`;
    const evidence = app.get<{ createSource(input: object): Promise<unknown> }>(EVIDENCE_PORT);
    const pandas = app.get<{
      createPanda(input: object): Promise<{ pandaId: string }>;
      recordFactAssertion(input: object): Promise<unknown>;
      setFactConclusion(input: object): Promise<unknown>;
    }>(PANDA_PORT);

    await evidence.createSource({
      sourceId,
      publisher: "E2E Archive",
      title: "End-to-end fixture source",
      url: `https://example.test/e2e/${run}`,
      publishedOn: "2026-10-26",
      lastVerifiedOn: "2026-10-26",
      languageTag: "zh-Hans",
      accessState: "accessible",
      evidenceTier: "institutional",
      publicSummary: "End-to-end fixture.",
      contentSha256: "c".repeat(64),
    });
    const slug = `e2e-panda-${run}`;
    const panda = await pandas.createPanda({
      canonicalSlug: slug,
      primaryName: { languageTag: "zh-Hans", value: `测试熊猫${run}`, sourceIds: [sourceId] },
    });
    for (const [index, fact] of [
      { fieldKey: "sex", value: "female" },
      { fieldKey: "birth.date", value: "2020-07-20" },
    ].entries()) {
      const assertionId = `e2e-fact-${index}:${run}`;
      await pandas.recordFactAssertion({ assertionId, pandaId: panda.pandaId, ...fact, certainty: "confirmed", lastVerifiedOn: "2026-10-26", sourceIds: [sourceId] });
      await pandas.setFactConclusion({ pandaId: panda.pandaId, ...fact, status: "confirmed", lastVerifiedOn: "2026-10-26", assertionIds: [assertionId] });
    }

    // A published 猜熊猫 question: the panda's cover photo and three more pandas as options.
    const others = [];
    for (const letter of ["乙", "丙", "丁"]) {
      others.push(await pandas.createPanda({
        canonicalSlug: `e2e-option-${letter.codePointAt(0)}-${run}`,
        primaryName: { languageTag: "zh-Hans", value: `选项${letter}${run}`, sourceIds: [sourceId] },
      }));
    }
    const media = app.get<{
      createAsset(input: object): Promise<{ assetId: string }>;
      attachToPanda(pandaId: string, assetId: string, role: string, order: number): Promise<unknown>;
    }>(MEDIA_PORT);
    const photo = await media.createAsset({
      sourceId,
      storageBucket: "panda-media",
      storageKey: `e2e/${run}.jpg`,
      contentSha256: "d".repeat(64),
      mediaType: "image/jpeg",
      byteSize: 1024,
      title: "E2E panda",
      creator: "E2E Photographer",
      license: "CC-BY-4.0",
      attributionText: "E2E Photographer / CC BY 4.0",
      rightsStatus: "cleared",
      eligibilityStatus: "eligible",
      metadata: { purpose: "mobile-e2e" },
    });
    await media.attachToPanda(panda.pandaId, photo.assetId, "cover", 0);
    const database = app.get<{ db: { insertInto(table: string): { values(row: object): { execute(): Promise<unknown> } } } }>(DatabaseService);
    await database.db
      .insertInto("game.questions")
      .values({
        target_panda_id: panda.pandaId,
        media_asset_id: photo.assetId,
        difficulty: "easy",
        option_panda_ids: [panda.pandaId, ...others.map((other) => other.pandaId)],
        recognition_tips: JSON.stringify(["看眼圈的形状。"]),
        state: "published",
        published_at: new Date(),
      })
      .execute();

    const manifest = { version: `2099.01.01.${Date.now()}`, action: "publish", reason: "End-to-end journeys fixture release." };
    const context = { actor: { kind: "system", systemKey: "release-batch-workflow" }, correlationId: randomUUID() };
    await buildRelease(command.ports, manifest, context);
    await publishRelease(command.ports, manifest, context, manifest.reason);

    await writeFile(statePath, JSON.stringify({ panda: { id: panda.pandaId, slug, name: `测试熊猫${run}` } }), "utf8");
  } finally {
    await command.app.close();
    await app.close();
  }
}
