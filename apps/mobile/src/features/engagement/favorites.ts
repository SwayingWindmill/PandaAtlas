import { useEffect, useSyncExternalStore } from "react";

import { useSession } from "@/features/session/session";
import { authedApi } from "@/lib/api";

// The followed pandas of the signed-in fan, shared by every screen that shows a follow button or the list.
// A toggle shows at once and is undone if the API refuses it.

let ids: ReadonlySet<string> | null = null;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

function publish(next: ReadonlySet<string> | null) {
  ids = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function load(accountId: string) {
  loadedFor = accountId;
  const { data } = await authedApi.GET("/api/v2/me/favorites");
  if (loadedFor === accountId && data) publish(new Set(data.items.map((item) => item.pandaId)));
}

export async function setFollowing(pandaId: string, following: boolean): Promise<boolean> {
  const before = ids ?? new Set<string>();
  const next = new Set(before);
  if (following) next.add(pandaId);
  else next.delete(pandaId);
  publish(next);
  const { response } = following
    ? await authedApi.POST("/api/v2/me/favorites/{pandaId}", { params: { path: { pandaId } } })
    : await authedApi.DELETE("/api/v2/me/favorites/{pandaId}", { params: { path: { pandaId } } });
  if (!response.ok) publish(before);
  return response.ok;
}

/** Followed panda IDs, or null while loading and when signed out. */
export function useFollowed(): ReadonlySet<string> | null {
  const { state } = useSession();
  const accountId = state.status === "signedIn" ? state.accountId : null;
  useEffect(() => {
    if (accountId === null) {
      loadedFor = null;
      publish(null);
    } else if (loadedFor !== accountId) {
      void load(accountId);
    }
  }, [accountId]);
  return useSyncExternalStore(subscribe, () => ids);
}
