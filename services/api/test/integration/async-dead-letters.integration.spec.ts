import type { NestExpressApplication } from "@nestjs/platform-express";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { AuditEventConsumerService } from "../../src/modules/audit/infrastructure/audit-event-consumer.service.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { AsyncDownstreamHeartbeat } from "../../src/platform/integration/async-downstream-heartbeat.js";
import { IntegrationOutboxService } from "../../src/platform/integration/integration-outbox.service.js";
import { PgmqService } from "../../src/platform/integration/pgmq.service.js";
import { injectHttp } from "../inject-http.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const QUEUE = "integration_audit" as const;

let app: NestExpressApplication;
const deadLetterMessageIds: string[] = [];

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;
  app = await createApplication();
});

afterAll(async () => {
  // Dead letters keep /health/async unhealthy; leave none behind for other suites.
  if (deadLetterMessageIds.length > 0) {
    await app.get(DatabaseService).db
      .deleteFrom("integration.dead_letters")
      .where("queue_name", "=", QUEUE)
      .where("msg_id", "in", deadLetterMessageIds)
      .execute();
  }
  await app.close();
});

describe("integration event dead letters", () => {
  it("retries a failing message, dead-letters it after five reads, and keeps delivering the messages behind it", async () => {
    const database = app.get(DatabaseService);
    const outbox = app.get(IntegrationOutboxService);
    const pgmq = app.get(PgmqService);
    const audit = app.get(AuditEventConsumerService);

    const validEventId = await database.transaction((transaction) =>
      outbox.append(transaction, {
        eventType: "platform.integration-test.dead-letter",
        sourceContext: "platform",
        aggregateType: "integration_test",
        aggregateId: randomUUID(),
        idempotencyKey: `dead-letter-${randomUUID()}`,
        correlationId: randomUUID(),
        occurredAt: new Date(),
        payload: {},
      }),
    );
    const missingEventId = randomUUID();
    const [poisonMsgId, validMsgId] = await database.transaction(async (transaction) => [
      await pgmq.sendEvent(transaction, QUEUE, missingEventId),
      await pgmq.sendEvent(transaction, QUEUE, validEventId),
    ]);
    if (poisonMsgId === undefined || validMsgId === undefined) throw new Error("PGMQ did not accept the test messages");
    deadLetterMessageIds.push(poisonMsgId);

    const deadLetters = () =>
      database.db
        .selectFrom("integration.dead_letters")
        .select(["consumer_key", "read_count", "message", "error"])
        .where("queue_name", "=", QUEUE)
        .where("msg_id", "=", poisonMsgId)
        .execute();

    const first = await audit.processBatch(100);
    expect(first.failed).toBeGreaterThanOrEqual(1);
    const projected = await database.db
      .selectFrom("audit.evidence_events")
      .select("source_event_id")
      .where("source_event_id", "=", validEventId)
      .execute();
    expect(projected).toHaveLength(1);
    expect(await deadLetters()).toEqual([]);

    for (let read = 2; read <= 5; read += 1) {
      await database.transaction((transaction) => pgmq.setVisibility(transaction, QUEUE, poisonMsgId, 0));
      await audit.processBatch(100);
    }

    expect(await deadLetters()).toEqual([
      {
        consumer_key: "audit.projector",
        read_count: 5,
        message: { eventId: missingEventId },
        error: `Outbox event ${missingEventId} does not exist`,
      },
    ]);
    const stillQueued = await sql<{ msg_id: string }>`
      select msg_id::text from pgmq.q_integration_audit where msg_id = ${poisonMsgId}::bigint
    `.execute(database.db);
    expect(stillQueued.rows).toEqual([]);

    // The heartbeat is fresh, so only the dead letter makes async downstream unhealthy.
    await app.get(AsyncDownstreamHeartbeat).recordSuccess();
    const unhealthy = await injectHttp(app, { method: "GET", url: "/health/async" });
    expect(unhealthy.statusCode).toBe(503);

    await database.db
      .deleteFrom("integration.dead_letters")
      .where("queue_name", "=", QUEUE)
      .where("msg_id", "=", poisonMsgId)
      .execute();
    const healthy = await injectHttp(app, { method: "GET", url: "/health/async" });
    expect(healthy.statusCode).toBe(200);
  });
});
