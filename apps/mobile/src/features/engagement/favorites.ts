import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useSession } from "@/features/session/session";
import { authedApi } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

const favoritesKey = (accountId: string) => ["private", accountId, "favorites"] as const;

async function loadFavorites(): Promise<string[]> {
  const { data } = await authedApi.GET("/api/v2/me/favorites");
  if (!data) throw new Error("Favorites unavailable");
  return data.items.map((item) => item.pandaId);
}

/** Optimistically update only this panda, so concurrent follow actions do not undo each other. */
export async function setFollowing(accountId: string, pandaId: string, following: boolean): Promise<boolean> {
  const key = favoritesKey(accountId);
  await queryClient.cancelQueries({ queryKey: key });
  const before = queryClient.getQueryData<string[]>(key);
  if (before) {
    queryClient.setQueryData<string[]>(key, (current) => {
      if (!current) return current;
      return following ? [...new Set([...current, pandaId])] : current.filter((id) => id !== pandaId);
    });
  }
  try {
    const { response } = following
      ? await authedApi.POST("/api/v2/me/favorites/{pandaId}", { params: { path: { pandaId } } })
      : await authedApi.DELETE("/api/v2/me/favorites/{pandaId}", { params: { path: { pandaId } } });
    if (!response.ok) throw new Error("Favorite update failed");
    return true;
  } catch {
    if (before) {
      const wasFollowing = before.includes(pandaId);
      queryClient.setQueryData<string[]>(key, (current) => {
        if (!current) return current;
        return wasFollowing ? [...new Set([...current, pandaId])] : current.filter((id) => id !== pandaId);
      });
    }
    return false;
  } finally {
    // Onboarding may follow before the first favorites query has finished.
    if (!before) void queryClient.invalidateQueries({ queryKey: key });
  }
}

/** Followed panda IDs, or null while loading and when signed out. */
export function useFollowed(): ReadonlySet<string> | null {
  const { state } = useSession();
  const accountId = state.status === "signedIn" ? state.accountId : null;
  const { data } = useQuery({
    queryKey: favoritesKey(accountId ?? ""),
    queryFn: loadFavorites,
    enabled: accountId !== null,
  });
  return useMemo(() => accountId !== null && data ? new Set(data) : null, [accountId, data]);
}
