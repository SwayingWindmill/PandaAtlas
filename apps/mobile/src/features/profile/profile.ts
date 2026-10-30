import { useCallback, useEffect, useState } from "react";

import { authedApi } from "@/lib/api";

export const NICKNAME_MAX = 40;

export interface Profile {
  nickname: string;
  bio: string;
}

/** The name a profile header shows: the nickname, else the address, else a friendly default. */
export function displayName(profile: Profile | null, email: string | null): string {
  return profile?.nickname || email || "熊猫粉丝";
}

/** The first character of the name, for an avatar with no photo. */
export function initial(name: string): string {
  return Array.from(name)[0]?.toUpperCase() ?? "熊";
}

/**
 * The signed-in fan's profile from `/api/v2/me/profile`, read once on mount, and a `rename` that
 * writes a new nickname and resolves to whether the server took it.
 */
export function useProfile(): { profile: Profile | null; rename: (nickname: string) => Promise<boolean> } {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    void authedApi.GET("/api/v2/me/profile").then(({ data }) => {
      if (data) setProfile({ nickname: data.nickname, bio: data.bio });
    });
  }, []);
  const rename = useCallback(
    async (nickname: string) => {
      if (!profile) return false;
      const { data } = await authedApi.PUT("/api/v2/me/profile", {
        body: { nickname: nickname.trim(), bio: profile.bio },
      });
      if (!data) return false;
      setProfile({ nickname: data.nickname, bio: data.bio });
      return true;
    },
    [profile],
  );
  return { profile, rename };
}
