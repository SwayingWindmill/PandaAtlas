import { sql, type Kysely } from "kysely";
import type { Database } from "../database/database.types.js";
import type { DatabaseTransaction } from "../database/database.service.js";

// A single statement does not need an explicit transaction. pg.Pool would
// otherwise send BEGIN and COMMIT around an empty queue poll.
export type PgmqExecutor = Kysely<Database> | DatabaseTransaction;

export type IntegrationConsumerQueue =
  | "integration_updates"
  | "integration_notification"
  | "integration_audit"
  | "integration_public_cache";

export type NotificationProviderQueue = "notification_provider" | "notification_provider_dlq";
export type PgmqQueue = IntegrationConsumerQueue | NotificationProviderQueue;

export interface PgmqMessage {
  msgId: string;
  readCount: number;
  message: Record<string, unknown>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// pgmq stores each queue in its own table. The names are a closed set, so the identifier is not input.
const QUEUE_TABLE = {
  integration_updates: "q_integration_updates",
  integration_notification: "q_integration_notification",
  integration_audit: "q_integration_audit",
  integration_public_cache: "q_integration_public_cache",
  notification_provider: "q_notification_provider",
  notification_provider_dlq: "q_notification_provider_dlq",
} as const satisfies Record<PgmqQueue, string>;

// The outbox event an integration-event message names, when it names a well-formed one.
export function queuedEventId(message: PgmqMessage): string | undefined {
  const eventId = message.message.eventId;
  return typeof eventId === "string" && UUID_PATTERN.test(eventId) ? eventId : undefined;
}

export class PgmqService {
  public async sendEvent(
    transaction: DatabaseTransaction,
    queue: IntegrationConsumerQueue,
    eventId: string,
  ): Promise<string> {
    return this.sendMessage(transaction, queue, { eventId });
  }

  public async sendMessage(
    transaction: DatabaseTransaction,
    queue: PgmqQueue,
    message: Record<string, unknown>,
    delaySeconds = 0,
  ): Promise<string> {
    const result = await sql<{ msg_id: string }>`
      select pgmq.send(${queue}::text, ${JSON.stringify(message)}::jsonb, ${delaySeconds}::integer)::text as msg_id
    `.execute(transaction);
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error("PGMQ did not return a message id");
    }
    return row.msg_id;
  }

  public async read(
    executor: PgmqExecutor,
    queue: PgmqQueue,
    visibilityTimeoutSeconds: number,
    limit: number,
  ): Promise<PgmqMessage[]> {
    // pgmq.read locks and rewrites visibility even when the queue is empty. The cron's
    // steady state is an empty queue, so an index probe on vt replaces that call.
    // A message that arrives after this probe waits for the next cycle.
    if (!(await this.hasVisibleMessage(executor, queue))) return [];
    const result = await sql<{
      msg_id: string;
      read_ct: number;
      message: Record<string, unknown>;
    }>`
      select msg_id::text, read_ct::int, message
      from pgmq.read(${queue}::text, ${visibilityTimeoutSeconds}::integer, ${limit}::integer, '{}'::jsonb)
    `.execute(executor);
    return result.rows.map((row) => ({
      msgId: row.msg_id,
      readCount: row.read_ct,
      message: row.message,
    }));
  }

  private async hasVisibleMessage(executor: PgmqExecutor, queue: PgmqQueue): Promise<boolean> {
    const table = QUEUE_TABLE[queue];
    const result = await sql<{ ready: boolean }>`
      select exists (
        select 1 from pgmq.${sql.raw(table)} where vt <= now() limit 1
      ) as ready
    `.execute(executor);
    return result.rows[0]?.ready === true;
  }

  public async archive(transaction: DatabaseTransaction, queue: PgmqQueue, msgId: string): Promise<void> {
    await sql`select pgmq.archive(${queue}::text, ${msgId}::bigint)`.execute(transaction);
  }

  public async setVisibility(
    transaction: DatabaseTransaction,
    queue: PgmqQueue,
    msgId: string,
    visibilityTimeoutSeconds: number,
  ): Promise<void> {
    await sql`select pgmq.set_vt(${queue}::text, ${msgId}::bigint, ${visibilityTimeoutSeconds}::integer)`.execute(transaction);
  }

  public async hasReceipt(transaction: DatabaseTransaction, consumerKey: string, eventId: string): Promise<boolean> {
    const receipt = await transaction
      .selectFrom("integration.consumer_receipts")
      .select("event_id")
      .where("consumer_key", "=", consumerKey)
      .where("event_id", "=", eventId)
      .executeTakeFirst();
    return receipt !== undefined;
  }

  public async claimReceipt(
    transaction: DatabaseTransaction,
    consumerKey: string,
    eventId: string,
    outcome = "processed",
  ): Promise<boolean> {
    const inserted = await transaction
      .insertInto("integration.consumer_receipts")
      .values({ consumer_key: consumerKey, event_id: eventId, outcome })
      .onConflict((conflict) => conflict.columns(["consumer_key", "event_id"]).doNothing())
      .returning("event_id")
      .executeTakeFirst();
    return inserted !== undefined;
  }
}
