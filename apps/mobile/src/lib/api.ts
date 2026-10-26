import { createApiClient } from "@zhipanda/api-client";

import { supabase } from "@/lib/supabase";

// The public V2 API. Set EXPO_PUBLIC_API_BASE_URL to point a development build at a local API.
const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api.zhipanda.com").replace(/\/$/, "");
const mediaBaseUrl = (process.env.EXPO_PUBLIC_MEDIA_BASE_URL ?? "https://api.zhipanda.com/media").replace(/\/$/, "");

export const api = createApiClient(baseUrl);

/** The same API with the signed-in fan's Supabase access token; personal endpoints need it. */
export const authedApi = createApiClient(baseUrl);
authedApi.use({
  async onRequest({ request }) {
    const { data } = await supabase.auth.getSession();
    if (data.session) request.headers.set("Authorization", `Bearer ${data.session.access_token}`);
    return request;
  },
});

export function publicMediaUrl(objectKey: string): string {
  if (/^https?:\/\//i.test(objectKey)) return objectKey;
  return `${mediaBaseUrl}/${objectKey.replace(/^\/+/, "")}`;
}
