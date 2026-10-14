import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type {
  IntegrationEventBatchResult,
  IntegrationEventConsumer,
  IntegrationEventConsumerDefinition,
  IntegrationEventHandled,
} from "../../../platform/integration/integration-event-consumer.js";
import type { IntegrationEvent } from "../../../platform/integration/integration-event.types.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { PublicationChangePort } from "../../publication/application/publication-change.port.js";

const PROJECTED_EVENT_TYPES = new Set(["publication.release.activated", "publication.release.rolled_back"]);

export class UpdatesEventConsumerService {
  private readonly definition: IntegrationEventConsumerDefinition = {
    consumerKey: "updates.projector",
    queue: "integration_updates",
    handle: (transaction, event) => this.project(transaction, event),
  };

  public constructor(
    private readonly consumer: IntegrationEventConsumer,
    private readonly outbox: IntegrationOutboxService,
    private readonly publicationChanges: PublicationChangePort,
  ) {}

  public processBatch(limit = 25): Promise<IntegrationEventBatchResult> {
    return this.consumer.processBatch(this.definition, limit);
  }

  private async project(transaction: DatabaseTransaction, event: IntegrationEvent): Promise<IntegrationEventHandled> {
    if (!PROJECTED_EVENT_TYPES.has(event.eventType)) return { outcome: "ignored" };

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
    return { outcome: "processed" };
  }
}
