import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { component, semantic } from "@/design/tokens";

/**
 * The padding under the last row of a scrolling page.
 *
 * iOS adds the tab bar and the home indicator to the scroll view's own insets
 * (`contentInsetAdjustmentBehavior="automatic"`), so only the page's bottom air is added.
 * Android lays a tab's content out above its bar but draws edge to edge under the system
 * navigation bar, so that inset is added. The web tab bar floats over the page.
 */
export function useBottomClearance() {
  const insets = useSafeAreaInsets();
  const air = semantic.spacing.page.value;
  if (Platform.OS === "ios") return air;
  if (Platform.OS === "web") return air + component.tabBar.webHeight + insets.bottom;
  return air + insets.bottom;
}
