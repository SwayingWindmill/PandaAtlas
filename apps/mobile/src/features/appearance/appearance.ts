import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Uniwind } from "uniwind";

// 外观 in 我的: follow the system (the default), or keep light or dark. The choice stays on the device.

export type Appearance = "system" | "light" | "dark";

const KEY = "appearance";
const CHOICES: readonly Appearance[] = ["system", "light", "dark"];

function isAppearance(value: unknown): value is Appearance {
  return typeof value === "string" && (CHOICES as readonly string[]).includes(value);
}

/** Applies the stored choice at startup; nothing stored means following the system. */
export async function applyStoredAppearance(): Promise<void> {
  const stored = await AsyncStorage.getItem(KEY).catch(() => null);
  Uniwind.setTheme(isAppearance(stored) ? stored : "system");
}

export function useAppearance(): [Appearance, (next: Appearance) => void] {
  const [appearance, setAppearanceState] = useState<Appearance>("system");
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (isAppearance(stored)) setAppearanceState(stored);
      })
      .catch(() => undefined);
  }, []);
  function set(next: Appearance) {
    setAppearanceState(next);
    Uniwind.setTheme(next);
    void AsyncStorage.setItem(KEY, next).catch(() => undefined);
  }
  return [appearance, set];
}
