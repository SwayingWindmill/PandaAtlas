import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useSession } from "@/features/session/session";
import { authedApi } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

const followedVenuesKey = (accountId: string) => ["private", accountId, "followed-venues"] as const;

async function loadFollowedVenues(): Promise<string[]> {
  const { data } = await authedApi.GET("/api/v2/me/followed-venues");
  if (!data) throw new Error("Followed venues unavailable");
  return data.items.map((item) => item.institutionSlug);
}

/** Follows or unfollows one venue, optimistically, and puts it back if the request fails. */
export async function setFollowingVenue(accountId: string, slug: string, following: boolean): Promise<boolean> {
  const key = followedVenuesKey(accountId);
  await queryClient.cancelQueries({ queryKey: key });
  const before = queryClient.getQueryData<string[]>(key);
  const apply = (on: boolean) =>
    queryClient.setQueryData<string[]>(key, (current) =>
      current ? (on ? [...new Set([...current, slug])] : current.filter((item) => item !== slug)) : current,
    );
  apply(following);
  try {
    const { response } = following
      ? await authedApi.POST("/api/v2/me/followed-venues/{slug}", { params: { path: { slug } } })
      : await authedApi.DELETE("/api/v2/me/followed-venues/{slug}", { params: { path: { slug } } });
    if (!response.ok) throw new Error("Venue follow update failed");
    return true;
  } catch {
    if (before) apply(before.includes(slug));
    return false;
  } finally {
    if (!before) void queryClient.invalidateQueries({ queryKey: key });
  }
}

/** Followed venue slugs, or null while loading and when signed out. */
export function useFollowedVenues(): ReadonlySet<string> | null {
  const { state } = useSession();
  const accountId = state.status === "signedIn" ? state.accountId : null;
  const { data } = useQuery({
    queryKey: followedVenuesKey(accountId ?? ""),
    queryFn: loadFollowedVenues,
    enabled: accountId !== null,
  });
  return useMemo(() => (accountId !== null && data ? new Set(data) : null), [accountId, data]);
}
