import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { use } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { component, semantic } from "@/design/tokens";

/**
 * The padding under the last row of a scrolling page.
 *
 * iOS adds the tab bar and the home indicator to the scroll view's own insets
 * (`contentInsetAdjustmentBehavior="automatic"`), so only the page's bottom air is added.
 * Android draws edge to edge, and on a tab its capsule bar floats over the page, so the bar's full
 * height (which counts the navigation bar) is added there and the navigation bar's inset elsewhere.
 * The web tab bar floats over the page too.
 */
export function useBottomClearance() {
  const insets = useSafeAreaInsets();
  const tabBar = use(BottomTabBarHeightContext);
  const air = semantic.spacing.page.value;
  if (Platform.OS === "ios") return air;
  if (Platform.OS === "web") return air + component.tabBar.webHeight + insets.bottom;
  return air + (tabBar ?? insets.bottom);
}
