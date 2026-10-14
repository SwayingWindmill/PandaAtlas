import type { JsonObject } from "../database/database.integration.generated.js";
import type { DatabaseService, DatabaseTransaction } from "../database/database.service.js";
import { serializeError, type StructuredLoggerService } from "../observability/structured-logger.service.js";
import type { IntegrationEvent } from "./integration-event.types.js";
import type { IntegrationOutboxService } from "./integration-outbox.service.js";
import type { IntegrationConsumerQueue, PgmqMessage, PgmqService } from "./pgmq.service.js";

// A message that fails this many reads is dead-lettered instead of retried again.
export const MAX_DELIVERY_ATTEMPTS = 5;

export interface IntegrationEventHandled {
  outcome: "processed" | "ignored";
  counts?: Record<string, number>;
}

export interface IntegrationEventConsumerDefinition {
  consumerKey: string;
  queue: IntegrationConsumerQueue;
  visibilityTimeoutSeconds: number;
  // Runs in the delivery's transaction, before the receipt is recorded and the message archived.
  handle(transaction: DatabaseTransaction, event: IntegrationEvent): Promise<IntegrationEventHandled>;
}

export interface IntegrationEventBatchResult {
  received: number;
  processed: number;
  ignored: number;
  duplicates: number;
  failed: number;
  deadLettered: number;
  counts: Record<string, number>;
}

// Delivers one consumer's queued integration events at least once. Each message is handled in its
// own transaction, so a failing message rolls back alone: it is retried once its visibility timeout
// expires, and dead-lettered after MAX_DELIVERY_ATTEMPTS reads.
export class IntegrationEventConsumer {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly pgmq: PgmqService,
    private readonly logger: Pick<StructuredLoggerService, "write">,
  ) {}

  public async processBatch(
    definition: IntegrationEventConsumerDefinition,
    limit: number,
  ): Promise<IntegrationEventBatchResult> {
    const messages = await this.database.transaction((transaction) =>
      this.pgmq.read(transaction, definition.queue, definition.visibilityTimeoutSeconds, limit),
    );
    const result: IntegrationEventBatchResult = {
      received: messages.length,
      processed: 0,
      ignored: 0,
      duplicates: 0,
      failed: 0,
      deadLettered: 0,
      counts: {},
    };
    for (const message of messages) {
      try {
        const delivered = await this.deliver(definition, message);
        if (delivered === "duplicate") {
          result.duplicates += 1;
          continue;
        }
        result[delivered.outcome] += 1;
        for (const [key, count] of Object.entries(delivered.counts ?? {})) {
          result.counts[key] = (result.counts[key] ?? 0) + count;
        }
      } catch (error) {
        const deadLettered = message.readCount >= MAX_DELIVERY_ATTEMPTS;
        this.logger.write(deadLettered ? "error" : "warn", "Integration event delivery failed", {
          consumerKey: definition.consumerKey,
          queue: definition.queue,
          msgId: message.msgId,
          readCount: message.readCount,
          deadLettered,
          error: serializeError(error),
        });
        if (deadLettered) {
          await this.deadLetter(definition, message, error);
          result.deadLettered += 1;
        } else {
          result.failed += 1;
        }
      }
    }
    return result;
  }

  private deliver(
    definition: IntegrationEventConsumerDefinition,
    message: PgmqMessage,
  ): Promise<IntegrationEventHandled | "duplicate"> {
    const eventId = message.message.eventId;
    if (typeof eventId !== "string") {
      return Promise.reject(new Error(`Queue message ${message.msgId} is missing eventId`));
    }
    return this.database.transaction(async (transaction) => {
      const event = await this.outbox.load(transaction, eventId);
      if (event === undefined) throw new Error(`Outbox event ${eventId} does not exist`);
      if (await this.pgmq.hasReceipt(transaction, definition.consumerKey, eventId)) {
        await this.pgmq.archive(transaction, definition.queue, message.msgId);
        return "duplicate" as const;
      }
      const handled = await definition.handle(transaction, event);
      // A concurrent delivery recorded the receipt first; roll this one back.
      if (!(await this.pgmq.claimReceipt(transaction, definition.consumerKey, eventId, handled.outcome))) {
        throw new Error(`Event ${eventId} was delivered concurrently to ${definition.consumerKey}`);
      }
      await this.pgmq.archive(transaction, definition.queue, message.msgId);
      return handled;
    });
  }

  private async deadLetter(
    definition: IntegrationEventConsumerDefinition,
    message: PgmqMessage,
    error: unknown,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction
        .insertInto("integration.dead_letters")
        .values({
          consumer_key: definition.consumerKey,
          queue_name: definition.queue,
          msg_id: message.msgId,
          read_count: message.readCount,
          message: message.message as JsonObject,
          error: error instanceof Error ? error.message : String(error),
        })
        .onConflict((conflict) => conflict.columns(["queue_name", "msg_id"]).doNothing())
        .execute();
      await this.pgmq.archive(transaction, definition.queue, message.msgId);
    });
  }
}
