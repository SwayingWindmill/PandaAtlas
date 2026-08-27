import type { JsonObject } from "../database/database.integration.generated.js";

export interface IntegrationEvent {
  eventId: string;
  eventType: string;
  eventVersion: number;
  sourceContext: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion?: number;
  correlationId: string;
  causationId?: string;
  occurredAt: Date;
  payload: JsonObject;
}
