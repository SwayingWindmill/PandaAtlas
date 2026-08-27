import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { AsyncDownstreamRunnerService } from "../../src/jobs/async-downstream-runner.service.js";
import { AuditEventConsumerService } from "../../src/modules/audit/infrastructure/audit-event-consumer.service.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { ENGAGEMENT_PORT, type EngagementPort } from "../../src/modules/engagement/application/engagement.application.js";
import {
  IDENTITY_NOTIFICATION_CONTACT_PORT,
  type IdentityNotificationContactPort,
} from "../../src/modules/identity/application/identity-notification.port.js";
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from "../../src/modules/notification/application/notification.application.js";
import {
  NotificationProviderError,
  type NotificationProviderPort,
} from "../../src/modules/notification/application/notification-provider.port.js";
import { NotificationEventConsumerService } from "../../src/modules/notification/infrastructure/notification-event-consumer.service.js";
import { NotificationProviderWorkerService } from "../../src/modules/notification/infrastructure/notification-provider-worker.service.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { PRIVACY_PORT, type PrivacyPort } from "../../src/modules/privacy/application/privacy.application.js";
import {
  PUBLICATION_PORT,
  type PublicationPort,
} from "../../src/modules/publication/application/publication.application.js";
import { UpdatesEventConsumerService } from "../../src/modules/updates/infrastructure/updates-event-consumer.service.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { IntegrationOutboxService } from "../../src/platform/integration/integration-outbox.service.js";
import { OutboxDispatcherService } from "../../src/platform/integration/outbox-dispatcher.service.js";
import { PgmqService } from "../../src/platform/integration/pgmq.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let app: NestFastifyApplication;

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  app = await createApplication();
});

afterAll(async () => {
  await app.close();
});

class RetryableFailureProvider implements NotificationProviderPort {
  public sendEmail(): Promise<never> {
    return Promise.reject(
      new NotificationProviderError("integration_retryable", true, "Synthetic retryable provider failure"),
    );
  }
}

class TerminalFailureProvider implements NotificationProviderPort {
  public sendEmail(): Promise<never> {
    return Promise.reject(
      new NotificationProviderError("integration_terminal", false, "Synthetic terminal provider failure"),
    );
  }
}

