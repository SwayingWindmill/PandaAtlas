import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { PgmqMessage, PgmqService } from "../../../platform/integration/pgmq.service.js";
import type { IdentityNotificationContactPort } from "../../identity/application/identity-notification.port.js";
import {
  NotificationProviderError,
  type NotificationProviderPort,
  type NotificationPushProviderPort,
} from "../application/notification-provider.port.js";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

const QUEUE = "notification_provider" as const;
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_SECONDS = [60, 300, 1_800] as const;
const SAFE_SLUG_PATTERN = /^[a-z0-9-]+$/i;

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function safeSlug(value: unknown): string | undefined {
  const text = nonEmptyString(value);
  return text !== undefined && SAFE_SLUG_PATTERN.test(text) ? text : undefined;
}

interface ProviderJobSnapshot {
  jobId: string;
  messageId: string;
  channel: "email" | "push";
  accountId: string;
  category: string;
  content: Record<string, unknown>;
  correlationId: string;
  attemptCount: number;
  databaseNow: Date;
  state: string;
  nextAttemptAt: Date;
  to?: string;
  pushTokens?: string[];
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
    private readonly pushProvider?: NotificationPushProviderPort,
  ) {}

  public async processBatch(limit = 10): Promise<NotificationProviderWorkerResult> {
    const messages = await this.pgmq.read(this.database.db, QUEUE, 120, limit);
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
    if (snapshot.channel === "email" && snapshot.to === undefined) {
      return this.suppressJob(message, jobId, "email", "email_unavailable");
    }
    if (snapshot.channel === "push" && (snapshot.pushTokens === undefined || snapshot.pushTokens.length === 0)) {
      return this.suppressJob(message, jobId, "push", "device_token_unavailable");
    }

    const startedAt = Date.now();
    try {
      if (snapshot.channel === "push") {
        if (this.pushProvider === undefined) {
          throw new NotificationProviderError(
            "expo_provider_unavailable",
            false,
            "Expo push notification provider is not configured",
          );
        }
        const pushResult = await this.pushProvider.sendPush({
          jobId,
          toTokens: snapshot.pushTokens!,
          title: this.pushTitle(snapshot.category, snapshot.content),
          body: this.pushBody(snapshot.category, snapshot.content),
          data: {
            messageId: snapshot.messageId,
            category: snapshot.category,
            route: this.pushRoute(snapshot.content),
            ...snapshot.content,
          },
        });
        const latencyMs = Math.max(0, Date.now() - startedAt);
        const onTokensUpdated =
          pushResult.unregisteredTokens.length > 0
            ? (transaction: DatabaseTransaction, now: Date) =>
                this.deactivateTokens(transaction, snapshot.accountId, pushResult.unregisteredTokens, now)
            : undefined;
        if (pushResult.deliveredTicketIds.length === 0) {
          return this.suppressJob(message, jobId, "push", "device_not_registered", onTokensUpdated);
        }
        return this.recordSuccess(
          message,
          jobId,
          "push",
          pushResult.provider,
          pushResult.deliveredTicketIds.join(","),
          latencyMs,
          onTokensUpdated,
        );
      }

      const sent = await this.provider.sendEmail({
        jobId,
        to: snapshot.to!,
        subject: this.subject(snapshot.category),
        text: this.text(snapshot.content),
      });
      const latencyMs = Math.max(0, Date.now() - startedAt);
      return this.recordSuccess(message, jobId, "email", sent.provider, sent.providerMessageId, latencyMs);
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

  private async suppressJob(
    message: PgmqMessage,
    jobId: string,
    channel: "email" | "push",
    reason: string,
    afterLock?: (transaction: DatabaseTransaction, now: Date) => Promise<void>,
  ): Promise<"suppressed" | "duplicates"> {
    let outcome: "suppressed" | "duplicates" = "suppressed";
    await this.database.transaction(async (transaction) => {
      const job = await transaction
        .selectFrom("notification.provider_jobs")
        .select(["message_id", "state"])
        .where("job_id", "=", jobId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (job.state === "submitted" || job.state === "dead_lettered" || job.state === "suppressed") {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        outcome = "duplicates";
        return;
      }
      const now = new Date();
      if (afterLock !== undefined) {
        await afterLock(transaction, now);
      }
      await transaction
        .updateTable("notification.provider_jobs")
        .set({ state: "suppressed", suppressed_at: now, last_error_code: reason, updated_at: now })
        .where("job_id", "=", jobId)
        .executeTakeFirstOrThrow();
      await transaction
        .updateTable("notification.message_channels")
        .set({ state: "suppressed", suppression_reason: reason, updated_at: now })
        .where("message_id", "=", job.message_id)
        .where("channel", "=", channel)
        .executeTakeFirstOrThrow();
      await this.pgmq.archive(transaction, QUEUE, message.msgId);
    });
    return outcome;
  }

  private async recordSuccess(
    message: PgmqMessage,
    jobId: string,
    channel: "email" | "push",
    provider: string,
    providerMessageId: string,
    latencyMs: number,
    afterLock?: (transaction: DatabaseTransaction, now: Date) => Promise<void>,
  ): Promise<"submitted" | "duplicates"> {
    let outcome: "submitted" | "duplicates" = "submitted";
    await this.database.transaction(async (transaction) => {
      const job = await transaction
        .selectFrom("notification.provider_jobs")
        .select(["message_id", "attempt_count", "state", "correlation_id"])
        .where("job_id", "=", jobId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (job.state === "submitted" || job.state === "dead_lettered" || job.state === "suppressed") {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        outcome = "duplicates";
        return;
      }
      const now = new Date();
      if (afterLock !== undefined) {
        await afterLock(transaction, now);
      }
      const attemptNumber = job.attempt_count + 1;
      await transaction
        .insertInto("notification.provider_attempts")
        .values({
          job_id: jobId,
          attempt_number: attemptNumber,
          outcome: "submitted",
          provider,
          provider_message_id: providerMessageId,
          retryable: false,
          latency_ms: latencyMs,
        })
        .execute();
      await transaction
        .updateTable("notification.provider_jobs")
        .set({
          state: "submitted",
          attempt_count: attemptNumber,
          provider,
          provider_message_id: providerMessageId,
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
        .where("channel", "=", channel)
        .executeTakeFirstOrThrow();
      await this.outbox.append(transaction, {
        eventType: "notification.provider.submitted",
        sourceContext: "notification",
        aggregateType: "provider_job",
        aggregateId: jobId,
        idempotencyKey: `provider-submitted:${jobId}`,
        correlationId: job.correlation_id,
        occurredAt: now,
        payload: { jobId, messageId: job.message_id, channel, provider },
      });
      await this.pgmq.archive(transaction, QUEUE, message.msgId);
    });
    return outcome;
  }

  private async deactivateTokens(
    transaction: DatabaseTransaction,
    accountId: string,
    tokens: string[],
    now: Date,
  ): Promise<void> {
    if (tokens.length === 0) return;
    await transaction
      .updateTable("notification.device_tokens")
      .set({ active: false, disabled_reason: "DeviceNotRegistered", updated_at: now })
      .where("account_id", "=", accountId)
      .where("expo_push_token", "in", tokens)
      .execute();
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
        .select(["message_id", "channel", "attempt_count", "state", "correlation_id"])
        .where("job_id", "=", jobId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (job.state === "submitted" || job.state === "dead_lettered" || job.state === "suppressed") {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        return job.state === "submitted" ? "retried" : "deadLettered";
      }

      const channel = job.channel as "email" | "push";
      const providerName = channel === "push" ? "expo" : "resend";
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
            provider: providerName,
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
          provider: providerName,
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
        .where("channel", "=", channel)
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
        payload: { jobId, messageId: job.message_id, channel, errorCode: failure.code, attemptCount: attemptNumber },
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
          "job.message_id",
          "job.channel",
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
      const channel = row.channel as "email" | "push";
      if (channel === "push") {
        const deviceRows = await transaction
          .selectFrom("notification.device_tokens")
          .select("expo_push_token")
          .where("account_id", "=", row.account_id)
          .where("active", "=", true)
          .orderBy("updated_at", "desc")
          .execute();
        return {
          jobId: row.job_id,
          messageId: row.message_id,
          channel,
          accountId: row.account_id,
          category: row.category,
          content: row.content as Record<string, unknown>,
          correlationId: row.correlation_id,
          attemptCount: row.attempt_count,
          databaseNow: row.database_now,
          state: row.state,
          nextAttemptAt: row.next_attempt_at,
          pushTokens: deviceRows.map((item) => item.expo_push_token),
        };
      }
      const to = await this.contacts.getDeliverableEmail(transaction, row.account_id);
      return {
        jobId: row.job_id,
        messageId: row.message_id,
        channel,
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

  private pushRoute(content: Record<string, unknown>): string {
    if (content.kind === "birthday_reminder" || content.kind === "panda_news") {
      const slug = safeSlug(content.pandaSlug);
      return slug !== undefined ? `/pandas/${slug}` : content.kind === "birthday_reminder" ? "/birthdays" : "/notifications";
    }
    if (content.kind === "venue_news") {
      const slug = safeSlug(content.institutionSlug);
      return slug !== undefined ? `/institutions/${slug}` : "/venue-news";
    }
    if (content.kind === "publication_control" && content.action === "restored") {
      const slug = safeSlug(content.pandaSlug);
      if (slug !== undefined) return `/pandas/${slug}`;
    }
    return "/notifications";
  }

  private pushTitle(category: string, content: Record<string, unknown>): string {
    if (content.kind === "birthday_reminder") {
      const name = nonEmptyString(content.pandaName) ?? "关注的熊猫";
      const age = typeof content.age === "number" && Number.isInteger(content.age) && content.age >= 1 ? `${content.age}岁` : "";
      return content.leadDays === 1 ? `明天是${name}${age}生日` : `今天是${name}${age}生日`;
    }
    if (content.kind === "panda_news") {
      const name = nonEmptyString(content.pandaName) ?? "关注的熊猫";
      return `${name}有新动态`;
    }
    if (content.kind === "venue_news") {
      const name = nonEmptyString(content.institutionName) ?? "关注的场馆";
      return `${name}有新公告`;
    }
    if (content.kind === "knowledge_update") return "关注的熊猫资料更新了";
    if (content.kind === "publication_control") {
      return content.action === "restored" ? "关注的熊猫资料恢复公开了" : "关注的熊猫资料暂时下线核对";
    }
    return category === "correction" ? "资料有更正" : "关注的熊猫有新消息";
  }

  private pushBody(category: string, content: Record<string, unknown>): string {
    if (content.kind === "birthday_reminder") {
      const name = nonEmptyString(content.pandaName) ?? "它";
      return content.leadDays === 1 ? `提前祝${name}生日快乐，点击查看档案。` : `去看看${name}的档案和动态吧。`;
    }
    if (content.kind === "panda_news") {
      return nonEmptyString(content.title) ?? nonEmptyString(content.summary) ?? "点击查看最新动态。";
    }
    if (content.kind === "venue_news") {
      return nonEmptyString(content.title) ?? nonEmptyString(content.summary) ?? "点击查看场馆最新公告。";
    }
    if (content.kind === "knowledge_update") {
      const count = typeof content.changedResourceCount === "number" ? `${content.changedResourceCount} 处变化` : null;
      const version = typeof content.releaseVersion === "string" ? `版本 ${content.releaseVersion}` : null;
      return [count, version].filter(Boolean).join(" ") || "点击查看最新的大熊猫档案变更。";
    }
    if (content.kind === "publication_control") {
      return content.action === "restored" ? "可前往通知中心查看最新详情。" : "核对完成后会再通知你。";
    }
    return category === "correction" ? "点击查看通知中心详情。" : "点击查看最新动态。";
  }

  private subject(category: string): string {
    if (category === "birthday_reminder") return "PandaAtlas birthday reminder";
    if (category === "panda_news") return "PandaAtlas panda news";
    if (category === "venue_news") return "PandaAtlas venue news";
    return category === "correction" ? "PandaAtlas correction notice" : "PandaAtlas knowledge update";
  }

  private text(content: Record<string, unknown>): string {
    return `PandaAtlas notification\n\n${JSON.stringify(content, null, 2)}`;
  }
}
