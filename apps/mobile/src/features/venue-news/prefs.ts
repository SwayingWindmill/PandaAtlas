import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// 场馆动态 on 今天 is on until the fan turns it off in 设置. A viewing preference kept on this device: no
// account, no push, no server change.

const KEY = "venueNewsOnToday";
let current: boolean | undefined;
let reading: Promise<boolean> | undefined;
let pendingWrite = Promise.resolve();
const listeners = new Set<(on: boolean) => void>();

function read(): Promise<boolean> {
  reading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((stored) => {
      current ??= stored !== "off";
      return current;
    });
  return reading;
}

export function setVenueNewsOn(on: boolean): void {
  current = on;
  for (const listener of listeners) listener(on);
  pendingWrite = pendingWrite.then(() => AsyncStorage.setItem(KEY, on ? "on" : "off")).catch(() => undefined);
}

/** Null until read, so the switch and the 今天 card do not flash. */
export function useVenueNewsOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(current ?? null);
  useEffect(() => {
    listeners.add(setOn);
    if (current === undefined) void read().then(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}
