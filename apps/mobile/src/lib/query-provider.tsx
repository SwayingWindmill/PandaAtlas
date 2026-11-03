import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useEffect, type ReactNode } from "react";
import { AppState, Platform } from "react-native";

import { queryClient } from "@/lib/query-client";

if (Platform.OS !== "web") {
  onlineManager.setEventListener((setOnline) => {
    let initialized = false;
    const subscription = Network.addNetworkStateListener((state) => {
      initialized = true;
      if (typeof state.isConnected === "boolean") setOnline(state.isConnected);
    });
    void Network.getNetworkStateAsync().then((state) => {
      if (!initialized && typeof state.isConnected === "boolean") setOnline(state.isConnected);
    }).catch(() => undefined);
    return () => subscription.remove();
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"));
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
