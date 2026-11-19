import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { localToday } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import type { Evidence } from "@/features/timeline/timeline";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";

import { type MemoryDay, loadFirstSources, loadMemoryDays } from "./load";
import type { Memory } from "./on-this-day";

export interface MemoriesState {
  /** Null while loading. */
  memories: Memory[] | null;
  /** The same memories by day, in the order the days were asked for. Null while loading. */
  days: MemoryDay[] | null;
  sources: Map<string, Evidence>;
  failed: boolean;
  reload: () => void;
}

const EMPTY_SOURCES = new Map<string, Evidence>();

/**
 * The memories of `days` (today when none are given), loaded with React Query and refreshed on screen focus
 * (the day may have turned), with the fan's own records once signed in, and each memory's first readable
 * source. `days` is a dependency: pass a stable key, such as the range it was made from.
 */
export function useMemories(days?: (today: string) => string[], key = "today"): MemoriesState {
  const { state } = useSession();
  const signedIn = state.status === "signedIn";
  const waiting = state.status === "loading";
  const accountId = state.status === "signedIn" ? state.accountId : null;
  const today = localToday();
  const requestedDays = days ? days(today) : [today];

  const queryKey =
    accountId !== null
      ? (["private", accountId, "memories", key, today] as const)
      : (["public", "memories", key, today] as const);

  const daysQuery = useQuery({
    queryKey,
    queryFn: () => loadMemoryDays({ signedIn, days: requestedDays }),
    enabled: !waiting,
    networkMode: "always",
  });
  useRefetchOnFocus(daysQuery.refetch, !waiting);

  const loadedDays = daysQuery.data ?? null;
  const flatMemories = useMemo(
    () => (loadedDays ? loadedDays.flatMap((day) => day.memories) : null),
    [loadedDays],
  );
  const memorySourcesKey = useMemo(
    () =>
      flatMemories
        ? flatMemories
            .filter((memory) => memory.sourceIds.length > 0)
            .map((memory) => `${memory.key}:${memory.sourceIds.join("|")}`)
            .sort()
            .join(",")
        : "",
    [flatMemories],
  );

  const sourcesQuery = useQuery({
    queryKey: ["public", "memory-sources", memorySourcesKey],
    queryFn: () => loadFirstSources(flatMemories ?? []),
    enabled: flatMemories !== null && memorySourcesKey.length > 0,
    staleTime: 300_000,
    networkMode: "always",
  });

  const refetchDays = daysQuery.refetch;
  const reload = useCallback(() => {
    void refetchDays();
  }, [refetchDays]);

  return {
    memories: flatMemories,
    days: loadedDays,
    sources: sourcesQuery.data ?? EMPTY_SOURCES,
    failed: !loadedDays && daysQuery.isError && !daysQuery.isFetching,
    reload,
  };
}
