import { useNetworkState } from "expo-network";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";

/**
 * Sits under the status bar while the device has no connection. Screens keep showing what they
 * already loaded; anything new fails into the screen's own retry state.
 */
export function OfflineBanner() {
  const network = useNetworkState();
  const insets = useSafeAreaInsets();
  if (network.isConnected !== false && network.isInternetReachable !== false) return null;
  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-0 z-10" style={{ paddingTop: insets.top }}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" className="border-b-hairline border-border bg-card px-4 py-2">
        <Text variant="footnote" className="text-center text-foreground">
          没有网络，显示的是已经加载的内容
        </Text>
      </View>
    </View>
  );
}
