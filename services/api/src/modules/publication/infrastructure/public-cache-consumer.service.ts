import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { PgmqService } from "../../../platform/integration/pgmq.service.js";
import type { PublicCachePort } from "../application/public-cache.port.js";

const CONSUMER_KEY = "publication.public-cache";
const QUEUE = "integration_public_cache" as const;

export interface PublicCacheConsumerResult {
  received: number;
  purged: boolean;
  duplicates: number;
}

// Every queued delivery change is covered by one purge. Messages are archived only after the purge
// succeeds, so a failed purge is retried once their visibility timeout expires.
export class PublicCacheConsumerService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly pgmq: PgmqService,
  ) {}

  public async processBatch(publicCache: PublicCachePort, limit = 25): Promise<PublicCacheConsumerResult> {
    const messages = await this.database.transaction((transaction) => this.pgmq.read(transaction, QUEUE, 120, limit));
    if (messages.length === 0) return { received: 0, purged: false, duplicates: 0 };

    await publicCache.purge();
    let duplicates = 0;
    await this.database.transaction(async (transaction) => {
      for (const message of messages) {
        const eventId = message.message.eventId;
        if (typeof eventId !== "string") throw new Error("Public cache queue message is missing eventId");
        if (!(await this.pgmq.claimReceipt(transaction, CONSUMER_KEY, eventId))) duplicates += 1;
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
      }
    });
    return { received: messages.length, purged: true, duplicates };
  }
}
