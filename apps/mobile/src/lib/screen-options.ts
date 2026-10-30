import { Platform } from "react-native";

import { semantic } from "@/design/tokens";
import { IOS, type AppearanceScheme } from "@/lib/theme";

/**
 * Native stack chrome.
 *
 * On iOS the bar background is left unset on purpose. expo-router 58 treats a missing
 * header background as the system bar: Liquid Glass on iOS 26, and the system material
 * on earlier iOS. Setting a solid `headerStyle.backgroundColor` turns that off, and a
 * solid large-title bar also hides the title on iOS 26.
 * Android and web get an opaque grouped-background bar. `expo-glass-effect`'s GlassView
 * is a plain View off iOS, so it is not used as a substitute.
 */
export function stackScreenOptions(scheme: AppearanceScheme) {
  const colors = IOS[scheme];
  const opaque = Platform.OS !== "ios";
  return {
    headerShown: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerTintColor: colors.tint,
    headerBackTitle: "返回",
    headerBackButtonDisplayMode: "minimal" as const,
    headerTitleStyle: { color: colors.label, fontWeight: "600" as const },
    headerLargeTitleStyle: { color: colors.label, fontWeight: "700" as const, fontSize: semantic.text.display.size },
    contentStyle: { backgroundColor: colors.groupedBackground },
    ...(opaque
      ? {
          headerStyle: { backgroundColor: colors.groupedBackground },
          headerLargeStyle: { backgroundColor: colors.groupedBackground },
        }
      : {}),
  };
}
