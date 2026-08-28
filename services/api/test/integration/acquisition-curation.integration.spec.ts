import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import {
  CURATION_INTAKE_PORT,
  CURATION_PORT,
  type CurationIntakePort,
  type CurationPort,
} from "../../src/modules/curation/application/curation.application.js";
import {
  EVIDENCE_PORT,
  type EvidencePort,
} from "../../src/modules/evidence/application/evidence.application.js";
import {
  LIFE_HISTORY_PORT,
  type LifeHistoryPort,
} from "../../src/modules/life-history/application/life-history.application.js";
import { LINEAGE_PORT, type LineagePort } from "../../src/modules/lineage/application/lineage.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { PLACES_PORT, type PlacesPort } from "../../src/modules/places/application/places.application.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let app: NestFastifyApplication;
let curationIntake: CurationIntakePort;
let curation: CurationPort;
let evidence: EvidencePort;
let pandas: PandaPort;
let places: PlacesPort;
let lineage: LineagePort;
let lifeHistory: LifeHistoryPort;
let database: DatabaseService;

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;

  app = await createApplication();
  curationIntake = app.get(CURATION_INTAKE_PORT);
  curation = app.get(CURATION_PORT);
  evidence = app.get(EVIDENCE_PORT);
  pandas = app.get(PANDA_PORT);
  places = app.get(PLACES_PORT);
  lineage = app.get(LINEAGE_PORT);
  lifeHistory = app.get(LIFE_HISTORY_PORT);
  database = app.get(DatabaseService);
});

afterAll(async () => {
  await app.close();
});

async function seedAccount(accountId: string): Promise<void> {
  await database.db
    .insertInto("identity.accounts")
    .values({ account_id: accountId, email: null })
    .onConflict((conflict) => conflict.column("account_id").doNothing())
    .execute();
}

async function seedPipelineArtifact(artifactId: string, suffix: string): Promise<void> {
  const jobId = randomUUID();
  const correlationId = randomUUID();
  const sha256 = "a".repeat(64);
  const storageKey = `panda-data/acquisition/${sha256}/${suffix}.json`;
  await sql`
    insert into pipeline.jobs (
      job_id,
      job_type,
      correlation_id,
      state,
      parameters,
      input_artifacts,
      requested_at,
      started_at,
      completed_at
    ) values (
      ${jobId}::uuid,
      'acquisition.run',
      ${correlationId}::uuid,
      'completed',
      '{}'::jsonb,
      '[]'::jsonb,
      now() - interval '2 seconds',
      now() - interval '1 second',
      now()
    )
  `.execute(database.db);
  await sql`
    insert into pipeline.artifacts (
      artifact_id,
      job_id,
      artifact_kind,
      storage_bucket,
      storage_key,
      content_sha256,
      byte_size,
      media_type,
      contract_schema_id,
      manifest,
      created_at
    ) values (
      ${artifactId}::uuid,
      ${jobId}::uuid,
      'acquisition.bundle',
      'panda-data-artifacts',
      ${storageKey},
      ${sha256},
      128,
      'application/json',
      'urn:zhipanda:panda-data:acquisition-bundle:v2',
      '{}'::jsonb,
      now()
    )
  `.execute(database.db);
}

