import { sql } from "kysely";
import type { DatabaseTransaction } from "../database/database.service.js";
import type { JsonObject, JsonValue } from "../database/database.integration.generated.js";
import type { IntegrationEvent } from "./integration-event.types.js";

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

  public async load(transaction: DatabaseTransaction, eventId: string): Promise<IntegrationEvent | undefined> {
    const row = await transaction
      .selectFrom("integration.outbox_events")
      .select([
        "event_id",
        "event_type",
        "event_version",
        "source_context",
        "aggregate_type",
        "aggregate_id",
        "aggregate_version",
        "correlation_id",
        "causation_id",
        "occurred_at",
        "payload",
      ])
      .where("event_id", "=", eventId)
      .executeTakeFirst();
    return row === undefined ? undefined : this.mapEvent(row);
  }

  public async lockPending(
    transaction: DatabaseTransaction,
    limit: number,
  ): Promise<IntegrationEvent[]> {
    const rows = await transaction
      .selectFrom("integration.outbox_events")
      .select([
        "event_id",
        "event_type",
        "event_version",
        "source_context",
        "aggregate_type",
        "aggregate_id",
        "aggregate_version",
        "correlation_id",
        "causation_id",
        "occurred_at",
        "payload",
      ])
      .where("published_at", "is", null)
      .where("available_at", "<=", new Date())
      .orderBy("available_at")
      .orderBy("occurred_at")
      .orderBy("event_id")
      .limit(limit)
      .forUpdate()
      .skipLocked()
      .execute();
    return rows.map((row) => this.mapEvent(row));
  }

  public async markPublished(transaction: DatabaseTransaction, eventId: string): Promise<void> {
    await transaction
      .updateTable("integration.outbox_events")
      .set({ published_at: sql`greatest(now(), occurred_at)` })
      .where("event_id", "=", eventId)
      .executeTakeFirstOrThrow();
  }

  private mapEvent(row: {
    event_id: string;
    event_type: string;
    event_version: number;
    source_context: string;
    aggregate_type: string;
    aggregate_id: string;
    aggregate_version: string | null;
    correlation_id: string;
    causation_id: string | null;
    occurred_at: Date;
    payload: JsonValue;
  }): IntegrationEvent {
    return {
      eventId: row.event_id,
      eventType: row.event_type,
      eventVersion: row.event_version,
      sourceContext: row.source_context,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      ...(row.aggregate_version === null ? {} : { aggregateVersion: Number(row.aggregate_version) }),
      correlationId: row.correlation_id,
      ...(row.causation_id === null ? {} : { causationId: row.causation_id }),
      occurredAt: row.occurred_at,
      payload: row.payload as JsonObject,
    };
  }
}
