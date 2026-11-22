import { Kysely, PostgresDialect, sql } from "kysely";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { writeContent } from "../../src/content-command.js";
import { generateGuessQuestions } from "../../src/modules/game/application/guess-question-generation.js";
import { recordFactAssertion, setCurrentFactConclusion } from "../../src/modules/panda/infrastructure/panda-fact-writes.js";
import type { Database } from "../../src/platform/database/database.types.js";
import { DATABASE_URL } from "./api-source.js";

const database = new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: DATABASE_URL }) }) });
const institutions = JSON.parse(
  readFileSync(new URL("../../../../data/curation/institutions/institutions.json", import.meta.url), "utf8"),
) as {
  institutions: Array<{
    slug: string;
    nameZh?: string;
    nameEn?: string;
    places?: Array<{ slug: string; nameZh?: string; nameEn?: string; longitude?: number; latitude?: number }>;
  }>;
};

class Rollback extends Error {}

afterAll(async () => {
  await database.destroy();
});

describe("curation.content", () => {
  it("writes venue news once, repeats as a no-op, and refuses changed content under the same version", async () => {
    await expect(
      database.transaction().execute(async (trx) => {
        const file = { version: "2099.12.31.1", items: [] };
        expect(await writeContent(trx, "venue-news", file)).toMatchObject({ outcome: "written", counts: { published: 0 } });
        expect(await writeContent(trx, "venue-news", file)).toMatchObject({ outcome: "already current" });
        await expect(writeContent(trx, "venue-news", { ...file, note: "x" })).rejects.toThrow(/new version/);
        await expect(writeContent(trx, "overseas-status", { version: "v", items: [{ pandaSlug: "x" }] })).rejects.toThrow();
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it("upserts the curated institutions and their named facility places idempotently without touching non-facilities", async () => {
    await expect(
      database.transaction().execute(async (trx) => {
        const nonFacilitySlug = "coarse-collision-test";
        await trx
          .insertInto("place.places")
          .values({
            slug: nonFacilitySlug,
            place_type: "coarse_location",
            name_en: "Protected Non-Facility",
          })
          .execute();

        const report = await writeContent(trx, "institutions", institutions);
        expect(report.counts.institutions).toBe(institutions.institutions.length);
        const slugs = institutions.institutions.map((institution) => institution.slug);
        const storedInstitutions = await trx
          .selectFrom("place.institutions")
          .select(["slug", "institution_id"])
          .where("slug", "in", slugs)
          .execute();
        expect(storedInstitutions).toHaveLength(slugs.length);
        const instBySlug = new Map(storedInstitutions.map((row) => [row.slug, row.institution_id]));

        const namedPlaces = institutions.institutions.flatMap((institution) =>
          (institution.places ?? [])
            .filter(
              (place) =>
                Boolean(place.nameZh?.trim() || place.nameEn?.trim()) ||
                (place.slug === institution.slug && Boolean(institution.nameZh?.trim() || institution.nameEn?.trim())),
            )
            .map((place) => ({ ...place, institutionSlug: institution.slug })),
        );
        const placeSlugs = namedPlaces.map((place) => place.slug);
        const storedPlaces = await trx
          .selectFrom("place.places")
          .select(["slug", "place_type", "institution_id", "center"])
          .where("slug", "in", placeSlugs)
          .execute();
        expect(storedPlaces).toHaveLength(placeSlugs.length);
        const storedBySlug = new Map(storedPlaces.map((row) => [row.slug, row]));
        for (const place of namedPlaces) {
          const row = storedBySlug.get(place.slug);
          expect(row?.place_type).toBe("facility");
          expect(row?.institution_id).toBe(instBySlug.get(place.institutionSlug));
          if (typeof place.longitude === "number" && typeof place.latitude === "number") {
            expect(row?.center).not.toBeNull();
          }
        }

        const repeat = await writeContent(trx, "institutions", institutions);
        expect(repeat.counts.institutions).toBe(institutions.institutions.length);
        expect(repeat.counts.places).toBe(report.counts.places);

        const collision = await writeContent(trx, "institutions", {
          institutions: [
            {
              slug: nonFacilitySlug,
              nameEn: "Protected Non-Facility",
              countryCode: "CN",
              profile: {
                kind: "zoo",
                verifiedOn: "2026-11-22",
                sourceUrls: ["https://example.com/non-facility"],
              },
              places: [{ slug: nonFacilitySlug, nameEn: "Should Not Overwrite" }],
            },
          ],
        });
        expect(collision.counts.places).toBe(0);
        const unchanged = await trx
          .selectFrom("place.places")
          .select(["place_type", "institution_id"])
          .where("slug", "=", nonFacilitySlug)
          .executeTakeFirstOrThrow();
        expect(unchanged.place_type).toBe("coarse_location");
        expect(unchanged.institution_id).toBeNull();
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it("applies panda enrichment idempotently, resolves conflicts, and enables hard guess questions", async () => {
    await expect(
      database.transaction().execute(async (trx) => {
        const asDay = (value: string | Date | null): string | null => {
          if (value === null) return null;
          return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
        };

        const oldPlace = await trx
          .insertInto("place.places")
          .values({
            slug: "enrich-zoo-old",
            place_type: "facility",
            name_zh: "旧测试馆",
            name_en: "Old Test Zoo",
          })
          .returning("place_id")
          .executeTakeFirstOrThrow();
        const newPlace = await trx
          .insertInto("place.places")
          .values({
            slug: "enrich-zoo-new",
            place_type: "facility",
            name_zh: "富集新馆",
            name_en: "New Enriched Zoo",
          })
          .returning("place_id")
          .executeTakeFirstOrThrow();

        const seedSourceId = "src:enrich-seed:initial";
        await trx
          .insertInto("evidence.sources")
          .values({
            source_id: seedSourceId,
            publisher: "Seed Fixture",
            title: "Initial seed record",
            url: "https://example.org/seed",
            last_verified_on: "2026-11-22",
            language_tag: "en",
            access_state: "accessible",
          })
          .execute();

        const pandaSpecs = [
          { slug: "enrich-p1", nameZh: "测试一" },
          { slug: "enrich-p2", nameZh: "测试二" },
          { slug: "enrich-p3", nameZh: "测试三" },
          { slug: "enrich-p4", nameZh: "测试四" },
          { slug: "enrich-mom-old", nameZh: "旧母" },
          { slug: "enrich-mom-new", nameZh: "新母" },
          { slug: "enrich-dad", nameZh: "新父" },
        ] as const;

        const pandaIds = new Map<string, string>();
        for (const spec of pandaSpecs) {
          const inserted = await sql<{ panda_id: string }>`
            insert into panda.pandas default values returning panda_id
          `.execute(trx);
          const pandaId = inserted.rows[0]!.panda_id;
          pandaIds.set(spec.slug, pandaId);
          await trx
            .insertInto("panda.slugs")
            .values({ panda_id: pandaId, slug: spec.slug, slug_kind: "canonical" })
            .execute();
          await trx
            .insertInto("panda.names")
            .values({
              panda_id: pandaId,
              language_tag: "zh-Hans",
              name_kind: "official",
              value: spec.nameZh,
              normalized_value: spec.nameZh,
              is_primary: true,
            })
            .execute();
        }

        const p1Id = pandaIds.get("enrich-p1")!;
        for (const [fieldKey, value] of [
          ["birth_date", "2026-06-03"],
          ["sex", "male"],
        ] as const) {
          const assertionId = `pa:seed:p1:${fieldKey}`;
          await recordFactAssertion(trx, {
            assertionId,
            pandaId: p1Id,
            fieldKey,
            value,
            certainty: "confirmed",
            lastVerifiedOn: "2026-11-20",
            sourceIds: [seedSourceId],
          });
          await setCurrentFactConclusion(trx, {
            pandaId: p1Id,
            fieldKey,
            value,
            status: "confirmed",
            lastVerifiedOn: "2026-11-20",
            assertionIds: [assertionId],
          });
        }

        await trx
          .insertInto("life_history.residencies")
          .values([
            {
              residency_id: "res:seed:p1:closed-overlap",
              panda_id: p1Id,
              place_id: oldPlace.place_id,
              residency_type: "primary",
              start_on: "2022-01-01",
              start_precision: "day",
              end_on: "2024-01-01",
              end_precision: "day",
              status: "confirmed",
            },
            {
              residency_id: "res:seed:p1:open-newer",
              panda_id: p1Id,
              place_id: oldPlace.place_id,
              residency_type: "primary",
              start_on: "2025-01-01",
              start_precision: "day",
              end_on: null,
              end_precision: null,
              status: "confirmed",
            },
          ])
          .execute();
        await trx
          .insertInto("life_history.residency_sources")
          .values([
            { residency_id: "res:seed:p1:closed-overlap", source_id: seedSourceId },
            { residency_id: "res:seed:p1:open-newer", source_id: seedSourceId },
          ])
          .execute();

        const oldMotherAssertionId = "lin:seed:p1:mother:old";
        await trx
          .insertInto("lineage.parentage_assertions")
          .values({
            assertion_id: oldMotherAssertionId,
            child_id: p1Id,
            parent_id: pandaIds.get("enrich-mom-old")!,
            parent_role: "mother",
            status: "confirmed",
          })
          .execute();
        await trx
          .insertInto("lineage.parentage_assertion_sources")
          .values({ assertion_id: oldMotherAssertionId, source_id: seedSourceId })
          .execute();

        const enrichmentDocument = {
          version: "2026.11.22.1",
          updatedAt: "2026-11-22T18:00:00+08:00",
          sources: [
            {
              key: "official-zoo-notice",
              publisher: "Official Test Zoo",
              title: "Confirmed Resident List",
              url: "https://example.org/official-residents",
              lastVerifiedOn: "2026-11-22",
              languageTag: "zh-CN",
              accessState: "accessible",
              evidenceTier: "primary",
            },
          ],
          items: [
            {
              pandaSlug: "enrich-p1",
              facts: [
                {
                  fieldKey: "birth_date",
                  value: "2012-07-28",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
                {
                  fieldKey: "sex",
                  value: "female",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
                {
                  fieldKey: "life_status",
                  value: "alive",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
              ],
              currentResidency: {
                placeSlug: "enrich-zoo-new",
                startOn: "2023-07-07",
                startPrecision: "day",
                status: "confirmed",
                lastVerifiedOn: "2026-11-22",
                sourceKeys: ["official-zoo-notice"],
              },
              lineage: {
                mother: {
                  parentSlug: "enrich-mom-new",
                  status: "confirmed",
                  reviewedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
                father: {
                  parentSlug: "enrich-dad",
                  status: "confirmed",
                  reviewedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
              },
            },
            {
              pandaSlug: "enrich-p2",
              facts: [
                {
                  fieldKey: "birth_date",
                  value: "2013-07-13",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
                {
                  fieldKey: "life_status",
                  value: "alive",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
              ],
              currentResidency: {
                placeSlug: "enrich-zoo-new",
                startOn: "2023-07-07",
                startPrecision: "day",
                status: "confirmed",
                sourceKeys: ["official-zoo-notice"],
              },
            },
            {
              pandaSlug: "enrich-p3",
              facts: [
                {
                  fieldKey: "birth_date",
                  value: "2023-07-07",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
                {
                  fieldKey: "life_status",
                  value: "alive",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
              ],
              currentResidency: {
                placeSlug: "enrich-zoo-new",
                startOn: "2023-07-07",
                startPrecision: "day",
                status: "confirmed",
                sourceKeys: ["official-zoo-notice"],
              },
            },
            {
              pandaSlug: "enrich-p4",
              facts: [
                {
                  fieldKey: "birth_date",
                  value: "2026-06-03",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
                {
                  fieldKey: "life_status",
                  value: "alive",
                  certainty: "confirmed",
                  lastVerifiedOn: "2026-11-22",
                  sourceKeys: ["official-zoo-notice"],
                },
              ],
              currentResidency: {
                placeSlug: "enrich-zoo-new",
                startOn: "2026-06-03",
                startPrecision: "day",
                status: "confirmed",
                sourceKeys: ["official-zoo-notice"],
              },
            },
          ],
        };

        const firstRun = await writeContent(trx, "panda-enrichment", enrichmentDocument);
        expect(firstRun.outcome).toBe("written");
        expect(firstRun.counts.factsWritten).toBe(13);
        expect(firstRun.counts.residenciesWritten).toBe(4);
        expect(firstRun.counts.lineageWritten).toBe(2);

        const p1Conclusions = await trx
          .selectFrom("panda.fact_conclusions")
          .select(["field_key", "value_json", "status", "superseded_values_json"])
          .where("panda_id", "=", p1Id)
          .where("is_current", "=", true)
          .execute();
        const conclusionMap = new Map(p1Conclusions.map((row) => [row.field_key, row]));
        expect(conclusionMap.get("birth_date")?.value_json).toBe("2012-07-28");
        expect(conclusionMap.get("birth_date")?.superseded_values_json).toContain("2026-06-03");
        expect(conclusionMap.get("sex")?.value_json).toBe("female");
        expect(conclusionMap.get("sex")?.superseded_values_json).toContain("male");
        expect(conclusionMap.get("birth_date_precision")?.value_json).toBe("day");

        const seedAssertions = await trx
          .selectFrom("panda.fact_assertions")
          .select(["assertion_id", "lifecycle_state"])
          .where("assertion_id", "in", ["pa:seed:p1:birth_date", "pa:seed:p1:sex"])
          .execute();
        expect(seedAssertions.every((row) => row.lifecycle_state === "superseded")).toBe(true);

        const p1Residencies = await trx
          .selectFrom("life_history.residencies")
          .select(["residency_id", "place_id", "start_on", "end_on"])
          .where("panda_id", "=", p1Id)
          .where("residency_type", "=", "primary")
          .execute();
        const openResidencies = p1Residencies.filter((row) => row.end_on === null);
        expect(openResidencies).toHaveLength(1);
        expect(openResidencies[0]?.place_id).toBe(newPlace.place_id);
        expect(asDay(openResidencies[0]?.start_on ?? null)).toBe("2023-07-07");
        const clampedClosed = p1Residencies.find((row) => row.residency_id === "res:seed:p1:closed-overlap");
        expect(asDay(clampedClosed?.end_on ?? null)).toBe("2023-07-07");
        const closedNewer = p1Residencies.find((row) => row.residency_id === "res:seed:p1:open-newer");
        expect(asDay(closedNewer?.end_on ?? null)).toBe("2025-01-01");

        const p1Lineage = await trx
          .selectFrom("lineage.parentage_assertions")
          .select(["assertion_id", "parent_role", "parent_id", "status"])
          .where("child_id", "=", p1Id)
          .execute();
        expect(p1Lineage.find((row) => row.assertion_id === oldMotherAssertionId)?.status).toBe("superseded");
        expect(
          p1Lineage.find((row) => row.parent_role === "mother" && row.status === "confirmed")?.parent_id,
        ).toBe(pandaIds.get("enrich-mom-new"));
        expect(
          p1Lineage.find((row) => row.parent_role === "father" && row.status === "confirmed")?.parent_id,
        ).toBe(pandaIds.get("enrich-dad"));

        const secondRun = await writeContent(trx, "panda-enrichment", enrichmentDocument);
        expect(secondRun.outcome).toBe("already current");
        expect(secondRun.counts.factsWritten).toBe(0);
        expect(secondRun.counts.residenciesWritten).toBe(0);
        expect(secondRun.counts.lineageWritten).toBe(0);

        const enrichedIds = ["enrich-p1", "enrich-p2", "enrich-p3", "enrich-p4"].map((slug) => pandaIds.get(slug)!);
        const candidates = await trx
          .selectFrom("panda.pandas as panda")
          .innerJoin("panda.names as name", "name.panda_id", "panda.panda_id")
          .innerJoin("life_history.residencies as residency", "residency.panda_id", "panda.panda_id")
          .innerJoin("place.places as place", "place.place_id", "residency.place_id")
          .innerJoin("panda.fact_conclusions as life_status", (join) =>
            join
              .onRef("life_status.panda_id", "=", "panda.panda_id")
              .on("life_status.field_key", "=", "life_status")
              .on("life_status.is_current", "=", true),
          )
          .innerJoin("panda.fact_conclusions as birth_date", (join) =>
            join
              .onRef("birth_date.panda_id", "=", "panda.panda_id")
              .on("birth_date.field_key", "=", "birth_date")
              .on("birth_date.is_current", "=", true),
          )
          .select([
            "panda.panda_id",
            "name.value as name_zh",
            "life_status.value_json as life_status",
            "birth_date.value_json as birth_date",
            "place.place_id",
            "place.name_zh as place_name",
          ])
          .where("panda.panda_id", "in", enrichedIds)
          .where("residency.residency_type", "=", "primary")
          .where("residency.end_on", "is", null)
          .execute();
        const questions = generateGuessQuestions(
          candidates.map((row, index) => ({
            pandaId: row.panda_id,
            name: row.name_zh,
            living: row.life_status === "alive",
            birthYear: typeof row.birth_date === "string" ? Number.parseInt(row.birth_date.slice(0, 4), 10) : null,
            placeId: row.place_id,
            placeName: row.place_name,
            coverAssetId: `asset:enrich:${index}`,
          })),
        );
        expect(questions).toHaveLength(4);
        expect(questions.every((question) => question.difficulty === "hard")).toBe(true);
        expect(questions.some((question) => question.tips.some((tip) => tip.includes("富集新馆")))).toBe(true);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
