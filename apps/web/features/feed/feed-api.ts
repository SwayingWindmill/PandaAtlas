import "server-only";

import { isFeedUiEnabled } from "@/features/feed/config";
import type {
  ActivityPageData,
  FeedLoadResult,
  FeedPageData,
  PublicActivityLoadResult,
} from "@/features/feed/types";

const PRIVATE_FASTAPI_BASE_URL = (
  process.env.API_BASE_URL
  ?? "http://localhost:8000"
).replace(/\/$/, "");

const PUBLIC_FASTAPI_BASE_URL = (
  process.env.API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? "http://localhost:8000"
).replace(/\/$/, "");

export async function loadPersonalizedFeed(
  accessToken: string,
  cursor?: string,
): Promise<FeedLoadResult> {
  if (!isFeedUiEnabled()) return { state: "disabled" };
  const query = new URLSearchParams({ page_size: "20" });
  if (cursor) query.set("cursor", cursor);

  let response: Response;
  try {
    response = await fetch(`${PRIVATE_FASTAPI_BASE_URL}/api/v1/me/feed?${query}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return { state: "unavailable" };
  }

  if (response.status === 401) return { state: "unauthenticated" };
  if (response.status === 403) return { state: "blocked" };
  if (response.status === 404) return { state: "disabled" };
  if (!response.ok) return { state: "unavailable" };
  return { state: "ready", page: await response.json() as FeedPageData };
}

export async function loadPublicPandaActivity(
  pandaId: string,
  cursor?: string,
): Promise<PublicActivityLoadResult> {
  if (!isFeedUiEnabled()) return { state: "disabled" };
  const query = new URLSearchParams({ page_size: "8" });
  if (cursor) query.set("cursor", cursor);
  try {
    const response = await fetch(
      `${PUBLIC_FASTAPI_BASE_URL}/api/v1/pandas/${encodeURIComponent(pandaId)}/activity?${query}`,
      { next: { revalidate: 60 } },
    );
    if (response.status === 404) return { state: "disabled" };
    if (!response.ok) return { state: "unavailable" };
    return {
      state: "ready",
      page: await response.json() as ActivityPageData,
    };
  } catch {
    return { state: "unavailable" };
  }
}
