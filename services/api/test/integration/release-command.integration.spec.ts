import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { PLACES_PORT, type PlacesPort } from "../../src/modules/places/application/places.application.js";
import { publishRelease } from "../../src/modules/publication/application/release-command.js";
import type { ReleaseManifest } from "../../src/modules/publication/application/release-manifest.js";
import { createReleaseCommandContext } from "../../src/modules/publication/release-command.module.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let app: NestExpressApplication;
// The adapter's own module, booted the way release-command.js boots it.
let command: Awaited<ReturnType<typeof createReleaseCommandContext>>;

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;
  app = await createApplication();
  command = await createReleaseCommandContext();
});

afterAll(async () => {
  await command.app.close();
  await app.close();
});

describe("release.publish batch adapter", () => {
  it("builds and publishes in one run, repeats as a no-op, and rolls back by moving the pointer", async () => {
    const suffix = randomUUID();
    const evidence = app.get<EvidencePort>(EVIDENCE_PORT);
    const pandas = app.get<PandaPort>(PANDA_PORT);
    const places = app.get<PlacesPort>(PLACES_PORT);
    const { ports } = command;
    const context = { actor: { kind: "system" as const, systemKey: "release-batch-workflow" }, correlationId: randomUUID() };

    const sourceId = `release-command:${suffix}`;
    await evidence.createSource({
      sourceId,
      publisher: "Release Command Archive",
      title: "Release command source",
      url: `https://example.test/release-command/${suffix}`,
      publishedOn: "2026-10-26",
      lastVerifiedOn: "2026-10-26",
      languageTag: "en",
      accessState: "accessible",
      evidenceTier: "institutional",
      publicSummary: "Release command fixture.",
      contentSha256: "b".repeat(64),
    });
    await pandas.createPanda({
      canonicalSlug: `release-command-panda-${suffix}`,
      primaryName: { languageTag: "en", value: `Release Command Panda ${suffix}`, sourceIds: [sourceId] },
    });
    const institution = await places.createInstitution({
      slug: `release-command-institution-${suffix}`,
      nameEn: "Release Command Zoo",
      countryCode: "US",
      profile: { kind: "zoo", verifiedOn: "2026-10-26", sourceUrls: ["https://example.org/zoo"] },
    });
    await places.createPlace({
      institutionId: institution.institutionId,
      slug: `release-command-place-${suffix}`,
      placeType: "facility",
      nameEn: "Release Command Zoo",
      countryCode: "US",
    });

    // Versions are unique across the shared test database, so each run uses its own pair.
    const day = String(Date.now());
    const first: ReleaseManifest = { version: `2099.12.30.${day}`, action: "publish", reason: "First release from the batch adapter test." };
    const second: ReleaseManifest = { ...first, version: `2099.12.31.${day}`, reason: "Second release from the batch adapter test." };

    const published = await publishRelease(ports, first, context, "First release from the batch adapter test. Run: test.");
    expect(published.steps).toEqual(["built", "sealed", "activated"]);
    expect(published.inspection.release.isCurrent).toBe(true);
    expect(published.inspection.release.counts.institution).toBeGreaterThan(0);
    const republished = await publishRelease(ports, first, context, "First release from the batch adapter test. Run: test.");
    expect(republished.steps).toEqual(["already sealed", "already current"]);

    expect((await publishRelease(ports, second, context, "Second release from the batch adapter test.")).steps).toEqual(["built", "sealed", "activated"]);

    const rolledBack = await publishRelease(
      ports,
      { ...first, action: "rollback" },
      context,
      "Roll back to the first release in the batch adapter test.",
    );
    expect(rolledBack).toMatchObject({ releaseId: published.releaseId, steps: ["rolled back"] });
    expect(rolledBack.inspection.release.isCurrent).toBe(true);

    const transitions = await app.get(DatabaseService).db
      .selectFrom("publication.release_transitions")
      .select(["transition_type", "actor_account_id", "actor_system_key"])
      .where("release_id", "=", published.releaseId)
      .orderBy("occurred_at")
      .execute();
    expect(transitions.map((row) => row.transition_type)).toEqual(["built", "sealed", "activated", "rolled_back"]);
    expect(transitions.every((row) => row.actor_account_id === null && row.actor_system_key === "release-batch-workflow")).toBe(true);
  });
});
