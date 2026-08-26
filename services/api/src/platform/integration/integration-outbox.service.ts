import { sql } from "kysely";
import type { DatabaseTransaction } from "../database/database.service.js";
import type { JsonObject } from "../database/database.integration.generated.js";

export interface IntegrationEventInput {
  eventType: string;
  eventVersion?: number;
  sourceContext: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion?: number;
  idempotencyKey: string;
  correlationId: string;
  causationId?: string;
  occurredAt: Date;
  payload: JsonObject;
}

export class IntegrationOutboxService {
  public async append(
    transaction: DatabaseTransaction,
    event: IntegrationEventInput,
  ): Promise<string> {
    const row = await transaction
      .insertInto("integration.outbox_events")
      .values({
        event_type: event.eventType,
        event_version: event.eventVersion ?? 1,
        source_context: event.sourceContext,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        aggregate_version: event.aggregateVersion?.toString() ?? null,
        idempotency_key: event.idempotencyKey,
        correlation_id: event.correlationId,
        causation_id: event.causationId ?? null,
        occurred_at: event.occurredAt,
        payload: event.payload,
      })
      .returning("event_id")
      .executeTakeFirstOrThrow();
    return row.event_id;
  }

  public async markPublished(transaction: DatabaseTransaction, eventId: string): Promise<void> {
    await transaction
      .updateTable("integration.outbox_events")
      .set({ published_at: sql`greatest(now(), occurred_at)` })
      .where("event_id", "=", eventId)
      .executeTakeFirstOrThrow();
  }
}
