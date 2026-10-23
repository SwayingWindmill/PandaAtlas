import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink, fontWeight: "600" },
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ title: "吱熊猫" }} />
        <Stack.Screen name="daily" options={{ title: "每日一猫" }} />
      </Stack>
    </>
  );
}
