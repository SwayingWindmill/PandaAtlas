import type { DatabaseService } from "../../../platform/database/database.service.js";
import { queuedEventId, type PgmqService } from "../../../platform/integration/pgmq.service.js";
import type { PublicCachePort } from "../application/public-cache.port.js";
import type { PublicReadCache } from "./public-read-cache.js";

const CONSUMER_KEY = "publication.public-cache";
const QUEUE = "integration_public_cache" as const;

export interface PublicCacheConsumerResult {
  received: number;
  purged: boolean;
  duplicates: number;
}

// Every queued delivery change is covered by one purge. Messages are archived only after the purge
// succeeds, so a failed purge is retried once their visibility timeout expires. A message that names
// no event is covered by the purge too, so it is archived without a receipt rather than blocking.
export class PublicCacheConsumerService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly pgmq: PgmqService,
    private readonly publicReadCache: PublicReadCache,
  ) {}

  public async processBatch(publicCache: PublicCachePort, limit = 25): Promise<PublicCacheConsumerResult> {
    const messages = await this.pgmq.read(this.database.db, QUEUE, 120, limit);
    if (messages.length === 0) return { received: 0, purged: false, duplicates: 0 };

    // Drop cached public reads before the edge purge, so the render that refills
    // the page cache cannot store the release that was just replaced.
    await this.publicReadCache.invalidate();
    await publicCache.purge();
    let duplicates = 0;
    await this.database.transaction(async (transaction) => {
      for (const message of messages) {
        const eventId = queuedEventId(message);
        if (eventId !== undefined && !(await this.pgmq.claimReceipt(transaction, CONSUMER_KEY, eventId))) {
          duplicates += 1;
        }
        await this.pgmq.archive(transaction, QUEUE, message.msgId);
      }
    });
    return { received: messages.length, purged: true, duplicates };
  }
}
