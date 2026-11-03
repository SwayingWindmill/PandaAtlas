import type { NestExpressApplication } from "@nestjs/platform-express";
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
import { injectHttp } from "../inject-http.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

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
    const context = {
      actor: { kind: "account" as const, accountId: actorAccountId },
      correlationId: randomUUID(),
    };

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
    // `sex` is a listing fact; `birth.date` is a detail-only fact.
    const facts = [
      { pandaId: panda.pandaId, fieldKey: "birth.date", value: "2026-08-27" },
      { pandaId: panda.pandaId, fieldKey: "sex", value: "female" },
      { pandaId: father.pandaId, fieldKey: "birth.date", value: "2010-08-27" },
      { pandaId: father.pandaId, fieldKey: "sex", value: "male" },
    ];
    for (const [index, fact] of facts.entries()) {
      const assertionId = `publication-fact-${index}:${suffix}`;
      await pandas.recordFactAssertion({
        assertionId,
        ...fact,
        certainty: "confirmed",
        lastVerifiedOn: "2026-08-27",
        sourceIds: [sourceId],
      });
      await pandas.setFactConclusion({
        ...fact,
        status: "confirmed",
        lastVerifiedOn: "2026-08-27",
        assertionIds: [assertionId],
      });
    }

    const institution = await places.createInstitution({
      slug: `publication-institution-${suffix}`,
      nameEn: "Publication Integration Center",
      countryCode: "CN",
      profile: {
        kind: "breeding_center",
        summary: { en: "A base used by the publication integration test." },
        websiteUrl: "https://example.org/base",
        verifiedOn: "2026-10-23",
        sourceUrls: ["https://example.org/base"],
      },
    });
    const place = await places.createPlace({
      institutionId: institution.institutionId,
      slug: `publication-place-${suffix}`,
      placeType: "facility",
      nameEn: "Publication Integration Base",
      countryCode: "CN",
      region: "Sichuan",
      center: { longitude: 104.0665, latitude: 30.5728 },
      visitGuide: {
        openingHours: { en: "9 a.m. to 5 p.m." },
        tips: [{ topic: "best_time", text: { en: "Come early." } }],
        verifiedOn: "2026-10-23",
        sourceUrls: ["https://example.org/base/visit"],
      },
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
    // A video sharing the cover's position, and a later photo, must not become the cover.
    for (const [index, mediaType, displayOrder] of [[1, "video/mp4", 0], [2, "image/jpeg", 1]] as const) {
      const extra = await media.createAsset({
        sourceId,
        storageBucket: "PRIVATE-bucket",
        storageKey: `public/${suffix}-${index}`,
        objectVersion: "PRIVATE-object-version",
        storageEtag: "PRIVATE-etag",
        contentSha256: String(index).repeat(64),
        mediaType,
        byteSize: 2048,
        title: `Extra ${index}`,
        rightsStatus: "cleared",
        eligibilityStatus: "eligible",
        metadata: {},
      });
      await media.attachToPanda(panda.pandaId, extra.assetId, "gallery", displayOrder);
    }

    const first = await publication.build(`publication-${suffix}-1`, context);
    const firstSeal = await publication.seal(first.releaseId, context, "Seal the first integration release");
    expectOkRelease(firstSeal);
    expect(firstSeal.release.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    const firstActivation = await publication.activate(first.releaseId, context, "Activate the first integration release");
    expect(firstActivation.kind).toBe("ok");

    const firstRead = await injectHttp(app, { method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(firstRead.statusCode, firstRead.body).toBe(200);
    const firstBody = firstRead.json<PublicPandaDetail>();
    expect(firstBody.release.releaseId).toBe(first.releaseId);
    expect(firstBody.panda.pandaId).toBe(panda.pandaId);
    expect(firstBody.lineage).toContainEqual(expect.objectContaining({ parentId: father.pandaId }));
    expect(firstBody.relatives).toContainEqual(expect.objectContaining({ pandaId: father.pandaId }));
    expect(firstBody.relatives).not.toContainEqual(expect.objectContaining({ pandaId: panda.pandaId }));
    const factKeys = (item: { facts: Array<{ fieldKey: string }> }) => item.facts.map((fact) => fact.fieldKey).sort();
    expect(factKeys(firstBody.panda)).toEqual(["birth.date", "sex"]);
    expect(factKeys(firstBody.relatives.find((item) => item.pandaId === father.pandaId)!)).toEqual(["sex"]);
    const list = await injectHttp(app, { method: "GET", url: "/api/v2/pandas" });
    expect(list.statusCode, list.body).toBe(200);
    const listed = list.json<{ items: PublicPandaDetail["relatives"] }>().items;
    expect(listed.filter((item) => [panda.pandaId, father.pandaId].includes(item.pandaId)).map(factKeys)).toEqual([["sex"], ["sex"]]);
    const byId = await injectHttp(app, { method: "GET", url: `/api/v2/pandas/${panda.pandaId}` });
    expect(byId.statusCode, byId.body).toBe(200);
    expect(byId.json<PublicPandaDetail>().panda.canonicalSlug).toBe(panda.canonicalSlug);
    expect(firstBody.residencies).toContainEqual(expect.objectContaining({ placeId: place.placeId }));
    expect(firstBody.events).toContainEqual(expect.objectContaining({ eventType: "public_debut" }));
    expect(firstBody.media).toContainEqual(expect.objectContaining({ assetId: asset.assetId, objectKey: `public/${suffix}.jpg` }));
    expect(firstBody.evidence).toContainEqual(expect.objectContaining({ sourceId, publicSummary: "Initial public summary." }));
    const institutionRead = await injectHttp(app, { method: "GET", url: `/api/v2/institutions/${institution.slug}` });
    expect(institutionRead.statusCode, institutionRead.body).toBe(200);
    const institutionBody = institutionRead.json<{
      institution: { slug: string; profile?: { kind: string } };
      places: Array<{ placeId: string; visitGuide?: { openingHours?: { en?: string } } }>;
    }>();
    expect(institutionBody.institution.profile?.kind).toBe("breeding_center");
    expect(institutionBody.places.map((item) => item.placeId)).toEqual([place.placeId]);
    expect(institutionBody.places[0]?.visitGuide?.openingHours).toEqual({ en: "9 a.m. to 5 p.m." });
    const institutionList = await injectHttp(app, { method: "GET", url: "/api/v2/institutions" });
    expect(institutionList.statusCode, institutionList.body).toBe(200);
    expect(institutionList.json<{ items: Array<{ slug: string }> }>().items).toContainEqual(expect.objectContaining({ slug: institution.slug }));
    expect((await injectHttp(app, { method: "GET", url: `/api/v2/institutions/missing-${suffix}` })).statusCode).toBe(404);
    const coversUrl = (...ids: string[]) => `/api/v2/panda-covers?ids=${ids.join(",")}`;
    const covers = await injectHttp(app, { method: "GET", url: coversUrl(panda.pandaId, father.pandaId, randomUUID()) });
    expect(covers.statusCode, covers.body).toBe(200);
    expect(covers.json<{ items: unknown[] }>().items).toEqual([
      expect.objectContaining({ pandaId: panda.pandaId, assetId: asset.assetId, objectKey: `public/${suffix}.jpg`, license: "CC-BY-4.0" }),
    ]);
    expect(JSON.stringify(covers.json())).not.toContain("PRIVATE");
    for (const invalid of ["/api/v2/panda-covers", "/api/v2/panda-covers?ids=", "/api/v2/panda-covers?ids=not-a-uuid"]) {
      expect((await injectHttp(app, { method: "GET", url: invalid })).statusCode, invalid).toBe(400);
    }
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

    const stillFirst = await injectHttp(app, { method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(stillFirst.statusCode).toBe(200);
    expect(JSON.stringify(stillFirst.json())).not.toContain("Second Release Alias");
    expect(JSON.stringify(stillFirst.json())).not.toContain("Second-release public summary");

    const second = await publication.build(`publication-${suffix}-2`, context);
    const secondSeal = await publication.seal(second.releaseId, context, "Seal the second integration release");
    expectOkRelease(secondSeal);
    const secondActivation = await publication.activate(second.releaseId, context, "Activate the second integration release");
    expect(secondActivation.kind).toBe("ok");

    const secondRead = await injectHttp(app, { method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(secondRead.statusCode).toBe(200);
    expect(secondRead.json<PublicPandaDetail>().release.releaseId).toBe(second.releaseId);
    expect(JSON.stringify(secondRead.json())).toContain("Second Release Alias");
    expect(JSON.stringify(secondRead.json())).toContain("Second-release public summary");

    await publication.setResourceTakedown("panda", panda.pandaId, true, context, "Emergency panda takedown");
    const takenDown = await injectHttp(app, { method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(takenDown.statusCode).toBe(404);
    const takenDownCovers = await injectHttp(app, { method: "GET", url: coversUrl(panda.pandaId) });
    expect(takenDownCovers.json<{ items: unknown[] }>().items).toEqual([]);

    const rollback = await publication.rollback(first.releaseId, context, "Roll back to the first compatible release");
    expect(rollback.kind).toBe("ok");
    const stillTakenDownAfterRollback = await injectHttp(app, { method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(stillTakenDownAfterRollback.statusCode).toBe(404);

    await publication.setResourceTakedown("panda", panda.pandaId, false, context, "Restore panda delivery");
    const restoredPanda = await injectHttp(app, { method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(restoredPanda.statusCode).toBe(200);
    expect(restoredPanda.json<PublicPandaDetail>().release.releaseId).toBe(first.releaseId);
    expect(JSON.stringify(restoredPanda.json())).not.toContain("Second Release Alias");

    const suspended = await publication.setReleaseSuspension(first.releaseId, true, context, "Emergency release suspension");
    expect(suspended.kind).toBe("ok");
    const unavailable = await injectHttp(app, { method: "GET", url: "/api/v2/release" });
    expect(unavailable.statusCode).toBe(503);
    const restored = await publication.setReleaseSuspension(first.releaseId, false, context, "Restore release delivery");
    expect(restored.kind).toBe("ok");
    const availableAgain = await injectHttp(app, { method: "GET", url: "/api/v2/release" });
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

  it("merges a duplicate place so its residencies, check-ins and old slug all reach the surviving place", async () => {
    const suffix = randomUUID();
    const database = app.get(DatabaseService);
    const pandas = app.get<PandaPort>(PANDA_PORT);
    const places = app.get<PlacesPort>(PLACES_PORT);
    const lifeHistory = app.get<LifeHistoryPort>(LIFE_HISTORY_PORT);
    const publication = app.get<PublicationPort>(PUBLICATION_PORT);
    const accountId = randomUUID();
    const context = { actor: { kind: "account" as const, accountId }, correlationId: randomUUID() };
    await sql`
      insert into auth.users (id, aud, role, created_at, updated_at)
      values (${accountId}::uuid, 'authenticated', 'authenticated', now(), now())
    `.execute(database.db);
    await database.db.insertInto("identity.accounts").values({ account_id: accountId, email: null }).execute();

    const sourceId = `merge:${suffix}`;
    await app.get<EvidencePort>(EVIDENCE_PORT).createSource({
      sourceId,
      publisher: "Merge Integration Archive",
      title: "Merge source",
      url: `https://example.test/merge/${suffix}`,
      publishedOn: "2026-10-30",
      lastVerifiedOn: "2026-10-30",
      languageTag: "en",
      accessState: "accessible",
      evidenceTier: "institutional",
      publicSummary: "Merge summary.",
      contentSha256: "c".repeat(64),
    });
    const panda = await pandas.createPanda({
      canonicalSlug: `merge-panda-${suffix}`,
      primaryName: { languageTag: "en", value: `Merge Panda ${suffix}`, sourceIds: [sourceId] },
    });
    const survivor = await places.createPlace({ slug: `merge-kept-${suffix}`, placeType: "facility", nameEn: "Kept Base" });
    const duplicate = await places.createPlace({ slug: `merge-copy-${suffix}`, placeType: "facility", nameEn: "Copy Base" });
    await lifeHistory.createResidency({
      residencyId: `merge-residency:${suffix}`,
      pandaId: panda.pandaId,
      placeId: duplicate.placeId,
      residencyType: "primary",
      startOn: "2020-01-01",
      startPrecision: "day",
      status: "confirmed",
      sourceIds: [sourceId],
    });
    // The same visit recorded against both copies, and one against the copy alone.
    await sql`
      insert into engagement.location_checkins (account_id, place_id, visited_on) values
        (${accountId}::uuid, ${duplicate.placeId}, '2026-01-01'),
        (${accountId}::uuid, ${survivor.placeId}, '2026-01-01'),
        (${accountId}::uuid, ${duplicate.slug}, '2026-01-02')
    `.execute(database.db);

    await sql`select place.merge_place(${duplicate.slug}, ${survivor.slug})`.execute(database.db);
    // A content migration may run the same merge again.
    await sql`select place.merge_place(${duplicate.slug}, ${survivor.slug})`.execute(database.db);

    const checkins = await database.db
      .selectFrom("engagement.location_checkins")
      .select(["place_id", "visited_on"])
      .where("account_id", "=", accountId)
      .orderBy("visited_on")
      .execute();
    expect(checkins.map((row) => row.place_id)).toEqual([survivor.placeId, survivor.placeId]);
    const remaining = await database.db.selectFrom("place.places").select("slug").where("place_id", "=", duplicate.placeId).execute();
    expect(remaining).toEqual([]);

    const release = await publication.build(`merge-${suffix}`, context);
    expectOkRelease(await publication.seal(release.releaseId, context, "Seal the merge integration release"));
    expect((await publication.activate(release.releaseId, context, "Activate the merge integration release")).kind).toBe("ok");

    const byOldSlug = await injectHttp(app, { method: "GET", url: `/api/v2/places/${duplicate.slug}` });
    expect(byOldSlug.statusCode, byOldSlug.body).toBe(200);
    expect(byOldSlug.json<{ place: { slug: string; legacySlugs?: string[] } }>().place).toMatchObject({
      slug: survivor.slug,
      legacySlugs: [duplicate.slug],
    });
    const pandaRead = await injectHttp(app, { method: "GET", url: `/api/v2/pandas/${panda.canonicalSlug}` });
    expect(pandaRead.statusCode, pandaRead.body).toBe(200);
    expect(pandaRead.json<PublicPandaDetail>().residencies.map((item) => item.placeId)).toEqual([survivor.placeId]);
  });
});
