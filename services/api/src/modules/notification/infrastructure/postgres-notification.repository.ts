import { sql } from "kysely";
import type { JsonValue } from "../../../platform/database/database.notification.generated.js";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationMessage,
  NotificationPreference,
  NotificationRepository,
} from "../application/notification.application.js";

const CATEGORIES: readonly NotificationCategory[] = ["knowledge_update", "correction"];
const CHANNELS: readonly NotificationChannel[] = ["station", "email"];

function defaultEnabled(channel: NotificationChannel): boolean {
  return channel === "station";
}

export class PostgresNotificationRepository implements NotificationRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async listMessages(accountId: string, limit: number): Promise<NotificationMessage[]> {
    const rows = await this.database.db
      .selectFrom("notification.messages")
      .select(["message_id", "category", "content", "created_at", "seen_at", "read_at"])
      .where("account_id", "=", accountId)
      .orderBy("created_at", "desc")
      .orderBy("message_id", "desc")
      .limit(limit)
      .execute();
    return rows.map((row) => this.mapMessage(row));
  }

  public async markRead(accountId: string, messageId: string): Promise<NotificationMessage | undefined> {
    const now = new Date();
    const row = await this.database.db
      .updateTable("notification.messages")
      .set({ seen_at: now, read_at: now })
      .where("account_id", "=", accountId)
      .where("message_id", "=", messageId)
      .returning(["message_id", "category", "content", "created_at", "seen_at", "read_at"])
      .executeTakeFirst();
    return row === undefined ? undefined : this.mapMessage(row);
  }

  public async markAllRead(accountId: string): Promise<number> {
    const now = new Date();
    const result = await this.database.db
      .updateTable("notification.messages")
      .set({ seen_at: now, read_at: now })
      .where("account_id", "=", accountId)
      .where("read_at", "is", null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  public async listPreferences(accountId: string): Promise<NotificationPreference[]> {
    const rows = await this.database.db
      .selectFrom("notification.channel_preferences")
      .select(["category", "channel", "enabled", "version", "updated_at"])
      .where("account_id", "=", accountId)
      .execute();
    const stored = new Map(rows.map((row) => [`${row.category}:${row.channel}`, row]));
    return CATEGORIES.flatMap((category) =>
      CHANNELS.map((channel) => {
        const row = stored.get(`${category}:${channel}`);
        return {
          category,
          channel,
          enabled: row?.enabled ?? defaultEnabled(channel),
          version: row?.version ?? 0,
          updatedAt: row?.updated_at.toISOString() ?? null,
        };
      }),
    );
  }

  public async setPreference(
    accountId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<NotificationPreference> {
    const row = await this.database.db
      .insertInto("notification.channel_preferences")
      .values({ account_id: accountId, category, channel, enabled })
      .onConflict((conflict) =>
        conflict.columns(["account_id", "category", "channel"]).doUpdateSet({
          enabled,
          version: sql<number>`notification.channel_preferences.version + 1`,
          updated_at: new Date(),
        }),
      )
      .returning(["category", "channel", "enabled", "version", "updated_at"])
      .executeTakeFirstOrThrow();
    return {
      category: row.category as NotificationCategory,
      channel: row.channel as NotificationChannel,
      enabled: row.enabled,
      version: row.version,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapMessage(row: {
    message_id: string;
    category: string;
    content: JsonValue;
    created_at: Date;
    seen_at: Date | null;
    read_at: Date | null;
  }): NotificationMessage {
    return {
      messageId: row.message_id,
      category: row.category as NotificationCategory,
      content: row.content as Record<string, unknown>,
      createdAt: row.created_at.toISOString(),
      seenAt: row.seen_at?.toISOString() ?? null,
      readAt: row.read_at?.toISOString() ?? null,
    };
  }
}