describe("V2 acquisition-origin Curation routing", () => {
  it("applies one reviewed acquisition change set through Panda, Lineage, and LifeHistory owners", async () => {
    const suffix = randomUUID();
    const editorAccountId = randomUUID();
    const approverAccountId = randomUUID();
    await seedAccount(editorAccountId);
    await seedAccount(approverAccountId);

    const originalSourceId = `acquisition-original:${suffix}`;
    const acquiredSourceId = `acquisition-new:${suffix}`;
    for (const [sourceId, title] of [
      [originalSourceId, "Original Curation source"],
      [acquiredSourceId, "New acquisition source"],
    ] as const) {
      await evidence.createSource({
        sourceId,
        publisher: "Acquisition integration fixture",
        title,
        url: `https://example.test/${sourceId}`,
        publishedOn: "2026-08-28",
        lastVerifiedOn: "2026-08-28",
        languageTag: "en",
        accessState: "accessible",
        evidenceTier: "institutional",
      });
    }

    const parent = await pandas.createPanda({
      canonicalSlug: `acquisition-parent-${suffix}`,
      primaryName: {
        languageTag: "en",
        value: `Acquisition Parent ${suffix}`,
        sourceIds: [originalSourceId],
      },
    });
    const target = await pandas.createPanda({
      canonicalSlug: `acquisition-target-${suffix}`,
      primaryName: {
        languageTag: "en",
        value: `Acquisition Target ${suffix}`,
        sourceIds: [originalSourceId],
      },
    });
    await pandas.addName({
      pandaId: target.pandaId,
      languageTag: "en",
      nameKind: "alias",
      value: `Historic ${suffix}`,
      sourceIds: [originalSourceId],
    });
    await pandas.addExternalIdentifier({
      pandaId: target.pandaId,
      system: "integration-studbook",
      value: `SB-${suffix}`,
      sourceIds: [originalSourceId],
    });

    const sexAssertionId = `fixture-sex:${suffix}`;
    await pandas.recordFactAssertion({
      assertionId: sexAssertionId,
      pandaId: target.pandaId,
      fieldKey: "profile.sex",
      value: "male",
      certainty: "confirmed",
      lastVerifiedOn: "2026-08-27",
      sourceIds: [originalSourceId],
    });
    await pandas.setFactConclusion({
      pandaId: target.pandaId,
      fieldKey: "profile.sex",
      value: "male",
      status: "confirmed",
      lastVerifiedOn: "2026-08-27",
      assertionIds: [sexAssertionId],
    });

    const statusAssertionId = `fixture-status:${suffix}`;
    await pandas.recordFactAssertion({
      assertionId: statusAssertionId,
      pandaId: target.pandaId,
      fieldKey: "profile.life_status",
      value: "alive",
      certainty: "confirmed",
      lastVerifiedOn: "2026-08-27",
      sourceIds: [originalSourceId],
    });
    await pandas.setFactConclusion({
      pandaId: target.pandaId,
      fieldKey: "profile.life_status",
      value: "alive",
      status: "confirmed",
      lastVerifiedOn: "2026-08-27",
      assertionIds: [statusAssertionId],
    });

    const place = await places.createPlace({
      slug: `acquisition-place-${suffix}`,
      placeType: "facility",
      nameEn: `Acquisition Place ${suffix}`,
      countryCode: "CN",
    });
    const artifactId = randomUUID();
    await seedPipelineArtifact(artifactId, suffix);

    const input = {
      acquisitionBundleId: `bundle-${suffix}`,
      pipelineArtifactId: artifactId,
      targetPandaId: target.pandaId,
      recommendedByAccountId: editorAccountId,
      reason: "Promote reviewed breadth-first acquisition candidates into V2 owners.",
      changes: [
        {
          candidateId: `sex-corroboration-${suffix}`,
          ownerModule: "panda" as const,
          operation: "fact.corroborate" as const,
          payload: { fieldKey: "profile.sex", value: "male", certainty: "confirmed" },
          lastVerifiedOn: "2026-08-28",
          sourceIds: [acquiredSourceId],
        },
        {
          candidateId: `status-dispute-${suffix}`,
          ownerModule: "panda" as const,
          operation: "fact.dispute" as const,
          payload: { fieldKey: "profile.life_status", value: "deceased", certainty: "provisional" },
          lastVerifiedOn: "2026-08-28",
          sourceIds: [acquiredSourceId],
        },
        {
          candidateId: `name-corroboration-${suffix}`,
          ownerModule: "panda" as const,
          operation: "name.corroborate" as const,
          payload: {
            languageTag: "en",
            nameKind: "alias",
            value: `Historic ${suffix}`,
          },
          lastVerifiedOn: "2026-08-28",
          sourceIds: [acquiredSourceId],
        },
        {
          candidateId: `identifier-corroboration-${suffix}`,
          ownerModule: "panda" as const,
          operation: "external_identifier.corroborate" as const,
          payload: { system: "integration-studbook", value: `SB-${suffix}` },
          lastVerifiedOn: "2026-08-28",
          sourceIds: [acquiredSourceId],
        },
        {
          candidateId: `parentage-${suffix}`,
          ownerModule: "lineage" as const,
          operation: "parentage.create" as const,
          payload: { parentId: parent.pandaId, parentRole: "father", status: "confirmed" },
          lastVerifiedOn: "2026-08-28",
          sourceIds: [acquiredSourceId],
        },
        {
          candidateId: `residency-${suffix}`,
          ownerModule: "life_history" as const,
          operation: "residency.create" as const,
          payload: {
            placeId: place.placeId,
            residencyType: "primary",
            startOn: "2021-01-01",
            startPrecision: "year",
            status: "confirmed",
          },
          lastVerifiedOn: "2026-08-28",
          sourceIds: [acquiredSourceId],
        },
        {
          candidateId: `event-${suffix}`,
          ownerModule: "life_history" as const,
          operation: "event.create" as const,
          payload: {
            eventType: "arrival",
            eventStatus: "completed",
            occurredOn: "2024-05-01",
            occurredPrecision: "month",
            toPlaceId: place.placeId,
          },
          lastVerifiedOn: "2026-08-28",
          sourceIds: [acquiredSourceId],
        },
      ],
    };

    const created = await curationIntake.acceptAcquisitionRecommendation(input);
    const replayed = await curationIntake.acceptAcquisitionRecommendation(input);
    expect(replayed.changeSetId).toBe(created.changeSetId);
    expect(created).toMatchObject({
      originKind: "acquisition",
      acquisitionBundleId: input.acquisitionBundleId,
      pipelineArtifactId: artifactId,
      targetPandaId: target.pandaId,
      state: "draft",
    });
    expect(created.ownerChanges).toHaveLength(input.changes.length);
    expect(created.changes).toEqual([]);

    const validated = await curation.validate(created.changeSetId, editorAccountId);
    expect(validated.kind).toBe("validated");
    const approved = await curation.approveAndApply(
      created.changeSetId,
      approverAccountId,
      "Approve reviewed acquisition candidates after V2 owner validation.",
    );
    expect(approved.kind).toBe("applied");
    if (approved.kind !== "applied") throw new Error("Acquisition Curation was not applied");
    expect(approved.changeSet.ownerChanges.every((change) => change.appliedReference !== undefined)).toBe(true);

    const updated = await pandas.getPanda(target.pandaId);
    const sex = updated?.conclusions.find((conclusion) => conclusion.fieldKey === "profile.sex");
    expect(sex).toMatchObject({ value: "male", status: "confirmed", lastVerifiedOn: "2026-08-28" });
    expect(sex?.conclusionVersion).toBe(2);
    const lifeStatus = updated?.conclusions.find(
      (conclusion) => conclusion.fieldKey === "profile.life_status",
    );
    expect(lifeStatus).toMatchObject({ status: "disputed", lastVerifiedOn: "2026-08-28" });
    expect(lifeStatus?.value).toBeUndefined();
    expect(lifeStatus?.candidateValues).toEqual(expect.arrayContaining(["alive", "deceased"]));

    const corroboratedName = updated?.names.find(
      (name) => name.nameKind === "alias" && name.value === `Historic ${suffix}`,
    );
    expect(corroboratedName?.sourceIds).toEqual(
      expect.arrayContaining([originalSourceId, acquiredSourceId]),
    );
    const corroboratedIdentifier = updated?.externalIdentifiers.find(
      (identifier) => identifier.system === "integration-studbook",
    );
    expect(corroboratedIdentifier?.sourceIds).toEqual(
      expect.arrayContaining([originalSourceId, acquiredSourceId]),
    );

    const family = await lineage.getFamily(target.pandaId);
    expect(family.parentIds).toContain(parent.pandaId);
    expect(family.assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          childId: target.pandaId,
          parentId: parent.pandaId,
          parentRole: "father",
          status: "confirmed",
          sourceIds: [acquiredSourceId],
        }),
      ]),
    );

    const history = await lifeHistory.getForPanda(target.pandaId);
    expect(history.residencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placeId: place.placeId,
          startOn: "2021-01-01",
          startPrecision: "year",
        }),
      ]),
    );
    expect(history.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "arrival",
          eventStatus: "completed",
          occurredOn: "2024-05-01",
          occurredPrecision: "month",
          toPlaceId: place.placeId,
        }),
      ]),
    );
  });
});
