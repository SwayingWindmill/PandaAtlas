import { Kysely, PostgresDialect } from "kysely";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { writeContent } from "../../src/content-command.js";
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
});
