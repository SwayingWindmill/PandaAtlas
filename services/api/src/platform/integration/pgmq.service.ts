import { sql } from "kysely";
import type { DatabaseTransaction } from "../database/database.service.js";

export type IntegrationConsumerQueue =
  | "integration_updates"
  | "integration_notification"
  | "integration_audit";

export class PgmqService {
  public async sendEvent(
    transaction: DatabaseTransaction,
    queue: IntegrationConsumerQueue,
    eventId: string,
  ): Promise<string> {
    const result = await sql<{ msg_id: string }>`
      select pgmq.send(${queue}, jsonb_build_object('eventId', ${eventId}::text))::text as msg_id
    `.execute(transaction);
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error("PGMQ did not return a message id");
    }
    return row.msg_id;
  }

  public async recordReceipt(
    transaction: DatabaseTransaction,
    consumerKey: string,
    eventId: string,
    outcome = "processed",
  ): Promise<void> {
    await transaction
      .insertInto("integration.consumer_receipts")
      .values({ consumer_key: consumerKey, event_id: eventId, outcome })
      .onConflict((conflict) => conflict.columns(["consumer_key", "event_id"]).doNothing())
      .execute();
  }
}
