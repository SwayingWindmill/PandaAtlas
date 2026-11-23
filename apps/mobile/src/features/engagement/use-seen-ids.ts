import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { guestSeenQueryOptions } from "@/features/engagement/guest-store";
import { seenIdsQueryOptions } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";

/** Seen panda IDs (signed-in or local guest), or null while loading or unavailable. */
export function useSeenIds(): ReadonlySet<string> | null {
  const { state } = useSession();
  const accountId = state.status === "signedIn" ? state.accountId : null;
  const signedOut = state.status === "signedOut";
  const remote = useQuery({
    ...seenIdsQueryOptions(accountId ?? ""),
    enabled: accountId !== null,
  });
  const guest = useQuery({
    ...guestSeenQueryOptions(),
    enabled: signedOut,
  });
  return useMemo(() => {
    if (accountId !== null) return remote.data ?? null;
    if (signedOut) return guest.data ? new Set(Object.keys(guest.data)) : null;
    return null;
  }, [accountId, guest.data, remote.data, signedOut]);
}
