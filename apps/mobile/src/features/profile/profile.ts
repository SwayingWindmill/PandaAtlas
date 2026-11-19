import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSession } from "@/features/session/session";
import { authedApi } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

export const NICKNAME_MAX = 40;

export interface Profile {
  nickname: string;
  bio: string;
}

const profileKey = (accountId: string) => ["private", accountId, "profile"] as const;

/** The name a profile header shows: the nickname, else the address, else a friendly default. */
export function displayName(profile: Profile | null, email: string | null): string {
  return profile?.nickname || email || "熊猫粉丝";
}

/** The first character of the name, for an avatar with no photo. */
export function initial(name: string): string {
  return Array.from(name)[0]?.toUpperCase() ?? "熊";
}

/**
 * The signed-in fan's profile from `/api/v2/me/profile`, shared across Today, Me and Settings via React Query,
 * plus a `rename` that updates cached readers when the server accepts the new nickname.
 */
export function useProfile(): { profile: Profile | null; rename: (nickname: string) => Promise<boolean> } {
  const { state } = useSession();
  const accountId = state.status === "signedIn" ? state.accountId : null;
  const { data: profile = null } = useQuery({
    queryKey: profileKey(accountId ?? ""),
    enabled: accountId !== null,
    staleTime: 300_000,
    queryFn: async (): Promise<Profile> => {
      const { data } = await authedApi.GET("/api/v2/me/profile");
      if (!data) throw new Error("Profile unavailable");
      return { nickname: data.nickname, bio: data.bio };
    },
  });
  const rename = useCallback(
    async (nickname: string) => {
      if (!accountId || !profile) return false;
      const { data } = await authedApi.PUT("/api/v2/me/profile", {
        body: { nickname: nickname.trim(), bio: profile.bio },
      });
      if (!data) return false;
      queryClient.setQueryData<Profile>(profileKey(accountId), { nickname: data.nickname, bio: data.bio });
      return true;
    },
    [accountId, profile],
  );
  return { profile, rename };
}
