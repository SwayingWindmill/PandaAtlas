export type NotificationCategory = "knowledge_update" | "correction";
export type NotificationChannel = "station" | "email";

export interface NotificationPreference {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  version: number;
  updatedAt: string | null;
}

export interface NotificationMessage {
  messageId: string;
  category: NotificationCategory;
  content: Record<string, unknown>;
  createdAt: string;
  seenAt: string | null;
  readAt: string | null;
}

export interface NotificationRepository {
  listMessages(accountId: string, limit: number): Promise<NotificationMessage[]>;
  markRead(accountId: string, messageId: string): Promise<NotificationMessage | undefined>;
  markAllRead(accountId: string): Promise<number>;
  listPreferences(accountId: string): Promise<NotificationPreference[]>;
  setPreference(
    accountId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<NotificationPreference>;
}

export type NotificationPort = NotificationRepository;
export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");
export const NOTIFICATION_PORT = Symbol("NOTIFICATION_PORT");

export class NotificationApplication implements NotificationPort {
  public constructor(private readonly repository: NotificationRepository) {}

  public listMessages(accountId: string, limit = 50): Promise<NotificationMessage[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Notification limit must be an integer between 1 and 100");
    }
    return this.repository.listMessages(accountId, limit);
  }

  public markRead(accountId: string, messageId: string) {
    return this.repository.markRead(accountId, messageId);
  }

  public markAllRead(accountId: string) {
    return this.repository.markAllRead(accountId);
  }

  public listPreferences(accountId: string) {
    return this.repository.listPreferences(accountId);
  }

  public setPreference(
    accountId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
  ) {
    return this.repository.setPreference(accountId, category, channel, enabled);
  }
}
