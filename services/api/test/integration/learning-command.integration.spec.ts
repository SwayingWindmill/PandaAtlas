import { Kysely, PostgresDialect } from "kysely";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { storedDocument, writeLearningCatalog } from "../../src/learning-command.js";
import type { Database } from "../../src/platform/database/database.types.js";
import { DATABASE_URL } from "./api-source.js";

const database = new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: DATABASE_URL }) }) });
const file = JSON.parse(readFileSync(new URL("../../../../data/curation/learning/learning.json", import.meta.url), "utf8")) as Record<string, unknown>;

class Rollback extends Error {}

afterAll(async () => {
  await database.destroy();
});

describe("curation.learning writes learning.catalog", () => {
  it("writes a new version once, repeats as a no-op, and refuses changed content under the same version", async () => {
    await expect(database.transaction().execute(async (trx) => {
      const first = storedDocument({ ...file, version: "2099.12.31.1" });
      expect(await writeLearningCatalog(trx, first.version, first.document)).toMatchObject({ outcome: "written" });
      expect(await writeLearningCatalog(trx, first.version, first.document)).toEqual({ outcome: "already current" });

      const changed = { ...first.document, terms: [] };
      await expect(writeLearningCatalog(trx, first.version, changed)).rejects.toThrow(/new version/);

      const row = await trx.selectFrom("learning.catalog").select("version").where("catalog_id", "=", 1).executeTakeFirstOrThrow();
      expect(row.version).toBe("2099.12.31.1");
      throw new Rollback();
    })).rejects.toBeInstanceOf(Rollback);
  });
});
