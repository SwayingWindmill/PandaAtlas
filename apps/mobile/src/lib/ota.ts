import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { reportError } from "@/lib/error-reporting";
import { criticalIndex, updateAction } from "@/lib/ota-policy";

/** A foreground check at most this often; returning to the app every minute should not hit EAS every minute. */
const CHECK_EVERY_MS = 30 * 60_000;

function extraOf(manifest: Updates.Manifest | undefined): Record<string, unknown> | undefined {
  return manifest && "extra" in manifest ? manifest.extra?.expoClient?.extra : undefined;
}

async function checkOnce(): Promise<void> {
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return;
  const fetched = await Updates.fetchUpdateAsync();
  if (!fetched.isNew) return;
  const action = updateAction(criticalIndex(Constants.expoConfig?.extra), criticalIndex(extraOf(fetched.manifest)));
  if (action === "reload-now") await Updates.reloadAsync();
}

/**
 * Checks the build's EAS Update channel at launch and when the app comes back to the foreground. app.json sets
 * `checkAutomatically` to NEVER so this is the one place that decides; see lib/ota-policy.ts for what an update does.
 * Off in development, on the web, and in a build with no update URL (expo-updates is then disabled).
 */
export function useSilentUpdates() {
  useEffect(() => {
    if (__DEV__ || Platform.OS === "web" || !Updates.isEnabled) return;
    let last = 0;
    const run = () => {
      if (Date.now() - last < CHECK_EVERY_MS) return;
      last = Date.now();
      checkOnce().catch((error: unknown) => reportError(error, "ota"));
    };
    run();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => subscription.remove();
  }, []);
}
