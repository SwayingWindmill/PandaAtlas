import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { LIFE_HISTORY_PORT, type LifeHistoryPort } from "../../src/modules/life-history/application/life-history.application.js";
import { LINEAGE_PORT, type LineagePort } from "../../src/modules/lineage/application/lineage.application.js";
import { MEDIA_PORT, type MediaPort } from "../../src/modules/media/application/media.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { PLACES_PORT, type PlacesPort } from "../../src/modules/places/application/places.application.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let app: NestFastifyApplication;
let evidence: EvidencePort;
let pandas: PandaPort;
let places: PlacesPort;
let lifeHistory: LifeHistoryPort;
let lineage: LineagePort;
let media: MediaPort;

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;

  app = await createApplication();
  evidence = app.get(EVIDENCE_PORT);
  pandas = app.get(PANDA_PORT);
  places = app.get(PLACES_PORT);
  lifeHistory = app.get(LIFE_HISTORY_PORT);
  lineage = app.get(LINEAGE_PORT);
  media = app.get(MEDIA_PORT);
});

afterAll(async () => {
  await app.close();
});

describe("V2 core panda knowledge against local PostgreSQL/PostGIS", () => {
  it("persists one authoritative panda-world journey with provenance and domain invariants", async () => {
    const suffix = randomUUID();
    const sourceId = `integration:${suffix}`;
    await evidence.createSource({
      sourceId,
      publisher: "Integration Test Archive",
      title: "Authoritative panda-world fixture",
      url: `https://example.test/sources/${suffix}`,
      publishedOn: "2026-08-26",
      lastVerifiedOn: "2026-08-26",
      languageTag: "en",
      accessState: "accessible",
      evidenceTier: "institutional",
      publicSummary: "Integration-only source metadata.",
    });
    const attachment = await evidence.addAttachment({
      sourceId,
      storageBucket: "evidence-private",
      storageKey: `integration/${suffix}.html`,
      objectVersion: "v1",
      contentSha256: "d".repeat(64),
      byteSize: 512,
      mediaType: "text/html",
    });
    expect(attachment.sourceId).toBe(sourceId);
    const reverifiedSource = await evidence.updateVerification({
      sourceId,
      lastVerifiedOn: "2026-08-27",
      accessState: "accessible",
      publicSummary: "Reverified integration source.",
    });
    expect(reverifiedSource.publicSummary).toBe("Reverified integration source.");

    const father = await pandas.createPanda({
      canonicalSlug: `father-${suffix}`,
      primaryName: { languageTag: "en", value: `Father ${suffix}`, sourceIds: [sourceId] },
    });
    const child = await pandas.createPanda({
      canonicalSlug: `child-${suffix}`,
      primaryName: { languageTag: "zh-CN", value: `幼崽${suffix}`, sourceIds: [sourceId] },
    });
    const sibling = await pandas.createPanda({
      canonicalSlug: `sibling-${suffix}`,
      primaryName: { languageTag: "en", value: `Sibling ${suffix}`, sourceIds: [sourceId] },
    });
    const tentativeParent = await pandas.createPanda({
      canonicalSlug: `tentative-parent-${suffix}`,
      primaryName: { languageTag: "en", value: `Tentative ${suffix}`, sourceIds: [sourceId] },
    });

    await pandas.addName({
      pandaId: child.pandaId,
      languageTag: "en",
      nameKind: "alias",
      value: `Cub ${suffix}`,
      sourceIds: [sourceId],
    });
    await pandas.addExternalIdentifier({
      pandaId: child.pandaId,
      system: "integration-registry",
      value: `REG-${suffix}`,
      sourceIds: [sourceId],
    });
    const renamedSlug = `child-renamed-${suffix}`;
    await pandas.changeCanonicalSlug(child.pandaId, renamedSlug, "2026-08-26");

    const assertionId = `fact:${suffix}`;
    await pandas.recordFactAssertion({
      assertionId,
      pandaId: child.pandaId,
      fieldKey: "birth.date",
      value: "2026-08-26",
      certainty: "confirmed",
      lastVerifiedOn: "2026-08-26",
      sourceIds: [sourceId],
    });
    await pandas.setFactConclusion({
      pandaId: child.pandaId,
      fieldKey: "birth.date",
      value: "2026-08-26",
      status: "confirmed",
      lastVerifiedOn: "2026-08-26",
      assertionIds: [assertionId],
    });
    const reloadedChild = await pandas.getPanda(child.canonicalSlug);
    expect(reloadedChild).toMatchObject({
      pandaId: child.pandaId,
      canonicalSlug: renamedSlug,
      legacySlugs: [child.canonicalSlug],
      conclusions: [{ fieldKey: "birth.date", value: "2026-08-26", status: "confirmed" }],
    });
    expect(reloadedChild?.names).toContainEqual(
      expect.objectContaining({ nameKind: "alias", value: `Cub ${suffix}`, sourceIds: [sourceId] }),
    );
    expect(reloadedChild?.externalIdentifiers).toContainEqual({
      system: "integration-registry",
      value: `REG-${suffix}`,
      sourceIds: [sourceId],
    });

    const institution = await places.createInstitution({
      slug: `institution-${suffix}`,
      nameEn: "Integration Panda Center",
      countryCode: "CN",
    });
    const place = await places.createPlace({
      institutionId: institution.institutionId,
      slug: `facility-${suffix}`,
      placeType: "facility",
      nameEn: "Integration Panda Base",
      countryCode: "CN",
      region: "Sichuan",
      center: { longitude: 104.0665, latitude: 30.5728 },
    });
    expect(place.center?.longitude).toBeCloseTo(104.0665, 4);
    expect(place.center?.latitude).toBeCloseTo(30.5728, 4);
    const revisedPlace = await places.replacePlace(place.placeId, {
      institutionId: institution.institutionId,
      slug: `facility-${suffix}`,
      placeType: "facility",
      nameEn: "Integration Panda Base",
      countryCode: "CN",
      region: "Sichuan Province",
      center: { longitude: 104.0665, latitude: 30.5728 },
    });
    expect(revisedPlace.region).toBe("Sichuan Province");

    await lifeHistory.createResidency({
      residencyId: `residency:${suffix}`,
      pandaId: child.pandaId,
      placeId: place.placeId,
      residencyType: "primary",
      startOn: "2026-01-01",
      startPrecision: "day",
      status: "confirmed",
      sourceIds: [sourceId],
    });
    await expect(
      lifeHistory.createResidency({
        residencyId: `overlap:${suffix}`,
        pandaId: child.pandaId,
        placeId: place.placeId,
        residencyType: "primary",
        startOn: "2026-06-01",
        startPrecision: "day",
        status: "confirmed",
        sourceIds: [sourceId],
      }),
    ).rejects.toThrow();
    await lifeHistory.closeResidency(`residency:${suffix}`, "2026-05-31", "day");

    await lifeHistory.createEvent({
      eventId: `event:${suffix}`,
      eventType: "naming",
      eventStatus: "announced",
      occurredPrecision: "unknown",
      participantIds: [child.pandaId],
      sourceIds: [sourceId],
      summary: "Naming date intentionally unknown.",
    });
    await lifeHistory.setEventStatus(`event:${suffix}`, "completed");
    const history = await lifeHistory.getForPanda(child.pandaId);
    expect(history.residencies).toHaveLength(1);
    expect(history.residencies[0]?.endOn).toBe("2026-05-31");
    expect(history.events[0]).toMatchObject({
      eventType: "naming",
      eventStatus: "completed",
      occurredPrecision: "unknown",
    });
    expect(history.events[0]?.occurredOn).toBeUndefined();

    await lineage.createAssertion({
      assertionId: `father:${suffix}`,
      childId: child.pandaId,
      parentId: father.pandaId,
      parentRole: "father",
      status: "confirmed",
      sourceIds: [sourceId],
    });
    await lineage.createAssertion({
      assertionId: `sibling-father:${suffix}`,
      childId: sibling.pandaId,
      parentId: father.pandaId,
      parentRole: "father",
      status: "confirmed",
      sourceIds: [sourceId],
    });
    await lineage.createAssertion({
      assertionId: `tentative:${suffix}`,
      childId: child.pandaId,
      parentId: tentativeParent.pandaId,
      parentRole: "mother",
      status: "tentative",
      sourceIds: [sourceId],
    });
    await expect(
      lineage.createAssertion({
        assertionId: `duplicate-confirmed-father:${suffix}`,
        childId: child.pandaId,
        parentId: tentativeParent.pandaId,
        parentRole: "father",
        status: "confirmed",
        sourceIds: [sourceId],
      }),
    ).rejects.toThrow();
    const family = await lineage.getFamily(child.pandaId);
    expect(family.parentIds).toEqual([father.pandaId]);
    expect(family.siblingIds).toEqual([sibling.pandaId]);
    expect(family.assertions.some((assertion) => assertion.status === "tentative")).toBe(true);
    await lineage.setAssertionStatus(`tentative:${suffix}`, "disputed", "2026-08-27T00:00:00Z");
    const reviewedFamily = await lineage.getFamily(child.pandaId);
    expect(reviewedFamily.assertions.some((assertion) => assertion.status === "disputed")).toBe(true);

    expect(() =>
      media.createAsset({
        storageBucket: "panda-media",
        storageKey: `invalid/${suffix}.jpg`,
        contentSha256: "a".repeat(64),
        mediaType: "image/jpeg",
        byteSize: 100,
        rightsStatus: "unknown",
        eligibilityStatus: "eligible",
        metadata: {},
      }),
    ).toThrow("Only rights-cleared media may be marked eligible");

    const asset = await media.createAsset({
      sourceId,
      storageBucket: "panda-media",
      storageKey: `reviewed/${suffix}.jpg`,
      contentSha256: "b".repeat(64),
      mediaType: "image/jpeg",
      byteSize: 1024,
      creator: "Integration Photographer",
      license: "CC-BY-4.0",
      attributionText: "Integration Photographer / CC BY 4.0",
      rightsStatus: "cleared",
      eligibilityStatus: "pending",
      metadata: { purpose: "integration" },
    });
    const reviewedAsset = await media.setReviewState(asset.assetId, "cleared", "eligible");
    expect(reviewedAsset.eligibilityStatus).toBe("eligible");
    await media.attachToPanda(child.pandaId, asset.assetId, "cover", 0);
    await expect(
      media.createAsset({
        sourceId,
        storageBucket: "panda-media",
        storageKey: `reviewed/${suffix}.jpg`,
        contentSha256: "c".repeat(64),
        mediaType: "image/jpeg",
        byteSize: 2048,
        rightsStatus: "cleared",
        eligibilityStatus: "eligible",
        metadata: {},
      }),
    ).rejects.toThrow();
  });
});
