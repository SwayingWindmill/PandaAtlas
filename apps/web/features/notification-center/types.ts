export type NotificationCategory =
  | "birthday"
  | "major_activity"
  | "submission_status"
  | "incorporation"
  | "correction_retraction"
  | "security_role";

export interface InboxItemData {
  inbox_item_id: string;
  intent_id: string;
  category: NotificationCategory;
  body: Record<string, unknown>;
  body_version: number;
  created_at: string;
  expires_at: string;
  seen_at: string | null;
  read_at: string | null;
  retracted_at: string | null;
  retraction_reason: string | null;
}

export interface InboxPageData {
  items: InboxItemData[];
  next_cursor: string | null;
  unread_count: number;
}

export interface NotificationPreferenceData {
  account_id: string;
  category: NotificationCategory;
  channel: "station" | "email" | "web_push";
  enabled: boolean;
  version: number;
  updated_at: string;
}
