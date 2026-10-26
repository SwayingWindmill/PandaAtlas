import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// The welcome shows once per install: the flag lives on the device, not in the account, so a fan who has not
// signed in still sees it only once.

export const WELCOME_KEY = "welcome.seen";

/** Whether the welcome was already shown; null while the device storage is read. */
export function useWelcomeSeen(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_KEY)
      .then((value) => setSeen(value === "1"))
      .catch(() => setSeen(true));
  }, []);
  return seen;
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(WELCOME_KEY, "1");
}
