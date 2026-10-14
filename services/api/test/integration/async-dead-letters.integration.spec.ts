import type { NestExpressApplication } from "@nestjs/platform-express";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { AsyncDownstreamHeartbeat } from "../../src/platform/integration/async-downstream-heartbeat.js";
import {
  IntegrationEventConsumer,
  type IntegrationEventConsumerDefinition,
} from "../../src/platform/integration/integration-event-consumer.js";
import { IntegrationOutboxService } from "../../src/platform/integration/integration-outbox.service.js";
import { PgmqService } from "../../src/platform/integration/pgmq.service.js";
import { injectHttp } from "../inject-http.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
// A queue of its own, so other suites' messages never reach these consumers.
const QUEUE = "integration_test_consumer";

let app: NestExpressApplication;
let database: DatabaseService;
let outbox: IntegrationOutboxService;
let pgmq: PgmqService;
let consumer: IntegrationEventConsumer;
const logs: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = [];

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;
  app = await createApplication();
  database = app.get(DatabaseService);
  outbox = app.get(IntegrationOutboxService);
  pgmq = app.get(PgmqService);
  consumer = new IntegrationEventConsumer(database, outbox, pgmq, {
    write: (level, message, fields) => logs.push({ level, message, fields }),
  });
  await sql`select pgmq.create(${QUEUE})`.execute(database.db);
});

afterAll(async () => {
  // Dead letters keep /health/async unhealthy; leave none behind for other suites.
  await database.db.deleteFrom("integration.dead_letters").where("queue_name", "=", QUEUE).execute();
  await sql`select pgmq.drop_queue(${QUEUE})`.execute(database.db);
  await app.close();
});

function definition(handle: IntegrationEventConsumerDefinition["handle"]): IntegrationEventConsumerDefinition {
  return { consumerKey: `integration-test.${randomUUID()}`, queue: QUEUE as never, handle };
}

function processBatch(consumerDefinition: IntegrationEventConsumerDefinition) {
  return consumer.processBatch(consumerDefinition, 100);
}

function appendEvent(): Promise<string> {
  return database.transaction((transaction) =>
    outbox.append(transaction, {
      eventType: "platform.integration-test.delivery",
      sourceContext: "platform",
      aggregateType: "integration_test",
      aggregateId: randomUUID(),
      idempotencyKey: `delivery-${randomUUID()}`,
      correlationId: randomUUID(),
      occurredAt: new Date(),
      payload: {},
    }),
  );
}

function enqueue(message: Record<string, unknown>): Promise<string> {
  return database.transaction((transaction) => pgmq.sendMessage(transaction, QUEUE as never, message));
}

function makeVisible(msgId: string): Promise<void> {
  return database.transaction((transaction) => pgmq.setVisibility(transaction, QUEUE as never, msgId, 0));
}

function deadLetter(msgId: string) {
  return database.db
    .selectFrom("integration.dead_letters")
    .select(["event_id", "read_count", "message", "error"])
    .where("queue_name", "=", QUEUE)
    .where("msg_id", "=", msgId)
    .executeTakeFirst();
}

async function queued(msgId: string): Promise<boolean> {
  const rows = await sql<{ msg_id: string }>`
    select msg_id::text from pgmq.q_integration_test_consumer where msg_id = ${msgId}::bigint
  `.execute(database.db);
  return rows.rows.length > 0;
}

describe("integration event delivery", () => {
  it("dead-letters an undeliverable message at once and delivers the message behind it", async () => {
    const delivered: string[] = [];
    const consumerDefinition = definition((_transaction, event) => {
      delivered.push(event.eventId);
      return Promise.resolve({ outcome: "processed" });
    });
    const missingEventId = randomUUID();
    const validEventId = await appendEvent();
    const missingMsgId = await enqueue({ eventId: missingEventId });
    await enqueue({ eventId: validEventId });

    expect(await processBatch(consumerDefinition)).toMatchObject({
      received: 2,
      processed: 1,
      deadLettered: 1,
      failed: 0,
    });
    expect(delivered).toEqual([validEventId]);
    expect(await deadLetter(missingMsgId)).toEqual({
      event_id: missingEventId,
      read_count: 1,
      message: { eventId: missingEventId },
      error: `Outbox event ${missingEventId} does not exist`,
    });
    expect(await queued(missingMsgId)).toBe(false);
  });

  it("rolls back a failing delivery, retries it, and dead-letters it after five reads", async () => {
    const eventId = await appendEvent();
    const sideEffectKey = `side-effect-${randomUUID()}`;
    const consumerDefinition = definition(async (transaction, event) => {
      await outbox.append(transaction, {
        eventType: "platform.integration-test.side-effect",
        sourceContext: "platform",
        aggregateType: "integration_test",
        aggregateId: event.eventId,
        idempotencyKey: sideEffectKey,
        correlationId: event.correlationId,
        occurredAt: new Date(),
        payload: {},
      });
      throw new Error("projection unavailable");
    });
    const msgId = await enqueue({ eventId });
    logs.length = 0;

    for (let read = 1; read <= 4; read += 1) {
      expect(await processBatch(consumerDefinition)).toMatchObject({ failed: 1, deadLettered: 0 });
      expect(await deadLetter(msgId)).toBeUndefined();
      await makeVisible(msgId);
    }
    expect(await processBatch(consumerDefinition)).toMatchObject({ failed: 0, deadLettered: 1 });

    const sideEffects = await database.db
      .selectFrom("integration.outbox_events")
      .select("event_id")
      .where("idempotency_key", "=", sideEffectKey)
      .execute();
    expect(sideEffects).toEqual([]);
    expect(await deadLetter(msgId)).toEqual({
      event_id: eventId,
      read_count: 5,
      message: { eventId },
      error: "projection unavailable",
    });
    expect(await queued(msgId)).toBe(false);
    expect(logs.map((entry) => [entry.level, entry.message, entry.fields?.readCount])).toEqual([
      ["warn", "Integration event delivery failed; it will be retried", 1],
      ["warn", "Integration event delivery failed; it will be retried", 2],
      ["warn", "Integration event delivery failed; it will be retried", 3],
      ["warn", "Integration event delivery failed; it will be retried", 4],
      ["error", "Integration event dead-lettered", 5],
    ]);

    // The heartbeat is fresh, so only the dead letters make async downstream unhealthy.
    await app.get(AsyncDownstreamHeartbeat).recordSuccess();
    expect((await injectHttp(app, { method: "GET", url: "/health/async" })).statusCode).toBe(503);
    await database.db.deleteFrom("integration.dead_letters").where("queue_name", "=", QUEUE).execute();
    expect((await injectHttp(app, { method: "GET", url: "/health/async" })).statusCode).toBe(200);
  });

  it("archives a redelivered event as a duplicate without handling it again", async () => {
    const handled: string[] = [];
    const consumerDefinition = definition((_transaction, event) => {
      handled.push(event.eventId);
      return Promise.resolve({ outcome: "ignored" });
    });
    const eventId = await appendEvent();
    await enqueue({ eventId });
    const redelivery = await enqueue({ eventId });

    expect(await processBatch(consumerDefinition)).toMatchObject({ ignored: 1, duplicates: 1 });
    expect(handled).toEqual([eventId]);
    expect(await queued(redelivery)).toBe(false);
    const receipt = await database.db
      .selectFrom("integration.consumer_receipts")
      .select("outcome")
      .where("consumer_key", "=", consumerDefinition.consumerKey)
      .where("event_id", "=", eventId)
      .executeTakeFirstOrThrow();
    expect(receipt.outcome).toBe("ignored");
  });
});
