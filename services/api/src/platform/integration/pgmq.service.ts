import { sql } from "kysely";
import type { DatabaseTransaction } from "../database/database.service.js";

export type IntegrationConsumerQueue =
  | "integration_updates"
  | "integration_notification"
  | "integration_audit";

export type NotificationProviderQueue = "notification_provider" | "notification_provider_dlq";
export type PgmqQueue = IntegrationConsumerQueue | NotificationProviderQueue;

export interface PgmqMessage {
  msgId: string;
  readCount: number;
  message: Record<string, unknown>;
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
    transaction: DatabaseTransaction,
    queue: PgmqQueue,
    visibilityTimeoutSeconds: number,
    limit: number,
  ): Promise<PgmqMessage[]> {
    const result = await sql<{
      msg_id: string;
      read_ct: number;
      message: Record<string, unknown>;
    }>`
      select msg_id::text, read_ct::int, message
      from pgmq.read(${queue}::text, ${visibilityTimeoutSeconds}::integer, ${limit}::integer, '{}'::jsonb)
    `.execute(transaction);
    return result.rows.map((row) => ({
      msgId: row.msg_id,
      readCount: row.read_ct,
      message: row.message,
    }));
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
