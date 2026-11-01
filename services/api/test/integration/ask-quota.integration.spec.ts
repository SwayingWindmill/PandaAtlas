import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { PostgresAskQuotaRepository } from "../../src/modules/ask/infrastructure/postgres-ask-quota.repository.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { DATABASE_URL } from "./api-source.js";

let app: NestExpressApplication;
let database: DatabaseService;

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;
  app = await createApplication();
  database = app.get(DatabaseService);
});

afterAll(async () => {
  await app.close();
});

async function account(): Promise<string> {
  const accountId = randomUUID();
  await database.db.insertInto("identity.accounts").values({ account_id: accountId, email: null }).execute();
  return accountId;
}

describe("Ask Panda quota", () => {
  it("counts each account to its limit and the app to its cap, and rolls back refused questions", async () => {
    const quota = new PostgresAskQuotaRepository(database);
    // A far-future day keeps this test independent of other runs and of today's real counter.
    const day = `2999-01-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`;
    await database.db.deleteFrom("ask.daily_usage").where("usage_on", "=", day).execute();
    const first = await account();
    const second = await account();

    expect(await quota.reserve(first, day, 2, 3)).toEqual({ ok: true, remainingToday: 1 });
    expect(await quota.reserve(first, day, 2, 3)).toEqual({ ok: true, remainingToday: 0 });
    expect(await quota.reserve(first, day, 2, 3)).toEqual({ ok: false, scope: "account" });
    expect(await quota.used(first, day)).toBe(2);

    // The refused third question did not use the app-wide count, so one question is left.
    expect(await quota.reserve(second, day, 2, 3)).toEqual({ ok: true, remainingToday: 1 });
    expect(await quota.reserve(second, day, 2, 3)).toEqual({ ok: false, scope: "global" });
    expect(await quota.reserve(second, day, 2, 0)).toEqual({ ok: false, scope: "global" });

    const global = await database.db.selectFrom("ask.daily_usage").select("question_count").where("usage_on", "=", day).executeTakeFirstOrThrow();
    expect(global.question_count).toBe(3);
    await database.db.deleteFrom("ask.daily_usage").where("usage_on", "=", day).execute();
  });
});
