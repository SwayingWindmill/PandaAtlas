import type { JsonObject } from "../../../platform/database/database.notification.generated.js";
import type { DatabaseService, DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { PgmqMessage, PgmqService } from "../../../platform/integration/pgmq.service.js";
import type { EngagementNotificationAudiencePort } from "../../engagement/application/engagement-notification.port.js";
import type { IdentityNotificationContactPort } from "../../identity/application/identity-notification.port.js";
import type { NotificationCategory } from "../application/notification.application.js";

const CONSUMER_KEY = "notification.projector";
const QUEUE = "integration_notification" as const;

export interface NotificationConsumerResult {
  received: number;
  processed: number;
  duplicates: number;
  ignored: number;
  messages: number;
  providerJobs: number;
}

interface NotificationProjection {
  category: NotificationCategory;
  accountIds: string[];
  content: Record<string, unknown>;
}

export class NotificationEventConsumerService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly pgmq: PgmqService,
    private readonly audience: EngagementNotificationAudiencePort,
    private readonly contacts: IdentityNotificationContactPort,
  ) {}

  public async processBatch(limit = 25): Promise<NotificationConsumerResult> {
    const messages = await this.database.transaction((transaction) => this.pgmq.read(transaction, QUEUE, 60, limit));
    const result: NotificationConsumerResult = {
      received: messages.length,
      processed: 0,
      duplicates: 0,
      ignored: 0,
      messages: 0,
      providerJobs: 0,
    };
    for (const message of messages) {
      const outcome = await this.processMessage(message);
      result[outcome.kind] += 1;
      result.messages += outcome.messages;
      result.providerJobs += outcome.providerJobs;
    }
    return result;
  }

  private async processMessage(message: PgmqMessage): Promise<{
    kind: "processed" | "duplicates" | "ignored";
    messages: number;
    providerJobs: number;
  }> {
    const eventId = message.message.eventId;
    if (typeof eventId !== "string") throw new Error("Notification queue message is missing eventId");

    return this.database.transaction(async (transaction) => {
      const event = await this.outbox.load(transaction, eventId);
      if (event === undefined) throw new Error(`Outbox event ${eventId} does not exist`);
      const projection = await this.projectEvent(transaction, event.eventType, event.aggregateType, event.aggregateId, event.payload);
      const claimed = await this.pgmq.claimReceipt(
        transaction,
        CONSUMER_KEY,
        eventId,
        projection === undefined ? "ignored" : "processed",
      );
      if (!claimed) {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        return { kind: "duplicates", messages: 0, providerJobs: 0 };
      }
      if (projection === undefined) {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        return { kind: "ignored", messages: 0, providerJobs: 0 };
      }

      let messageCount = 0;
      let providerJobCount = 0;
      for (const accountId of projection.accountIds) {
        const inserted = await transaction
          .insertInto("notification.messages")
          .values({
            source_event_id: event.eventId,
            account_id: accountId,
            category: projection.category,
            content: projection.content as JsonObject,
            correlation_id: event.correlationId,
          })
          .onConflict((conflict) => conflict.columns(["source_event_id", "account_id"]).doNothing())
          .returning("message_id")
          .executeTakeFirst();
        if (inserted === undefined) continue;
        messageCount += 1;

        await transaction
          .insertInto("notification.message_channels")
          .values({ message_id: inserted.message_id, channel: "station", state: "ready" })
          .execute();

        const emailEnabled = await this.emailEnabled(transaction, accountId, projection.category);
        const email = emailEnabled ? await this.contacts.getDeliverableEmail(transaction, accountId) : undefined;
        if (email === undefined) {
          await transaction
            .insertInto("notification.message_channels")
            .values({
              message_id: inserted.message_id,
              channel: "email",
              state: "suppressed",
              suppression_reason: emailEnabled ? "email_unavailable" : "preference_disabled",
            })
            .execute();
        } else {
          await transaction
            .insertInto("notification.message_channels")
            .values({ message_id: inserted.message_id, channel: "email", state: "ready" })
            .execute();
          const job = await transaction
            .insertInto("notification.provider_jobs")
            .values({ message_id: inserted.message_id, correlation_id: event.correlationId })
            .returning("job_id")
            .executeTakeFirstOrThrow();
          await this.pgmq.sendMessage(transaction, "notification_provider", { jobId: job.job_id });
          providerJobCount += 1;
        }

        await this.outbox.append(transaction, {
          eventType: "notification.message.created",
          sourceContext: "notification",
          aggregateType: "notification_message",
          aggregateId: inserted.message_id,
          idempotencyKey: `message:${inserted.message_id}`,
          correlationId: event.correlationId,
          causationId: event.eventId,
          occurredAt: new Date(),
          payload: {
            messageId: inserted.message_id,
            accountId,
            category: projection.category,
            emailQueued: email !== undefined,
          },
        });
      }

      await this.pgmq.archive(transaction, QUEUE, message.msgId);
      return { kind: "processed", messages: messageCount, providerJobs: providerJobCount };
    });
  }

  private async projectEvent(
    transaction: DatabaseTransaction,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<NotificationProjection | undefined> {
    if (eventType === "updates.item.published") {
      const changedPandaIds = Array.isArray(payload.changedPandaIds)
        ? payload.changedPandaIds.filter((value): value is string => typeof value === "string")
        : [];
      return {
        category: "knowledge_update",
        accountIds: await this.audience.listAccountsFavoritingPandas(transaction, changedPandaIds),
        content: {
          kind: "knowledge_update",
          updateId: aggregateId,
          releaseId: payload.releaseId,
          releaseVersion: payload.releaseVersion,
          changedResourceCount: payload.changedResourceCount,
        },
      };
    }

    if (
      (eventType === "publication.resource.taken_down" || eventType === "publication.resource.restored") &&
      aggregateType === "panda"
    ) {
      return {
        category: "correction",
        accountIds: await this.audience.listAccountsFavoritingPandas(transaction, [aggregateId]),
        content: {
          kind: "publication_control",
          action: eventType === "publication.resource.taken_down" ? "taken_down" : "restored",
          resourceKind: aggregateType,
          resourceId: aggregateId,
        },
      };
    }

    return undefined;
  }

  private async emailEnabled(
    transaction: DatabaseTransaction,
    accountId: string,
    category: NotificationCategory,
  ): Promise<boolean> {
    const row = await transaction
      .selectFrom("notification.channel_preferences")
      .select("enabled")
      .where("account_id", "=", accountId)
      .where("category", "=", category)
      .where("channel", "=", "email")
      .executeTakeFirst();
    return row?.enabled === true;
  }
}
