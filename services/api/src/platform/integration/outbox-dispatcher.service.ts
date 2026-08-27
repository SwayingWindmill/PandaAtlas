import type { DatabaseService } from "../database/database.service.js";
import type { IntegrationEventRouter } from "./integration-event-router.js";
import type { IntegrationOutboxService } from "./integration-outbox.service.js";
import type { PgmqService } from "./pgmq.service.js";

export interface OutboxDispatchResult {
  dispatched: number;
  queueMessages: number;
}

export class OutboxDispatcherService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly pgmq: PgmqService,
    private readonly router: IntegrationEventRouter,
  ) {}

  public async dispatchBatch(limit = 50): Promise<OutboxDispatchResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new Error("Outbox dispatch limit must be an integer between 1 and 200");
    }

    return this.database.transaction(async (transaction) => {
      const events = await this.outbox.lockPending(transaction, limit);
      let queueMessages = 0;
      for (const event of events) {
        for (const queue of this.router.queuesFor(event.eventType)) {
          await this.pgmq.sendEvent(transaction, queue, event.eventId);
          queueMessages += 1;
        }
        await this.outbox.markPublished(transaction, event.eventId);
      }
      return { dispatched: events.length, queueMessages };
    });
  }
}
