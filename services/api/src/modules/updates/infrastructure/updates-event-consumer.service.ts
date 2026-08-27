import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { PgmqMessage, PgmqService } from "../../../platform/integration/pgmq.service.js";
import type { PublicationChangePort } from "../../publication/application/publication-change.port.js";

const CONSUMER_KEY = "updates.projector";
const QUEUE = "integration_updates" as const;

export interface UpdatesConsumerResult {
  received: number;
  processed: number;
  duplicates: number;
  ignored: number;
}

export class UpdatesEventConsumerService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly pgmq: PgmqService,
    private readonly publicationChanges: PublicationChangePort,
  ) {}

  public async processBatch(limit = 25): Promise<UpdatesConsumerResult> {
    const messages = await this.database.transaction((transaction) => this.pgmq.read(transaction, QUEUE, 60, limit));
    const result: UpdatesConsumerResult = { received: messages.length, processed: 0, duplicates: 0, ignored: 0 };
    for (const message of messages) {
      const outcome = await this.processMessage(message);
      result[outcome] += 1;
    }
    return result;
  }

  private async processMessage(message: PgmqMessage): Promise<"processed" | "duplicates" | "ignored"> {
    const eventId = message.message.eventId;
    if (typeof eventId !== "string") {
      throw new Error("Updates queue message is missing eventId");
    }

    return this.database.transaction(async (transaction) => {
      const event = await this.outbox.load(transaction, eventId);
      if (event === undefined) throw new Error(`Outbox event ${eventId} does not exist`);
      const supported =
        event.eventType === "publication.release.activated" || event.eventType === "publication.release.rolled_back";
      const claimed = await this.pgmq.claimReceipt(
        transaction,
        CONSUMER_KEY,
        eventId,
        supported ? "processed" : "ignored",
      );
      if (!claimed) {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        return "duplicates";
      }
      if (!supported) {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        return "ignored";
      }

      const rawPreviousReleaseId = event.payload.previousReleaseId;
      const previousReleaseId = typeof rawPreviousReleaseId === "string" ? rawPreviousReleaseId : undefined;
      const transition = await this.publicationChanges.describeTransition(
        transaction,
        event.aggregateId,
        previousReleaseId,
      );
      const updateType =
        event.eventType === "publication.release.rolled_back" ? "release_rolled_back" : "release_activated";
      const update = await transaction
        .insertInto("updates.items")
        .values({
          source_event_id: event.eventId,
          update_type: updateType,
          release_id: transition.releaseId,
          previous_release_id: transition.previousReleaseId ?? null,
          release_version: transition.releaseVersion,
          occurred_at: event.occurredAt,
          correlation_id: event.correlationId,
        })
        .returning("update_id")
        .executeTakeFirstOrThrow();

      if (transition.changes.length > 0) {
        await transaction
          .insertInto("updates.targets")
          .values(
            transition.changes.map((change) => ({
              update_id: update.update_id,
              resource_kind: change.resourceKind,
              resource_id: change.resourceId,
              change_type: change.changeType,
            })),
          )
          .execute();
      }

      const changedPandaIds = transition.changes
        .filter((change) => change.resourceKind === "panda")
        .map((change) => change.resourceId);
      await this.outbox.append(transaction, {
        eventType: "updates.item.published",
        sourceContext: "updates",
        aggregateType: "update",
        aggregateId: update.update_id,
        idempotencyKey: `publication-event:${event.eventId}`,
        correlationId: event.correlationId,
        causationId: event.eventId,
        occurredAt: new Date(),
        payload: {
          updateId: update.update_id,
          updateType,
          releaseId: transition.releaseId,
          previousReleaseId: transition.previousReleaseId ?? null,
          releaseVersion: transition.releaseVersion,
          changedPandaIds,
          changedResourceCount: transition.changes.length,
        },
      });
      await this.pgmq.archive(transaction, QUEUE, message.msgId);
      return "processed";
    });
  }
}
