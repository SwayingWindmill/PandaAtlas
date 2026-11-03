import { useNetworkState } from "expo-network";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";

/**
 * Space left for the tab bar under the notice. The native tab bar's height cannot be read from a
 * root layout, so this is the iOS 26 floating bar's (the tallest of them) plus a gap; on a screen
 * without a tab bar the notice just sits a little higher.
 */
const TAB_BAR_ROOM = Platform.OS === "web" ? component.tabBar.webHeight + 8 : 64;

/**
 * A small notice above the tab bar while the device has no connection. Screens keep showing what
 * they already loaded; anything new fails into the screen's own retry state. It stays off the
 * navigation bar, so the title, back button and large title are never covered, and touches pass
 * through it.
 */
export function OfflineBanner() {
  const network = useNetworkState();
  const insets = useSafeAreaInsets();
  if (network.isConnected !== false && network.isInternetReachable !== false) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 z-10 items-center px-4"
      style={{ bottom: insets.bottom + TAB_BAR_ROOM }}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="rounded-full border-hairline border-border bg-card px-4 py-2"
      >
        <Text variant="footnote" className="text-center text-foreground">
          没有网络，显示的是已经加载的内容
        </Text>
      </View>
    </View>
  );
}
