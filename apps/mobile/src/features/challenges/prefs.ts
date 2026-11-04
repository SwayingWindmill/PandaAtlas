import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { type ChallengeState, parseChallengeState } from "./challenge";

// Kept on this device only, like 里程碑's switch: no account, no server.
const KEY = "monthly-challenge";
let current: ChallengeState | undefined;
let reading: Promise<ChallengeState> | undefined;
let pendingWrite = Promise.resolve();
const listeners = new Set<(state: ChallengeState) => void>();

function read(): Promise<ChallengeState> {
  reading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((stored) => {
      current ??= parseChallengeState(stored);
      return current;
    });
  return reading;
}

export function saveChallengeState(next: ChallengeState): void {
  current = next;
  for (const listener of listeners) listener(next);
  pendingWrite = pendingWrite.then(() => AsyncStorage.setItem(KEY, JSON.stringify(next))).catch(() => undefined);
}

/** Null until read, so nothing flashes. */
export function useChallengeState(): ChallengeState | null {
  const [state, setState] = useState<ChallengeState | null>(current ?? null);
  useEffect(() => {
    listeners.add(setState);
    if (current === undefined) void read().then(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}
