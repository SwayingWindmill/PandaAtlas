import { sql } from "kysely";
import type { JsonValue } from "../../../platform/database/database.notification.generated.js";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import {
  defaultChannelEnabled,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationDevicePlatform,
  type NotificationDeviceToken,
  type NotificationMessage,
  type NotificationPreference,
  type NotificationRepository,
} from "../application/notification.application.js";

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
    return NOTIFICATION_CATEGORIES.flatMap((category) =>
      NOTIFICATION_CHANNELS.map((channel) => {
        const row = stored.get(`${category}:${channel}`);
        return {
          category,
          channel,
          enabled: row?.enabled ?? defaultChannelEnabled(channel),
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

  public async listDevices(accountId: string): Promise<NotificationDeviceToken[]> {
    const rows = await this.database.db
      .selectFrom("notification.device_tokens")
      .select(["device_token_id", "expo_push_token", "platform", "active", "last_active_at", "updated_at"])
      .where("account_id", "=", accountId)
      .orderBy("updated_at", "desc")
      .orderBy("device_token_id", "desc")
      .execute();
    return rows.map((row) => this.mapDeviceToken(row));
  }

  public async registerDevice(
    accountId: string,
    expoPushToken: string,
    platform: NotificationDevicePlatform,
  ): Promise<NotificationDeviceToken> {
    const now = new Date();
    const row = await this.database.db
      .insertInto("notification.device_tokens")
      .values({
        account_id: accountId,
        expo_push_token: expoPushToken,
        platform,
        active: true,
        disabled_reason: null,
        last_active_at: now,
        updated_at: now,
      })
      .onConflict((conflict) =>
        conflict.column("expo_push_token").doUpdateSet({
          account_id: accountId,
          platform,
          active: true,
          disabled_reason: null,
          last_active_at: now,
          updated_at: now,
        }),
      )
      .returning(["device_token_id", "expo_push_token", "platform", "active", "last_active_at", "updated_at"])
      .executeTakeFirstOrThrow();
    return this.mapDeviceToken(row);
  }

  public async removeDevice(accountId: string, deviceTokenId: string): Promise<boolean> {
    const deleted = await this.database.db
      .deleteFrom("notification.device_tokens")
      .where("device_token_id", "=", deviceTokenId)
      .where("account_id", "=", accountId)
      .returning("device_token_id")
      .executeTakeFirst();
    return deleted !== undefined;
  }

  private mapDeviceToken(row: {
    device_token_id: string;
    expo_push_token: string;
    platform: string;
    active: boolean;
    last_active_at: Date;
    updated_at: Date;
  }): NotificationDeviceToken {
    return {
      deviceTokenId: row.device_token_id,
      expoPushToken: row.expo_push_token,
      platform: row.platform as NotificationDevicePlatform,
      active: row.active,
      lastActiveAt: row.last_active_at.toISOString(),
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
