import type { IntegrationConsumerQueue } from "./pgmq.service.js";

const ROUTES = new Map<string, readonly IntegrationConsumerQueue[]>([
  ["review.incorporation-recommended", ["integration_audit"]],
  ["publication.release.activated", ["integration_updates", "integration_audit"]],
  ["publication.release.rolled_back", ["integration_updates", "integration_audit"]],
  ["publication.release.suspended", ["integration_audit"]],
  ["publication.release.restored", ["integration_audit"]],
  ["publication.resource.taken_down", ["integration_notification", "integration_audit"]],
  ["publication.resource.restored", ["integration_notification", "integration_audit"]],
  ["updates.item.published", ["integration_notification", "integration_audit"]],
  ["notification.message.created", ["integration_audit"]],
  ["notification.provider.submitted", ["integration_audit"]],
  ["notification.provider.dead_lettered", ["integration_audit"]],
  ["privacy.request.created", ["integration_audit"]],
  ["privacy.request.completed", ["integration_audit"]],
  ["privacy.request.failed", ["integration_audit"]],
]);

export class IntegrationEventRouter {
  public queuesFor(eventType: string): readonly IntegrationConsumerQueue[] {
    return ROUTES.get(eventType) ?? [];
  }
}
