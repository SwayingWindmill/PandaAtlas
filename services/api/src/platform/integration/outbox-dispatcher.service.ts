import { sql } from "kysely";
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

    if (!(await this.hasPending())) return { dispatched: 0, queueMessages: 0 };

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

  // An empty outbox is the steady state. Peeking avoids BEGIN/COMMIT around a
  // lock that would return no rows.
  private async hasPending(): Promise<boolean> {
    const row = await this.database.db
      .selectFrom("integration.outbox_events")
      .select("event_id")
      .where("published_at", "is", null)
      .where("available_at", "<=", sql<Date>`now()`)
      .limit(1)
      .executeTakeFirst();
    return row !== undefined;
  }
}
