import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useEffect, type ReactNode } from "react";
import { AppState, Platform } from "react-native";

import { reportError } from "@/lib/error-reporting";
import { queryClient, reportCacheErrors } from "@/lib/query-client";

export function isNetworkOnline(state: Network.NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

if (Platform.OS !== "web" || typeof window !== "undefined") {
  onlineManager.setEventListener((setOnline) => {
    let initialized = false;
    const subscription = Network.addNetworkStateListener((state) => {
      initialized = true;
      setOnline(isNetworkOnline(state));
    });
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (!initialized) setOnline(isNetworkOnline(state));
      })
      .catch(() => undefined);
    return () => subscription.remove();
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => reportCacheErrors(queryClient, reportError), []);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"));
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
