import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type {
  IntegrationEventBatchResult,
  IntegrationEventConsumer,
  IntegrationEventConsumerDefinition,
  IntegrationEventHandled,
} from "../../../platform/integration/integration-event-consumer.js";
import type { IntegrationEvent } from "../../../platform/integration/integration-event.types.js";

export class AuditEventConsumerService {
  private readonly definition: IntegrationEventConsumerDefinition = {
    consumerKey: "audit.projector",
    queue: "integration_audit",
    visibilityTimeoutSeconds: 60,
    handle: (transaction, event) => this.project(transaction, event),
  };

  public constructor(private readonly consumer: IntegrationEventConsumer) {}

  public processBatch(limit = 50): Promise<IntegrationEventBatchResult> {
    return this.consumer.processBatch(this.definition, limit);
  }

  private async project(transaction: DatabaseTransaction, event: IntegrationEvent): Promise<IntegrationEventHandled> {
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
    return { outcome: "processed" };
  }
}
