export type NotificationCategory = "knowledge_update" | "correction";

export interface NotificationMessageData {
  messageId: string;
  category: NotificationCategory;
  content: Record<string, unknown>;
  createdAt: string;
  seenAt: string | null;
  readAt: string | null;
}

export interface NotificationInboxData {
  items: NotificationMessageData[];
  unreadCount: number;
}

export interface NotificationPreferenceData {
  category: NotificationCategory;
  channel: "station" | "email";
  enabled: boolean;
  version: number;
  updatedAt: string | null;
}
