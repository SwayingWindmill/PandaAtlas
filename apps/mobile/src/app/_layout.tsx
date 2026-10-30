import "@/global.css";

import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { OfflineBanner } from "@/components/offline-banner";
import { applyStoredAppearance } from "@/features/appearance/appearance";
import { SessionProvider } from "@/features/session/session";
import { stackScreenOptions } from "@/lib/screen-options";
import { NAV_THEME, useIOSColors } from "@/lib/theme";

export default function RootLayout() {
  const { scheme } = useIOSColors();
  useEffect(() => {
    void applyStoredAppearance();
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider value={NAV_THEME[scheme]}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ ...stackScreenOptions(scheme), headerLargeTitleEnabled: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="pandas/[slug]/photos" options={{ presentation: "fullScreenModal", title: "照片" }} />
        </Stack>
        <OfflineBanner />
        <PortalHost />
      </ThemeProvider>
    </SessionProvider>
  );
}
