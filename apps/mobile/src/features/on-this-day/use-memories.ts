import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { useSession } from "@/features/session/session";
import type { Evidence } from "@/features/timeline/timeline";

import { loadFirstSources, loadMemories } from "./load";
import type { Memory } from "./on-this-day";

export interface MemoriesState {
  /** Null while loading. */
  memories: Memory[] | null;
  sources: Map<string, Evidence>;
  failed: boolean;
  reload: () => void;
}

/**
 * Today's memories, read again each time the screen comes into focus (the day may have turned), with the
 * fan's own records once the session says who they are, and each memory's first readable source.
 */
export function useMemories(): MemoriesState {
  const { state } = useSession();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [sources, setSources] = useState<Map<string, Evidence>>(new Map());
  const [failed, setFailed] = useState(false);
  const signedIn = state.status === "signedIn";
  const waiting = state.status === "loading";

  const load = useCallback(() => {
    if (waiting) return undefined;
    let live = true;
    loadMemories({ signedIn })
      .then((next) => {
        if (!live) return;
        setFailed(false);
        setMemories(next);
        void loadFirstSources(next).then((found) => live && setSources(found));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [signedIn, waiting]);

  useFocusEffect(load);

  const reload = useCallback(() => {
    setFailed(false);
    load();
  }, [load]);

  return { memories, sources, failed, reload };
}