describe("V2 async downstream and compliance", () => {
  it("projects knowledge changes at-least-once safely, isolates provider failure, and orchestrates privacy through owner ports", async () => {
    const suffix = randomUUID();
    const database = app.get(DatabaseService);
    const evidence = app.get<EvidencePort>(EVIDENCE_PORT);
    const pandas = app.get<PandaPort>(PANDA_PORT);
    const engagement = app.get<EngagementPort>(ENGAGEMENT_PORT);
    const publication = app.get<PublicationPort>(PUBLICATION_PORT);
    const notifications = app.get<NotificationPort>(NOTIFICATION_PORT);
    const privacy = app.get<PrivacyPort>(PRIVACY_PORT);
    const runner = app.get(AsyncDownstreamRunnerService);
    const dispatcher = app.get(OutboxDispatcherService);
    const updatesConsumer = app.get(UpdatesEventConsumerService);
    const notificationConsumer = app.get(NotificationEventConsumerService);
    const auditConsumer = app.get(AuditEventConsumerService);
    const outbox = app.get(IntegrationOutboxService);
    const pgmq = app.get(PgmqService);
    const contacts = app.get<IdentityNotificationContactPort>(IDENTITY_NOTIFICATION_CONTACT_PORT);

    const accountId = randomUUID();
    await sql`
      insert into auth.users (id, aud, role, created_at, updated_at)
      values (${accountId}::uuid, 'authenticated', 'authenticated', now(), now())
    `.execute(database.db);
    await database.db
      .insertInto("identity.accounts")
      .values({ account_id: accountId, email: `async-${suffix}@example.test` })
      .execute();

    const sourceId = `async:${suffix}`;
    await evidence.createSource({
      sourceId,
      publisher: "Async Integration Archive",
      title: "Async knowledge source",
      url: `https://example.test/async/${suffix}`,
      publishedOn: "2026-08-27",
      lastVerifiedOn: "2026-08-27",
      languageTag: "en",
      accessState: "accessible",
      evidenceTier: "institutional",
      publicSummary: "Async integration source.",
      contentSha256: "d".repeat(64),
    });
    const panda = await pandas.createPanda({
      canonicalSlug: `async-panda-${suffix}`,
      primaryName: {
        languageTag: "en",
        value: `Async Panda ${suffix}`,
        sourceIds: [sourceId],
      },
    });
    await engagement.favorite(accountId, panda.pandaId);

    const publicationContext = { actorAccountId: accountId, correlationId: randomUUID() };
    const release = await publication.build(`async-${suffix}-1`, publicationContext);
    const sealed = await publication.seal(release.releaseId, publicationContext, "Seal async integration release");
    expect(sealed.kind).toBe("ok");
    const activated = await publication.activate(
      release.releaseId,
      publicationContext,
      "Activate async integration release",
    );
    expect(activated.kind).toBe("ok");

    const activationEvent = await database.db
      .selectFrom("integration.outbox_events")
      .select("event_id")
      .where("event_type", "=", "publication.release.activated")
      .where("correlation_id", "=", publicationContext.correlationId)
      .executeTakeFirstOrThrow();

    let update:
      | { update_id: string; source_event_id: string; release_id: string }
      | undefined;
    for (let cycle = 0; cycle < 4 && update === undefined; cycle += 1) {
      await runner.runCycle();
      update = await database.db
        .selectFrom("updates.items")
        .select(["update_id", "source_event_id", "release_id"])
        .where("source_event_id", "=", activationEvent.event_id)
        .executeTakeFirst();
    }
    expect(update).toBeDefined();
    if (update === undefined) throw new Error("Activation event did not project an update");
    expect(update.release_id).toBe(release.releaseId);

    const updateEvent = await database.db
      .selectFrom("integration.outbox_events")
      .select("event_id")
      .where("event_type", "=", "updates.item.published")
      .where("aggregate_id", "=", update.update_id)
      .executeTakeFirstOrThrow();
    const knowledgeMessage = await database.db
      .selectFrom("notification.messages")
      .select(["message_id", "source_event_id", "category"])
      .where("account_id", "=", accountId)
      .where("source_event_id", "=", updateEvent.event_id)
      .executeTakeFirstOrThrow();
    expect(knowledgeMessage.category).toBe("knowledge_update");

    const initialEvidence = await database.db
      .selectFrom("audit.evidence_events")
      .select("event_type")
      .where("correlation_id", "=", publicationContext.correlationId)
      .execute();
    expect(initialEvidence.map((row) => row.event_type)).toEqual(
      expect.arrayContaining([
        "publication.release.activated",
        "updates.item.published",
        "notification.message.created",
      ]),
    );

    await database.transaction((transaction) =>
      pgmq.sendEvent(transaction, "integration_updates", activationEvent.event_id),
    );
    await updatesConsumer.processBatch(100);
    const updateCount = await database.db
      .selectFrom("updates.items")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("source_event_id", "=", activationEvent.event_id)
      .executeTakeFirstOrThrow();
    expect(Number(updateCount.count)).toBe(1);

    await database.transaction((transaction) =>
      pgmq.sendEvent(transaction, "integration_notification", updateEvent.event_id),
    );
    await notificationConsumer.processBatch(100);
    const messageCount = await database.db
      .selectFrom("notification.messages")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("source_event_id", "=", updateEvent.event_id)
      .where("account_id", "=", accountId)
      .executeTakeFirstOrThrow();
    expect(Number(messageCount.count)).toBe(1);

    const auditCountBeforeRead = await database.db
      .selectFrom("audit.evidence_events")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("correlation_id", "=", publicationContext.correlationId)
      .executeTakeFirstOrThrow();
    const updatesRead = await app.inject({ method: "GET", url: "/api/v2/updates" });
    expect(updatesRead.statusCode, updatesRead.body).toBe(200);
    const auditCountAfterRead = await database.db
      .selectFrom("audit.evidence_events")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("correlation_id", "=", publicationContext.correlationId)
      .executeTakeFirstOrThrow();
    expect(Number(auditCountAfterRead.count)).toBe(Number(auditCountBeforeRead.count));

    const privacyRequest = await privacy.create(accountId, {
      kind: "access_export",
      reason: "Export integration-owned account data",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    expect(privacyRequest.state).toBe("pending");
    let completedPrivacy = await privacy.get(accountId, privacyRequest.requestId);
    for (let cycle = 0; cycle < 4 && completedPrivacy?.state !== "completed"; cycle += 1) {
      await runner.runCycle();
      completedPrivacy = await privacy.get(accountId, privacyRequest.requestId);
    }
    expect(completedPrivacy?.state).toBe("completed");
    const exported = await privacy.getExport(accountId, privacyRequest.requestId);
    expect(exported).toBeDefined();
    if (exported === undefined) throw new Error("Privacy export was not created");
    expect(Object.keys(exported.payload).sort()).toEqual(["engagement", "game", "identity", "notification"]);
    expect(JSON.stringify(exported.payload)).toContain(panda.pandaId);

    await notifications.setPreference(accountId, "correction", "email", true);
    await publication.setResourceTakedown(
      "panda",
      panda.pandaId,
      true,
      publicationContext,
      "Exercise retryable provider work",
    );

    let retryJob: { job_id: string; message_id: string } | undefined;
    for (let cycle = 0; cycle < 4 && retryJob === undefined; cycle += 1) {
      await dispatcher.dispatchBatch(200);
      await notificationConsumer.processBatch(100);
      retryJob = await database.db
        .selectFrom("notification.provider_jobs as job")
        .innerJoin("notification.messages as message", "message.message_id", "job.message_id")
        .select(["job.job_id", "job.message_id"])
        .where("message.account_id", "=", accountId)
        .where("message.category", "=", "correction")
        .where("job.state", "=", "pending")
        .orderBy("job.created_at", "desc")
        .executeTakeFirst();
    }
    expect(retryJob).toBeDefined();
    if (retryJob === undefined) throw new Error("Retryable provider job was not created");

    const retryWorker = new NotificationProviderWorkerService(
      database,
      outbox,
      pgmq,
      contacts,
      new RetryableFailureProvider(),
    );
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await retryWorker.processBatch(100);
      const state = await database.db
        .selectFrom("notification.provider_jobs")
        .select("state")
        .where("job_id", "=", retryJob.job_id)
        .executeTakeFirstOrThrow();
      if (state.state === "retrying") break;
    }
    const retriedJob = await database.db
      .selectFrom("notification.provider_jobs")
      .select(["state", "attempt_count", "last_error_code"])
      .where("job_id", "=", retryJob.job_id)
      .executeTakeFirstOrThrow();
    expect(retriedJob).toEqual({ state: "retrying", attempt_count: 1, last_error_code: "integration_retryable" });
    expect(
      await database.db
        .selectFrom("notification.messages")
        .select("message_id")
        .where("message_id", "=", retryJob.message_id)
        .executeTakeFirst(),
    ).toBeDefined();

    await publication.setResourceTakedown(
      "panda",
      panda.pandaId,
      false,
      publicationContext,
      "Exercise terminal provider work",
    );
    let terminalJob: { job_id: string; message_id: string } | undefined;
    for (let cycle = 0; cycle < 4 && terminalJob === undefined; cycle += 1) {
      await dispatcher.dispatchBatch(200);
      await notificationConsumer.processBatch(100);
      terminalJob = await database.db
        .selectFrom("notification.provider_jobs as job")
        .innerJoin("notification.messages as message", "message.message_id", "job.message_id")
        .select(["job.job_id", "job.message_id"])
        .where("message.account_id", "=", accountId)
        .where("message.category", "=", "correction")
        .where("job.state", "=", "pending")
        .orderBy("job.created_at", "desc")
        .executeTakeFirst();
    }
    expect(terminalJob).toBeDefined();
    if (terminalJob === undefined) throw new Error("Terminal provider job was not created");

    const terminalWorker = new NotificationProviderWorkerService(
      database,
      outbox,
      pgmq,
      contacts,
      new TerminalFailureProvider(),
    );
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await terminalWorker.processBatch(100);
      const state = await database.db
        .selectFrom("notification.provider_jobs")
        .select("state")
        .where("job_id", "=", terminalJob.job_id)
        .executeTakeFirstOrThrow();
      if (state.state === "dead_lettered") break;
    }
    expect(
      await database.db
        .selectFrom("notification.provider_jobs")
        .select(["state", "attempt_count", "last_error_code"])
        .where("job_id", "=", terminalJob.job_id)
        .executeTakeFirstOrThrow(),
    ).toEqual({ state: "dead_lettered", attempt_count: 1, last_error_code: "integration_terminal" });
    expect(
      await database.db
        .selectFrom("notification.provider_dead_letters")
        .select(["final_error_code", "attempt_count"])
        .where("job_id", "=", terminalJob.job_id)
        .executeTakeFirstOrThrow(),
    ).toEqual({ final_error_code: "integration_terminal", attempt_count: 1 });
    expect(
      await database.db
        .selectFrom("notification.messages")
        .select("message_id")
        .where("message_id", "=", terminalJob.message_id)
        .executeTakeFirst(),
    ).toBeDefined();

    let deadLetterAudit: { source_event_id: string } | undefined;
    for (let cycle = 0; cycle < 4 && deadLetterAudit === undefined; cycle += 1) {
      await dispatcher.dispatchBatch(200);
      await auditConsumer.processBatch(100);
      deadLetterAudit = await database.db
        .selectFrom("audit.evidence_events")
        .select("source_event_id")
        .where("event_type", "=", "notification.provider.dead_lettered")
        .where("aggregate_id", "=", terminalJob.job_id)
        .executeTakeFirst();
    }
    expect(deadLetterAudit).toBeDefined();
  });
});
