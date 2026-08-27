import type { DatabaseService } from "../../../platform/database/database.service.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { PgmqMessage, PgmqService } from "../../../platform/integration/pgmq.service.js";

const CONSUMER_KEY = "audit.projector";
const QUEUE = "integration_audit" as const;

export interface AuditConsumerResult {
  received: number;
  processed: number;
  duplicates: number;
}

export class AuditEventConsumerService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly pgmq: PgmqService,
  ) {}

  public async processBatch(limit = 50): Promise<AuditConsumerResult> {
    const messages = await this.database.transaction((transaction) => this.pgmq.read(transaction, QUEUE, 60, limit));
    const result: AuditConsumerResult = { received: messages.length, processed: 0, duplicates: 0 };
    for (const message of messages) {
      const outcome = await this.processMessage(message);
      result[outcome] += 1;
    }
    return result;
  }

  private async processMessage(message: PgmqMessage): Promise<"processed" | "duplicates"> {
    const eventId = message.message.eventId;
    if (typeof eventId !== "string") throw new Error("Audit queue message is missing eventId");
    return this.database.transaction(async (transaction) => {
      const event = await this.outbox.load(transaction, eventId);
      if (event === undefined) throw new Error(`Outbox event ${eventId} does not exist`);
      const claimed = await this.pgmq.claimReceipt(transaction, CONSUMER_KEY, eventId);
      if (!claimed) {
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
        return "duplicates";
      }
      await transaction
        .insertInto("audit.evidence_events")
        .values({
          source_event_id: event.eventId,
          source_context: event.sourceContext,
          event_type: event.eventType,
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId,
          correlation_id: event.correlationId,
          occurred_at: event.occurredAt,
          payload_sha256: sha256Content(event.payload),
        })
        .execute();
      await this.pgmq.archive(transaction, QUEUE, message.msgId);
      return "processed";
    });
  }
}
