import { authedApi } from "@/lib/api";

import type { Message, Preference } from "./notifications";

/** Newest first, as the API returns them. */
export async function loadInbox(): Promise<Message[]> {
  const { data } = await authedApi.GET("/api/v2/me/notifications", { params: { query: { limit: 50 } } });
  if (!data) throw new Error("Notifications unavailable");
  return data;
}

export async function markRead(messageId: string): Promise<Message> {
  const { data } = await authedApi.PATCH("/api/v2/me/notifications/{messageId}/read", {
    params: { path: { messageId } },
  });
  if (!data) throw new Error("Notification not marked read");
  return data;
}

export async function markAllRead(): Promise<void> {
  const { response } = await authedApi.PATCH("/api/v2/me/notifications/read-all");
  if (!response.ok) throw new Error(`Notifications not marked read (${response.status})`);
}

export async function loadPreferences(): Promise<Preference[]> {
  const { data } = await authedApi.GET("/api/v2/me/notifications/preferences");
  if (!data) throw new Error("Notification preferences unavailable");
  return data;
}

export async function savePreference(input: Pick<Preference, "category" | "channel" | "enabled">): Promise<Preference> {
  const { data } = await authedApi.PUT("/api/v2/me/notifications/preferences", { body: input });
  if (!data) throw new Error("Notification preference not saved");
  return data;
}
