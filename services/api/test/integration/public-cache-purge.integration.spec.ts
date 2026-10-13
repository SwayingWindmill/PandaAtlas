import type { NestExpressApplication } from "@nestjs/platform-express";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { PublicCacheConsumerService } from "../../src/modules/publication/infrastructure/public-cache-consumer.service.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { IntegrationOutboxService } from "../../src/platform/integration/integration-outbox.service.js";
import { OutboxDispatcherService } from "../../src/platform/integration/outbox-dispatcher.service.js";

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

describe("public cache purge consumer", () => {
  it("purges once per batch of delivery changes, retries a failed purge and archives only after success", async () => {
    const database = app.get(DatabaseService);
    const outbox = app.get(IntegrationOutboxService);
    const dispatcher = app.get(OutboxDispatcherService);
    const consumer = app.get(PublicCacheConsumerService);

    const eventIds = await database.transaction(async (transaction) =>
      Promise.all(
        // Suspension events route only to this consumer and audit, so the synthetic events never reach
        // consumers that resolve real releases or resources.
        (["publication.release.suspended", "publication.release.restored"] as const).map((eventType) =>
          outbox.append(transaction, {
            eventType,
            sourceContext: "publication",
            aggregateType: "public_release",
            aggregateId: randomUUID(),
            idempotencyKey: `public-cache-purge:${randomUUID()}`,
            correlationId: randomUUID(),
            occurredAt: new Date(),
            payload: {},
          }),
        ),
      ),
    );
    await dispatcher.dispatchBatch(200);

    const queued = () =>
      sql<{ event_id: string }>`
        select message->>'eventId' as event_id from pgmq.q_integration_public_cache
        where message->>'eventId' in (${sql.join(eventIds)})
      `.execute(database.db).then((result) => result.rows.map((row) => row.event_id).sort());
    const receipts = () =>
      database.db
        .selectFrom("integration.consumer_receipts")
        .select("event_id")
        .where("consumer_key", "=", "publication.public-cache")
        .where("event_id", "in", eventIds)
        .execute();
    expect(await queued()).toEqual([...eventIds].sort());

    await expect(
      consumer.processBatch({ purge: () => Promise.reject(new Error("edge unavailable")) }, 100),
    ).rejects.toThrow("edge unavailable");
    expect(await queued()).toEqual([...eventIds].sort());
    expect(await receipts()).toEqual([]);

    // Expire the visibility timeout the failed attempt set, as the next scheduled cycle would see it.
    await sql`update pgmq.q_integration_public_cache set vt = now() where message->>'eventId' in (${sql.join(eventIds)})`
      .execute(database.db);
    let purges = 0;
    const result = await consumer.processBatch({ purge: () => { purges += 1; return Promise.resolve(); } }, 100);

    expect(purges).toBe(1);
    expect(result.purged).toBe(true);
    expect(result.received).toBeGreaterThanOrEqual(2);
    expect(await queued()).toEqual([]);
    expect((await receipts()).map((row) => row.event_id).sort()).toEqual([...eventIds].sort());
  });
});
