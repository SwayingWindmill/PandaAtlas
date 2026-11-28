import { DomainError } from "../../../platform/errors/domain-error.js";
export type NotificationCategory = "knowledge_update" | "correction";
export type NotificationChannel = "station" | "email" | "push";
export type NotificationDevicePlatform = "ios" | "android";

export const EXPO_PUSH_TOKEN_PATTERN = /^(Exponent|Expo)PushToken\[[A-Za-z0-9_+./:=-]+\]$/;

export function isValidExpoPushToken(token: string): boolean {
  return token.length <= 255 && EXPO_PUSH_TOKEN_PATTERN.test(token);
}

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

export interface NotificationDeviceToken {
  deviceTokenId: string;
  expoPushToken: string;
  platform: NotificationDevicePlatform;
  active: boolean;
  lastActiveAt: string;
  updatedAt: string;
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
  listDevices(accountId: string): Promise<NotificationDeviceToken[]>;
  registerDevice(
    accountId: string,
    expoPushToken: string,
    platform: NotificationDevicePlatform,
  ): Promise<NotificationDeviceToken>;
  removeDevice(accountId: string, deviceTokenId: string): Promise<boolean>;
}

export type NotificationPort = NotificationRepository;
export const NOTIFICATION_PORT = Symbol("NOTIFICATION_PORT");

export class NotificationApplication implements NotificationPort {
  public constructor(private readonly repository: NotificationRepository) {}

  public listMessages(accountId: string, limit = 50): Promise<NotificationMessage[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new DomainError("invalid", "notification.limitOutOfRange", "Notification limit must be an integer between 1 and 100.");
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

  public listDevices(accountId: string): Promise<NotificationDeviceToken[]> {
    return this.repository.listDevices(accountId);
  }

  public async registerDevice(
    accountId: string,
    expoPushToken: string,
    platform: NotificationDevicePlatform,
  ): Promise<NotificationDeviceToken> {
    if (!isValidExpoPushToken(expoPushToken)) {
      throw new DomainError(
        "invalid",
        "notification.invalidExpoPushToken",
        "Expo push token must match ExponentPushToken[...] or ExpoPushToken[...].",
      );
    }
    return this.repository.registerDevice(accountId, expoPushToken, platform);
  }

  public removeDevice(accountId: string, deviceTokenId: string): Promise<boolean> {
    return this.repository.removeDevice(accountId, deviceTokenId);
  }
}
