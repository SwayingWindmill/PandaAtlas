import type { JsonObject } from "../../../platform/database/database.notification.generated.js";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type {
  IntegrationEventBatchResult,
  IntegrationEventConsumer,
  IntegrationEventConsumerDefinition,
  IntegrationEventHandled,
} from "../../../platform/integration/integration-event-consumer.js";
import type { IntegrationEvent } from "../../../platform/integration/integration-event.types.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { PgmqService } from "../../../platform/integration/pgmq.service.js";
import type { EngagementNotificationAudiencePort } from "../../engagement/application/engagement-notification.port.js";
import type { IdentityNotificationContactPort } from "../../identity/application/identity-notification.port.js";
import {
  defaultChannelEnabled,
  type NotificationCategory,
  type NotificationChannel,
} from "../application/notification.application.js";

interface NotificationProjection {
  category: NotificationCategory;
  accountIds: string[];
  content: Record<string, unknown>;
}

function stringArray(value: unknown, fallback?: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  return typeof fallback === "string" && fallback.trim() !== "" ? [fallback] : [];
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export class NotificationEventConsumerService {
  private readonly definition: IntegrationEventConsumerDefinition = {
    consumerKey: "notification.projector",
    queue: "integration_notification",
    handle: (transaction, event) => this.project(transaction, event),
  };

  public constructor(
    private readonly consumer: IntegrationEventConsumer,
    private readonly outbox: IntegrationOutboxService,
    private readonly pgmq: PgmqService,
    private readonly audience: EngagementNotificationAudiencePort,
    private readonly contacts: IdentityNotificationContactPort,
  ) {}

  public processBatch(limit = 25): Promise<IntegrationEventBatchResult> {
    return this.consumer.processBatch(this.definition, limit);
  }

  private async project(transaction: DatabaseTransaction, event: IntegrationEvent): Promise<IntegrationEventHandled> {
    const projection = await this.projectEvent(transaction, event.eventType, event.aggregateType, event.aggregateId, event.payload);
    if (projection === undefined) return { outcome: "ignored" };

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

      const emailQueued = await this.projectExternalChannel(transaction, {
        messageId: inserted.message_id,
        accountId,
        category: projection.category,
        channel: "email",
        correlationId: event.correlationId,
        unavailableReason: "email_unavailable",
        hasDestination: async (enabled) =>
          enabled && (await this.contacts.getDeliverableEmail(transaction, accountId)) !== undefined,
      });
      const pushQueued = await this.projectExternalChannel(transaction, {
        messageId: inserted.message_id,
        accountId,
        category: projection.category,
        channel: "push",
        correlationId: event.correlationId,
        unavailableReason: "device_token_unavailable",
        hasDestination: async (enabled) => enabled && (await this.hasActiveDeviceToken(transaction, accountId)),
      });
      providerJobCount += Number(emailQueued) + Number(pushQueued);

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
          emailQueued,
          pushQueued,
        },
      });
    }
    return { outcome: "processed", counts: { messages: messageCount, providerJobs: providerJobCount } };
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

    if (eventType === "notification.birthday.due") {
      const pandaId = optionalText(payload.pandaId) ?? aggregateId;
      return {
        category: "birthday_reminder",
        accountIds: await this.audience.listAccountsFavoritingPandas(transaction, [pandaId]),
        content: {
          kind: "birthday_reminder",
          pandaId,
          ...(optionalText(payload.pandaSlug) ? { pandaSlug: payload.pandaSlug } : {}),
          ...(optionalText(payload.pandaName) ? { pandaName: payload.pandaName } : {}),
          ...(optionalText(payload.birthdayDate) ? { birthdayDate: payload.birthdayDate } : {}),
          ...(typeof payload.age === "number" ? { age: payload.age } : {}),
          ...(typeof payload.leadDays === "number" ? { leadDays: payload.leadDays } : {}),
        },
      };
    }

    if (eventType === "news.panda_item.published") {
      const pandaIds = stringArray(payload.pandaIds, payload.pandaId);
      const [firstPandaId] = pandaIds;
      if (firstPandaId === undefined) return undefined;
      const pandaId = optionalText(payload.pandaId) ?? firstPandaId;
      return {
        category: "panda_news",
        accountIds: await this.audience.listAccountsFavoritingPandas(transaction, pandaIds),
        content: {
          kind: "panda_news",
          newsItemId: aggregateId,
          pandaId,
          ...(optionalText(payload.pandaSlug) ? { pandaSlug: payload.pandaSlug } : {}),
          ...(optionalText(payload.pandaName) ? { pandaName: payload.pandaName } : {}),
          ...(optionalText(payload.title) ? { title: payload.title } : {}),
          ...(optionalText(payload.summary) ? { summary: payload.summary } : {}),
          ...(optionalText(payload.sourceUrl) ? { sourceUrl: payload.sourceUrl } : {}),
        },
      };
    }

    if (eventType === "news.venue_item.published") {
      const institutionIds = stringArray(payload.institutionIds, payload.institutionId);
      const [firstInstitutionId] = institutionIds;
      if (firstInstitutionId === undefined) return undefined;
      const institutionId = optionalText(payload.institutionId) ?? firstInstitutionId;
      return {
        category: "venue_news",
        accountIds: await this.audience.listAccountsFollowingInstitutions(transaction, institutionIds),
        content: {
          kind: "venue_news",
          newsItemId: aggregateId,
          institutionId,
          ...(optionalText(payload.institutionSlug) ? { institutionSlug: payload.institutionSlug } : {}),
          ...(optionalText(payload.institutionName) ? { institutionName: payload.institutionName } : {}),
          ...(optionalText(payload.title) ? { title: payload.title } : {}),
          ...(optionalText(payload.summary) ? { summary: payload.summary } : {}),
          ...(optionalText(payload.sourceUrl) ? { sourceUrl: payload.sourceUrl } : {}),
        },
      };
    }

    return undefined;
  }

  private async projectExternalChannel(
    transaction: DatabaseTransaction,
    input: {
      messageId: string;
      accountId: string;
      category: NotificationCategory;
      channel: Extract<NotificationChannel, "email" | "push">;
      correlationId: string;
      unavailableReason: string;
      hasDestination: (enabled: boolean) => Promise<boolean>;
    },
  ): Promise<boolean> {
    const enabled = await this.channelEnabled(transaction, input.accountId, input.category, input.channel);
    const deliverable = await input.hasDestination(enabled);
    if (!deliverable) {
      await transaction
        .insertInto("notification.message_channels")
        .values({
          message_id: input.messageId,
          channel: input.channel,
          state: "suppressed",
          suppression_reason: enabled ? input.unavailableReason : "preference_disabled",
        })
        .execute();
      return false;
    }

    await transaction
      .insertInto("notification.message_channels")
      .values({ message_id: input.messageId, channel: input.channel, state: "ready" })
      .execute();
    const job = await transaction
      .insertInto("notification.provider_jobs")
      .values({ message_id: input.messageId, channel: input.channel, correlation_id: input.correlationId })
      .returning("job_id")
      .executeTakeFirstOrThrow();
    await this.pgmq.sendMessage(transaction, "notification_provider", { jobId: job.job_id });
    return true;
  }

  private async channelEnabled(
    transaction: DatabaseTransaction,
    accountId: string,
    category: NotificationCategory,
    channel: Extract<NotificationChannel, "email" | "push">,
  ): Promise<boolean> {
    const row = await transaction
      .selectFrom("notification.channel_preferences")
      .select("enabled")
      .where("account_id", "=", accountId)
      .where("category", "=", category)
      .where("channel", "=", channel)
      .executeTakeFirst();
    return row?.enabled ?? defaultChannelEnabled(channel);
  }

  private async hasActiveDeviceToken(transaction: DatabaseTransaction, accountId: string): Promise<boolean> {
    const row = await transaction
      .selectFrom("notification.device_tokens")
      .select("device_token_id")
      .where("account_id", "=", accountId)
      .where("active", "=", true)
      .limit(1)
      .executeTakeFirst();
    return row !== undefined;
  }
}
