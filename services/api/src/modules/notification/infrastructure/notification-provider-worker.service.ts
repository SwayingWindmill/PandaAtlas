import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { PgmqMessage, PgmqService } from "../../../platform/integration/pgmq.service.js";
import type { IdentityNotificationContactPort } from "../../identity/application/identity-notification.port.js";
import {
  NotificationProviderError,
  type NotificationProviderPort,
} from "../application/notification-provider.port.js";

const QUEUE = "notification_provider" as const;
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_SECONDS = [60, 300, 1_800] as const;

interface ProviderJobSnapshot {
  jobId: string;
  accountId: string;
  category: string;
  content: Record<string, unknown>;
  correlationId: string;
  attemptCount: number;
  databaseNow: Date;
  state: string;
  nextAttemptAt: Date;
  to?: string;
}

export interface NotificationProviderWorkerResult {
  received: number;
  submitted: number;
  retried: number;
  deadLettered: number;
  suppressed: number;
  duplicates: number;
  deferred: number;
}

export class NotificationProviderWorkerService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly pgmq: PgmqService,
    private readonly contacts: IdentityNotificationContactPort,
    private readonly provider: NotificationProviderPort,
  ) {}

  public async processBatch(limit = 10): Promise<NotificationProviderWorkerResult> {
    const messages = await this.database.transaction((transaction) => this.pgmq.read(transaction, QUEUE, 120, limit));
    const result: NotificationProviderWorkerResult = {
      received: messages.length,
      submitted: 0,
      retried: 0,
      deadLettered: 0,
      suppressed: 0,
      duplicates: 0,
      deferred: 0,
    };
    for (const message of messages) {
      const outcome = await this.processMessage(message);
      result[outcome] += 1;
    }
    return result;
  }

  private async processMessage(
    message: PgmqMessage,
  ): Promise<"submitted" | "retried" | "deadLettered" | "suppressed" | "duplicates" | "deferred"> {
    const jobId = message.message.jobId;
    if (typeof jobId !== "string") throw new Error("Notification provider queue message is missing jobId");

    const snapshot = await this.loadSnapshot(jobId);
    if (
      snapshot === undefined ||
      snapshot.state === "submitted" ||
      snapshot.state === "dead_lettered" ||
      snapshot.state === "suppressed"
    ) {
      await this.database.transaction((transaction) => this.pgmq.archive(transaction, QUEUE, message.msgId));
      return "duplicates";
    }
    if (snapshot.nextAttemptAt.getTime() > snapshot.databaseNow.getTime()) {
      const delaySeconds = Math.max(1, Math.ceil((snapshot.nextAttemptAt.getTime() - snapshot.databaseNow.getTime()) / 1_000));
      await this.database.transaction((transaction) =>
        this.pgmq.setVisibility(transaction, QUEUE, message.msgId, delaySeconds),
      );
      return "deferred";
    }
    if (snapshot.to === undefined) {
      await this.database.transaction(async (transaction) => {
        const job = await transaction
          .selectFrom("notification.provider_jobs")
          .select(["message_id", "state"])
          .where("job_id", "=", jobId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        if (job.state === "submitted" || job.state === "dead_lettered" || job.state === "suppressed") {
          await this.pgmq.archive(transaction, QUEUE, message.msgId);
          return;
        }
        const now = new Date();
        await transaction
          .updateTable("notification.provider_jobs")
          .set({ state: "suppressed", suppressed_at: now, last_error_code: "email_unavailable", updated_at: now })
          .where("job_id", "=", jobId)
          .executeTakeFirstOrThrow();
        await transaction
          .updateTable("notification.message_channels")
          .set({ state: "suppressed", suppression_reason: "email_unavailable", updated_at: now })
          .where("message_id", "=", job.message_id)
          .where("channel", "=", "email")
          .executeTakeFirstOrThrow();
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
      });
      return "suppressed";
    }

    const startedAt = Date.now();
    try {
      const sent = await this.provider.sendEmail({
        jobId,
        to: snapshot.to,
        subject: this.subject(snapshot.category),
        text: this.text(snapshot.content),
      });
      const latencyMs = Math.max(0, Date.now() - startedAt);
      await this.database.transaction(async (transaction) => {
        const job = await transaction
          .selectFrom("notification.provider_jobs")
          .select(["message_id", "attempt_count", "state", "correlation_id"])
          .where("job_id", "=", jobId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        if (job.state === "submitted" || job.state === "dead_lettered") {
          await this.pgmq.archive(transaction, QUEUE, message.msgId);
          return;
        }
        const attemptNumber = job.attempt_count + 1;
        const now = new Date();
        await transaction
          .insertInto("notification.provider_attempts")
          .values({
            job_id: jobId,
            attempt_number: attemptNumber,
            outcome: "submitted",
            provider: sent.provider,
            provider_message_id: sent.providerMessageId,
            retryable: false,
            latency_ms: latencyMs,
          })
          .execute();
        await transaction
          .updateTable("notification.provider_jobs")
          .set({
            state: "submitted",
            attempt_count: attemptNumber,
            provider: sent.provider,
            provider_message_id: sent.providerMessageId,
            submitted_at: now,
            updated_at: now,
            last_error_code: null,
          })
          .where("job_id", "=", jobId)
          .executeTakeFirstOrThrow();
        await transaction
          .updateTable("notification.message_channels")
          .set({ state: "submitted", updated_at: now })
          .where("message_id", "=", job.message_id)
          .where("channel", "=", "email")
          .executeTakeFirstOrThrow();
        await this.outbox.append(transaction, {
          eventType: "notification.provider.submitted",
          sourceContext: "notification",
          aggregateType: "provider_job",
          aggregateId: jobId,
          idempotencyKey: `provider-submitted:${jobId}`,
          correlationId: job.correlation_id,
          occurredAt: now,
          payload: { jobId, messageId: job.message_id, provider: sent.provider },
        });
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
      });
      return "submitted";
    } catch (error) {
      const failure =
        error instanceof NotificationProviderError
          ? error
          : new NotificationProviderError(
              "notification_provider_unknown",
              true,
              error instanceof Error ? error.message : "Notification provider failed",
            );
      const latencyMs = Math.max(0, Date.now() - startedAt);
      return this.recordFailure(message, jobId, failure, latencyMs);
    }
  }

  private async recordFailure(
    message: PgmqMessage,
    jobId: string,
    failure: NotificationProviderError,
    latencyMs: number,
  ): Promise<"retried" | "deadLettered"> {
    return this.database.transaction(async (transaction) => {
      const job = await transaction
        .selectFrom("notification.provider_jobs")
        .select(["message_id", "attempt_count", "state", "correlation_id"])
        .where("job_id", "=", jobId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (job.state === "submitted" || job.state === "dead_lettered") {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        return job.state === "submitted" ? "retried" : "deadLettered";
      }

      const attemptNumber = job.attempt_count + 1;
      const retry = failure.retryable && attemptNumber < MAX_ATTEMPTS;
      const now = new Date();
      if (retry) {
        const delaySeconds = RETRY_DELAYS_SECONDS[Math.min(attemptNumber - 1, RETRY_DELAYS_SECONDS.length - 1)] ?? 1_800;
        await transaction
          .insertInto("notification.provider_attempts")
          .values({
            job_id: jobId,
            attempt_number: attemptNumber,
            outcome: "retry",
            provider: "resend",
            error_code: failure.code,
            retryable: true,
            latency_ms: latencyMs,
          })
          .execute();
        await transaction
          .updateTable("notification.provider_jobs")
          .set({
            state: "retrying",
            attempt_count: attemptNumber,
            next_attempt_at: new Date(now.getTime() + delaySeconds * 1_000),
            last_error_code: failure.code,
            updated_at: now,
          })
          .where("job_id", "=", jobId)
          .executeTakeFirstOrThrow();
        await this.pgmq.setVisibility(transaction, QUEUE, message.msgId, delaySeconds);
        return "retried";
      }

      await transaction
        .insertInto("notification.provider_attempts")
        .values({
          job_id: jobId,
          attempt_number: attemptNumber,
          outcome: "dead_lettered",
          provider: "resend",
          error_code: failure.code,
          retryable: failure.retryable,
          latency_ms: latencyMs,
        })
        .execute();
      await transaction
        .updateTable("notification.provider_jobs")
        .set({
          state: "dead_lettered",
          attempt_count: attemptNumber,
          last_error_code: failure.code,
          dead_lettered_at: now,
          updated_at: now,
        })
        .where("job_id", "=", jobId)
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto("notification.provider_dead_letters")
        .values({ job_id: jobId, final_error_code: failure.code, attempt_count: attemptNumber })
        .execute();
      await transaction
        .updateTable("notification.message_channels")
        .set({ state: "dead_lettered", updated_at: now })
        .where("message_id", "=", job.message_id)
        .where("channel", "=", "email")
        .executeTakeFirstOrThrow();
      await this.pgmq.sendMessage(transaction, "notification_provider_dlq", { jobId, errorCode: failure.code });
      await this.outbox.append(transaction, {
        eventType: "notification.provider.dead_lettered",
        sourceContext: "notification",
        aggregateType: "provider_job",
        aggregateId: jobId,
        idempotencyKey: `provider-dead-lettered:${jobId}`,
        correlationId: job.correlation_id,
        occurredAt: now,
        payload: { jobId, messageId: job.message_id, errorCode: failure.code, attemptCount: attemptNumber },
      });
      await this.pgmq.archive(transaction, QUEUE, message.msgId);
      return "deadLettered";
    });
  }

  private async loadSnapshot(jobId: string): Promise<ProviderJobSnapshot | undefined> {
    return this.database.transaction(async (transaction) => {
      const row = await transaction
        .selectFrom("notification.provider_jobs as job")
        .innerJoin("notification.messages as message", "message.message_id", "job.message_id")
        .select([
          "job.job_id",
          "job.attempt_count",
          "job.state",
          "job.next_attempt_at",
          "job.correlation_id",
          sql<Date>`now()`.as("database_now"),
          "message.account_id",
          "message.category",
          "message.content",
        ])
        .where("job.job_id", "=", jobId)
        .executeTakeFirst();
      if (row === undefined) return undefined;
      const to = await this.contacts.getDeliverableEmail(transaction, row.account_id);
      return {
        jobId: row.job_id,
        accountId: row.account_id,
        category: row.category,
        content: row.content as Record<string, unknown>,
        correlationId: row.correlation_id,
        attemptCount: row.attempt_count,
        databaseNow: row.database_now,
        state: row.state,
        nextAttemptAt: row.next_attempt_at,
        ...(to === undefined ? {} : { to }),
      };
    });
  }

  private subject(category: string): string {
    return category === "correction" ? "PandaAtlas correction notice" : "PandaAtlas knowledge update";
  }

  private text(content: Record<string, unknown>): string {
    return `PandaAtlas notification\n\n${JSON.stringify(content, null, 2)}`;
  }
}
