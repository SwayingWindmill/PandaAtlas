import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { LIFE_HISTORY_PORT, type LifeHistoryPort } from "../../src/modules/life-history/application/life-history.application.js";
import { LINEAGE_PORT, type LineagePort } from "../../src/modules/lineage/application/lineage.application.js";
import { MEDIA_PORT, type MediaPort } from "../../src/modules/media/application/media.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { PLACES_PORT, type PlacesPort } from "../../src/modules/places/application/places.application.js";
import { PUBLICATION_PORT, type PublicationPort } from "../../src/modules/publication/application/publication.application.js";
import type { PublicPandaDetail, PublicReadRelease } from "../../src/modules/publication/application/public-read.application.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let app: NestFastifyApplication;

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

function expectOkRelease(
  result: Awaited<ReturnType<PublicationPort["seal"]>>,
): asserts result is Extract<typeof result, { kind: "ok" }> {
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") throw new Error(`Expected publication result ok, got ${result.kind}`);
}

describe("V2 publication and release-scoped public reads", () => {
  it("seals deterministic PostgreSQL projections, switches releases atomically, and applies narrow emergency controls", async () => {
    const suffix = randomUUID();
    const database = app.get(DatabaseService);
    const evidence = app.get<EvidencePort>(EVIDENCE_PORT);
    const pandas = app.get<PandaPort>(PANDA_PORT);
    const places = app.get<PlacesPort>(PLACES_PORT);
    const lifeHistory = app.get<LifeHistoryPort>(LIFE_HISTORY_PORT);
    const lineage = app.get<LineagePort>(LINEAGE_PORT);
    const media = app.get<MediaPort>(MEDIA_PORT);
    const publication = app.get<PublicationPort>(PUBLICATION_PORT);
    const actorAccountId = randomUUID();
    const context = { actorAccountId, correlationId: randomUUID() };

    await sql`
      insert into auth.users (id, aud, role, created_at, updated_at)
      values (${actorAccountId}::uuid, 'authenticated', 'authenticated', now(), now())
    `.execute(database.db);
    await database.db
      .insertInto("identity.accounts")
      .values({ account_id: actorAccountId, email: null })
      .execute();

    const sourceId = `publication:${suffix}`;
    await evidence.createSource({
      sourceId,
      publisher: "Publication Integration Archive",
      title: "Release-scoped source",
      url: `https://example.test/publication/${suffix}`,
      publishedOn: "2026-08-27",
      lastVerifiedOn: "2026-08-27",
      languageTag: "en",
      accessState: "accessible",
      evidenceTier: "institutional",
      publicSummary: "Initial public summary.",
      internalNotes: "PRIVATE evidence note that must never be projected.",
      contentSha256: "a".repeat(64),
    });

    const father = await pandas.createPanda({
      canonicalSlug: `publication-father-${suffix}`,
      primaryName: { languageTag: "en", value: `Father ${suffix}`, sourceIds: [sourceId] },
    });
    const panda = await pandas.createPanda({
      canonicalSlug: `publication-panda-${suffix}`,
      primaryName: { languageTag: "en", value: `Release Panda ${suffix}`, sourceIds: [sourceId] },
    });
    const assertionId = `publication-fact:${suffix}`;
    await pandas.recordFactAssertion({
      assertionId,
      pandaId: panda.pandaId,
      fieldKey: "birth.date",
      value: "2026-08-27",
      certainty: "confirmed",
      lastVerifiedOn: "2026-08-27",
      sourceIds: [sourceId],
    });
    await pandas.setFactConclusion({
      pandaId: panda.pandaId,
      fieldKey: "birth.date",
      value: "2026-08-27",
      status: "confirmed",
      lastVerifiedOn: "2026-08-27",
      assertionIds: [assertionId],
    });

    const institution = await places.createInstitution({
      slug: `publication-institution-${suffix}`,
      nameEn: "Publication Integration Center",
      countryCode: "CN",
    });
    const place = await places.createPlace({
      institutionId: institution.institutionId,
      slug: `publication-place-${suffix}`,
      placeType: "facility",
      nameEn: "Publication Integration Base",
      countryCode: "CN",
      region: "Sichuan",
      center: { longitude: 104.0665, latitude: 30.5728 },
    });
    await lifeHistory.createResidency({
      residencyId: `publication-residency:${suffix}`,
      pandaId: panda.pandaId,
      placeId: place.placeId,
      residencyType: "primary",
      startOn: "2026-01-01",
      startPrecision: "day",
      status: "confirmed",
      sourceIds: [sourceId],
    });
    await lifeHistory.createEvent({
      eventId: `publication-event:${suffix}`,
      eventType: "public_debut",
      eventStatus: "completed",
      occurredOn: "2026-08-27",
      occurredPrecision: "day",
      toPlaceId: place.placeId,
      participantIds: [panda.pandaId],
      sourceIds: [sourceId],
      summary: "Public debut fixture.",
    });
    await lineage.createAssertion({
      assertionId: `publication-father:${suffix}`,
      childId: panda.pandaId,
      parentId: father.pandaId,
      parentRole: "father",
      status: "confirmed",
      sourceIds: [sourceId],
    });
    const asset = await media.createAsset({
      sourceId,
      storageBucket: "PRIVATE-bucket",
      storageKey: `public/${suffix}.jpg`,
      objectVersion: "PRIVATE-object-version",
      storageEtag: "PRIVATE-etag",
      contentSha256: "b".repeat(64),
      mediaType: "image/jpeg",
      byteSize: 2048,
      title: "Release panda",
      creator: "Integration Photographer",
      license: "CC-BY-4.0",
      attributionText: "Integration Photographer / CC BY 4.0",
      rightsStatus: "cleared",
      eligibilityStatus: "eligible",
      metadata: { privateWorkflow: "PRIVATE-media-metadata" },
    });
    await media.attachToPanda(panda.pandaId, asset.assetId, "cover", 0);

    const first = await publication.build(`publication-${suffix}-1`, context);
    const firstSeal = await publication.seal(first.releaseId, context, "Seal the first integration release");
    expectOkRelease(firstSeal);
    expect(firstSeal.release.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    const firstActivation = await publication.activate(first.releaseId, context, "Activate the first integration release");
    expect(firstActivation.kind).toBe("ok");

    const firstRead = await app.inject({ method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(firstRead.statusCode, firstRead.body).toBe(200);
    const firstBody = firstRead.json<PublicPandaDetail>();
    expect(firstBody.release.releaseId).toBe(first.releaseId);
    expect(firstBody.panda.pandaId).toBe(panda.pandaId);
    expect(firstBody.lineage).toContainEqual(expect.objectContaining({ parentId: father.pandaId }));
    expect(firstBody.residencies).toContainEqual(expect.objectContaining({ placeId: place.placeId }));
    expect(firstBody.events).toContainEqual(expect.objectContaining({ eventType: "public_debut" }));
    expect(firstBody.media).toContainEqual(expect.objectContaining({ assetId: asset.assetId, objectKey: `public/${suffix}.jpg` }));
    expect(firstBody.evidence).toContainEqual(expect.objectContaining({ sourceId, publicSummary: "Initial public summary." }));
    const serializedFirst = JSON.stringify(firstBody);
    expect(serializedFirst).not.toContain("PRIVATE evidence note");
    expect(serializedFirst).not.toContain("PRIVATE-bucket");
    expect(serializedFirst).not.toContain("PRIVATE-object-version");
    expect(serializedFirst).not.toContain("PRIVATE-etag");
    expect(serializedFirst).not.toContain("PRIVATE-media-metadata");

    await expect(
      database.db
        .updateTable("public_read.pandas")
        .set({ canonical_slug: `sealed-mutation-${suffix}` })
        .where("release_id", "=", first.releaseId)
        .where("panda_id", "=", panda.pandaId)
        .execute(),
    ).rejects.toThrow(/sealed release/);

    await evidence.updateVerification({
      sourceId,
      lastVerifiedOn: "2026-08-28",
      accessState: "accessible",
      publicSummary: "Second-release public summary.",
      internalNotes: "PRIVATE second note.",
      contentSha256: "c".repeat(64),
    });
    await pandas.addName({
      pandaId: panda.pandaId,
      languageTag: "en",
      nameKind: "alias",
      value: `Second Release Alias ${suffix}`,
      sourceIds: [sourceId],
    });

    const stillFirst = await app.inject({ method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(stillFirst.statusCode).toBe(200);
    expect(JSON.stringify(stillFirst.json())).not.toContain("Second Release Alias");
    expect(JSON.stringify(stillFirst.json())).not.toContain("Second-release public summary");

    const second = await publication.build(`publication-${suffix}-2`, context);
    const secondSeal = await publication.seal(second.releaseId, context, "Seal the second integration release");
    expectOkRelease(secondSeal);
    const secondActivation = await publication.activate(second.releaseId, context, "Activate the second integration release");
    expect(secondActivation.kind).toBe("ok");

    const secondRead = await app.inject({ method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(secondRead.statusCode).toBe(200);
    expect(secondRead.json<PublicPandaDetail>().release.releaseId).toBe(second.releaseId);
    expect(JSON.stringify(secondRead.json())).toContain("Second Release Alias");
    expect(JSON.stringify(secondRead.json())).toContain("Second-release public summary");

    await publication.setResourceTakedown("panda", panda.pandaId, true, context, "Emergency panda takedown");
    const takenDown = await app.inject({ method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(takenDown.statusCode).toBe(404);

    const rollback = await publication.rollback(first.releaseId, context, "Roll back to the first compatible release");
    expect(rollback.kind).toBe("ok");
    const stillTakenDownAfterRollback = await app.inject({ method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(stillTakenDownAfterRollback.statusCode).toBe(404);

    await publication.setResourceTakedown("panda", panda.pandaId, false, context, "Restore panda delivery");
    const restoredPanda = await app.inject({ method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(restoredPanda.statusCode).toBe(200);
    expect(restoredPanda.json<PublicPandaDetail>().release.releaseId).toBe(first.releaseId);
    expect(JSON.stringify(restoredPanda.json())).not.toContain("Second Release Alias");

    const suspended = await publication.setReleaseSuspension(first.releaseId, true, context, "Emergency release suspension");
    expect(suspended.kind).toBe("ok");
    const unavailable = await app.inject({ method: "GET", url: "/api/v2/release" });
    expect(unavailable.statusCode).toBe(503);
    const restored = await publication.setReleaseSuspension(first.releaseId, false, context, "Restore release delivery");
    expect(restored.kind).toBe("ok");
    const availableAgain = await app.inject({ method: "GET", url: "/api/v2/release" });
    expect(availableAgain.statusCode).toBe(200);
    expect(availableAgain.json<PublicReadRelease>().releaseId).toBe(first.releaseId);

    const outbox = await database.db
      .selectFrom("integration.outbox_events")
      .select(["event_type", "aggregate_id"])
      .where("source_context", "=", "publication")
      .where("correlation_id", "=", context.correlationId)
      .orderBy("occurred_at")
      .execute();
    expect(outbox.map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "publication.release.activated",
        "publication.release.rolled_back",
        "publication.resource.taken_down",
        "publication.resource.restored",
        "publication.release.suspended",
        "publication.release.restored",
      ]),
    );
  });
});
