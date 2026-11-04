import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { localToday } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import type { Evidence } from "@/features/timeline/timeline";

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

/**
 * The memories of `days` (today when none are given), read again each time the screen comes into focus (the
 * day may have turned), with the fan's own records once the session says who they are, and each memory's
 * first readable source. `days` is a dependency: pass a stable key, such as the range it was made from.
 */
export function useMemories(days?: (today: string) => string[], key = "today"): MemoriesState {
  const { state } = useSession();
  const [loaded, setLoaded] = useState<MemoryDay[] | null>(null);
  const [sources, setSources] = useState<Map<string, Evidence>>(new Map());
  const [failed, setFailed] = useState(false);
  const signedIn = state.status === "signedIn";
  const waiting = state.status === "loading";

  const load = useCallback(() => {
    if (waiting) return undefined;
    let live = true;
    const today = localToday();
    loadMemoryDays({ signedIn, days: days ? days(today) : [today] })
      .then((next) => {
        if (!live) return;
        setFailed(false);
        setLoaded(next);
        void loadFirstSources(next.flatMap((day) => day.memories)).then((found) => live && setSources(found));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
    // `days` is a function made on each render; `key` says when it asks for other days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, waiting, key]);

  useFocusEffect(load);

  const reload = useCallback(() => {
    setFailed(false);
    load();
  }, [load]);

  return { memories: loaded ? loaded.flatMap((day) => day.memories) : null, days: loaded, sources, failed, reload };
}
