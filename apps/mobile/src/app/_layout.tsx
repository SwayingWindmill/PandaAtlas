import "@/global.css";

import { PortalHost } from "@rn-primitives/portal";
import { router, Stack, type ErrorBoundaryProps } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";

import { OfflineBanner } from "@/components/offline-banner";
import { applyStoredAppearance } from "@/features/appearance/appearance";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { SessionProvider } from "@/features/session/session";
import { installGlobalErrorReporting, reportError } from "@/lib/error-reporting";
import { QueryProvider } from "@/lib/query-provider";
import { stackScreenOptions } from "@/lib/screen-options";
import { useSilentUpdates } from "@/lib/ota";
import { NAV_THEME, useIOSColors } from "@/lib/theme";

installGlobalErrorReporting();

// Expo Router renders this in place of the whole app when a screen throws while rendering. It sits
// outside the providers above, so it uses nothing from them.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, "error-boundary");
  }, [error]);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
      <Text variant="title" className="text-center">
        页面出了点问题
      </Text>
      <Text variant="body" className="text-center text-muted-foreground">
        我们已经记下这次错误。可以再试一次，或者先回到首页。
      </Text>
      <View className="flex-row gap-3">
        <Button variant="secondary" onPress={() => void retry()}>
          <Text>重试</Text>
        </Button>
        <Button
          onPress={() => {
            router.replace("/");
            void retry();
          }}
        >
          <Text>回首页</Text>
        </Button>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const { scheme } = useIOSColors();
  useSilentUpdates();
  useEffect(() => {
    void applyStoredAppearance();
  }, []);

  return (
    <QueryProvider>
      <SessionProvider>
        <ThemeProvider value={NAV_THEME[scheme]}>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <Stack screenOptions={{ ...stackScreenOptions(scheme), headerLargeTitleEnabled: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="pandas/[slug]/photos" options={{ title: "照片" }} />
          </Stack>
          <OfflineBanner />
          <PortalHost />
        </ThemeProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
