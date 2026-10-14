import type { JsonObject } from "../database/database.integration.generated.js";
import type { DatabaseService, DatabaseTransaction } from "../database/database.service.js";
import { serializeError, type StructuredLoggerService } from "../observability/structured-logger.service.js";
import type { IntegrationEvent } from "./integration-event.types.js";
import type { IntegrationOutboxService } from "./integration-outbox.service.js";
import { queuedEventId, type IntegrationConsumerQueue, type PgmqMessage, type PgmqService } from "./pgmq.service.js";

// A message that fails this many reads is dead-lettered instead of retried again. With one read per
// five-minute cycle, that is about twenty minutes of retries.
export const MAX_DELIVERY_ATTEMPTS = 5;
// Longer than one delivery, shorter than the cycle interval, so a failed message is retried next cycle.
const VISIBILITY_TIMEOUT_SECONDS = 60;

export interface IntegrationEventHandled {
  outcome: "processed" | "ignored";
  // Consumer-specific tallies, summed over the batch for the cycle log.
  counts?: Record<string, number>;
}

export interface IntegrationEventConsumerDefinition {
  consumerKey: string;
  queue: IntegrationConsumerQueue;
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

// A message no retry can deliver: it names no event, or an event that does not exist.
class UndeliverableMessageError extends Error {}

// Delivers one consumer's queued integration events at least once. Each message is handled in its
// own transaction, so a failing message rolls back alone. It is retried once its visibility timeout
// expires and dead-lettered after MAX_DELIVERY_ATTEMPTS reads; an undeliverable message is
// dead-lettered at once.
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
      this.pgmq.read(transaction, definition.queue, VISIBILITY_TIMEOUT_SECONDS, limit),
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
      let delivered: IntegrationEventHandled | "duplicate";
      try {
        delivered = await this.deliver(definition, message);
      } catch (error) {
        const fields = {
          consumerKey: definition.consumerKey,
          queue: definition.queue,
          msgId: message.msgId,
          readCount: message.readCount,
          error: serializeError(error),
        };
        if (error instanceof UndeliverableMessageError || message.readCount >= MAX_DELIVERY_ATTEMPTS) {
          await this.deadLetter(definition, message, error);
          this.logger.write("error", "Integration event dead-lettered", fields);
          result.deadLettered += 1;
        } else {
          this.logger.write("warn", "Integration event delivery failed; it will be retried", fields);
          result.failed += 1;
        }
        continue;
      }
      if (delivered === "duplicate") {
        result.duplicates += 1;
        continue;
      }
      result[delivered.outcome] += 1;
      for (const [key, count] of Object.entries(delivered.counts ?? {})) {
        result.counts[key] = (result.counts[key] ?? 0) + count;
      }
    }
    return result;
  }

  private async deliver(
    definition: IntegrationEventConsumerDefinition,
    message: PgmqMessage,
  ): Promise<IntegrationEventHandled | "duplicate"> {
    const eventId = queuedEventId(message);
    if (eventId === undefined) {
      throw new UndeliverableMessageError(`Queue message ${message.msgId} names no outbox event`);
    }
    return this.database.transaction(async (transaction) => {
      const event = await this.outbox.load(transaction, eventId);
      if (event === undefined) throw new UndeliverableMessageError(`Outbox event ${eventId} does not exist`);
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
    const reason = error instanceof Error ? error.message || error.name : String(error);
    await this.database.transaction(async (transaction) => {
      await transaction
        .insertInto("integration.dead_letters")
        .values({
          consumer_key: definition.consumerKey,
          queue_name: definition.queue,
          msg_id: message.msgId,
          event_id: queuedEventId(message) ?? null,
          read_count: message.readCount,
          message: message.message as JsonObject,
          error: reason.trim() === "" ? "Delivery failed without an error message" : reason,
        })
        .onConflict((conflict) => conflict.columns(["queue_name", "msg_id"]).doNothing())
        .execute();
      await this.pgmq.archive(transaction, definition.queue, message.msgId);
    });
  }
}
