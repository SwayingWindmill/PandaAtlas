import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApplication } from "../../src/bootstrap.js";
import { insertInChunks } from "../../src/modules/publication/infrastructure/postgres-publication.coordinator.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";

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

class RolledBack extends Error {}

describe("release builds past PostgreSQL's bind-parameter limit", () => {
  it("writes 7,000 evidence projections (77,000 parameters) in batches where one statement fails", async () => {
    const database = app.get(DatabaseService);

    // Everything happens in one transaction that is rolled back, as a failed build would be.
    const outcome = await database.db
      .transaction()
      .execute(async (transaction) => {
        const release = await transaction
          .insertInto("publication.releases")
          .values({ version: `bind-limit-${randomUUID()}`, created_by_system_key: "bind-limit-test" })
          .returning("release_id")
          .executeTakeFirstOrThrow();
        const evidence = Array.from({ length: 7_000 }, (_, index) => ({
          release_id: release.release_id,
          source_id: `bind-limit:${index}`,
          publisher: "Bind Limit Archive",
          title: `Source ${index}`,
          url: `https://example.test/bind-limit/${index}`,
          published_on: null,
          last_verified_on: "2026-10-26",
          language_tag: "en",
          access_state: "accessible",
          evidence_tier: null,
          public_summary: null,
        }));

        await sql`savepoint single_statement`.execute(transaction);
        const single = await transaction
          .insertInto("public_read.evidence_sources")
          .values(evidence)
          .execute()
          .then(() => "inserted", (error: unknown) => (error instanceof Error ? error.message : String(error)));
        await sql`rollback to savepoint single_statement`.execute(transaction);

        await insertInChunks(evidence, (chunk) => transaction.insertInto("public_read.evidence_sources").values(chunk).execute());
        const written = await transaction
          .selectFrom("public_read.evidence_sources")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("release_id", "=", release.release_id)
          .executeTakeFirstOrThrow();
        throw new RolledBack(JSON.stringify({ single, written: written.count }));
      })
      .catch((error: unknown) => {
        if (error instanceof RolledBack) return JSON.parse(error.message) as { single: string; written: number };
        throw error;
      });

    expect(outcome.single).toMatch(/bind message has \d+ parameter formats but 0 parameters/);
    expect(outcome.written).toBe(7_000);
  });
});
