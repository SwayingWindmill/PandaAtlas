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
) as { institutions: { slug: string; places?: unknown[] }[] };

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

  it("upserts the curated institutions and updates their facility places", async () => {
    await expect(
      database.transaction().execute(async (trx) => {
        const report = await writeContent(trx, "institutions", institutions);
        expect(report.counts.institutions).toBe(institutions.institutions.length);
        const slugs = institutions.institutions.map((institution) => institution.slug);
        const stored = await trx.selectFrom("place.institutions").select("slug").where("slug", "in", slugs).execute();
        expect(stored).toHaveLength(slugs.length);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
