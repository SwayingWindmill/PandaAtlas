import type { JsonObject } from "../../../platform/database/database.notification.generated.js";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { NotificationPrivacyPort } from "../application/notification-privacy.port.js";

export class PostgresNotificationPrivacyQuery implements NotificationPrivacyPort {
  public async exportPrivacySubject(
    transaction: DatabaseTransaction,
    accountId: string,
  ): Promise<Record<string, unknown>> {
    const [preferences, messages] = await Promise.all([
      transaction
        .selectFrom("notification.channel_preferences")
        .select(["category", "channel", "enabled", "version", "updated_at"])
        .where("account_id", "=", accountId)
        .orderBy("category")
        .orderBy("channel")
        .execute(),
      transaction
        .selectFrom("notification.messages")
        .select(["message_id", "category", "content", "created_at", "seen_at", "read_at"])
        .where("account_id", "=", accountId)
        .orderBy("created_at")
        .execute(),
    ]);
    return {
      preferences: preferences.map((row) => ({
        category: row.category,
        channel: row.channel,
        enabled: row.enabled,
        version: row.version,
        updatedAt: row.updated_at.toISOString(),
      })),
      messages: messages.map((row) => ({
        messageId: row.message_id,
        category: row.category,
        content: row.content,
        createdAt: row.created_at.toISOString(),
        seenAt: row.seen_at?.toISOString() ?? null,
        readAt: row.read_at?.toISOString() ?? null,
      })),
    };
  }

  public async erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void> {
    const messages = await transaction
      .selectFrom("notification.messages")
      .select("message_id")
      .where("account_id", "=", accountId)
      .execute();
    const messageIds = messages.map((row) => row.message_id);
    await transaction.deleteFrom("notification.channel_preferences").where("account_id", "=", accountId).execute();
    if (messageIds.length === 0) return;

    const now = new Date();
    await transaction
      .updateTable("notification.messages")
      .set({ content: { erased: true } as JsonObject })
      .where("message_id", "in", messageIds)
      .execute();
    await transaction
      .updateTable("notification.provider_jobs")
      .set({
        state: "suppressed",
        suppressed_at: now,
        updated_at: now,
        last_error_code: "privacy_erased",
      })
      .where("message_id", "in", messageIds)
      .where("state", "in", ["pending", "retrying"])
      .execute();
    await transaction
      .updateTable("notification.message_channels")
      .set({ state: "suppressed", suppression_reason: "privacy_erased", updated_at: now })
      .where("message_id", "in", messageIds)
      .where("channel", "=", "email")
      .where("state", "in", ["ready"])
      .execute();
  }
}
