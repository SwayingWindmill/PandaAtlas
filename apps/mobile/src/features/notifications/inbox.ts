import type { components } from "@zhipanda/api-client";
import { queryOptions } from "@tanstack/react-query";

import { authedApi } from "@/lib/api";

import type { Message, Preference } from "./notifications";

export type DeviceToken = components["schemas"]["NotificationDeviceDto"];
export type DevicePlatform = components["schemas"]["NotificationDeviceInputDto"]["platform"];

/** Newest first, as the API returns them. */
export async function loadInbox(): Promise<Message[]> {
  const { data } = await authedApi.GET("/api/v2/me/notifications", { params: { query: { limit: 50 } } });
  if (!data) throw new Error("Notifications unavailable");
  return data;
}

export const inboxQueryKey = (accountId: string) => ["private", accountId, "inbox"] as const;
export const preferencesQueryKey = (accountId: string) => ["private", accountId, "notification-preferences"] as const;

export function inboxQueryOptions(accountId: string) {
  return queryOptions({ queryKey: inboxQueryKey(accountId), queryFn: loadInbox, staleTime: 0 });
}

export function preferencesQueryOptions(accountId: string) {
  return queryOptions({ queryKey: preferencesQueryKey(accountId), queryFn: loadPreferences, staleTime: 0 });
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

export async function registerNotificationDevice(
  expoPushToken: string,
  platform: DevicePlatform,
): Promise<DeviceToken> {
  const { data, response } = await authedApi.POST("/api/v2/me/notifications/devices", {
    body: { expoPushToken, platform },
  });
  if (!data) throw new Error(`Notification device not registered (${response.status})`);
  return data;
}

export async function removeNotificationDevice(deviceTokenId: string): Promise<boolean> {
  const { response } = await authedApi.DELETE("/api/v2/me/notifications/devices/{tokenId}", {
    params: { path: { tokenId: deviceTokenId } },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Notification device not removed (${response.status})`);
  return true;
}
