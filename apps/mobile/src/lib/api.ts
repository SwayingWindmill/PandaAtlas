import { createApiClient } from "@zhipanda/api-client";

// The public V2 API. Set EXPO_PUBLIC_API_BASE_URL to point a development build at a local API.
const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api.zhipanda.com").replace(/\/$/, "");
const mediaBaseUrl = (process.env.EXPO_PUBLIC_MEDIA_BASE_URL ?? "https://api.zhipanda.com/media").replace(/\/$/, "");

export const api = createApiClient(baseUrl);

export function publicMediaUrl(objectKey: string): string {
  if (/^https?:\/\//i.test(objectKey)) return objectKey;
  return `${mediaBaseUrl}/${objectKey.replace(/^\/+/, "")}`;
}
