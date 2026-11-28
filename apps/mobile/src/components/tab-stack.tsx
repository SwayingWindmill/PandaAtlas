import { Stack } from "expo-router";
import { Platform } from "react-native";

import { stackScreenOptions } from "@/lib/screen-options";
import { useIOSColors } from "@/lib/theme";

/** One native stack per tab, so the root screen can use a collapsing large title. */
export function TabStack({ title }: { title: string }) {
  const { scheme } = useIOSColors();
  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions(scheme),
        title,
        headerLargeTitleEnabled: Platform.OS === "ios",
        // Off iOS a tab root has no bar; its column draws the title (`ROOT_TITLE_IN_COLUMN`).
        headerShown: Platform.OS === "ios",
      }}
    />
  );
}
