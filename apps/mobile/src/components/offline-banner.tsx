import { useNetworkState } from "expo-network";
import { View } from "react-native";

import { Text } from "@/components/ui/text";

/**
 * Floats above the content while the device has no connection. Screens keep showing what they already loaded;
 * anything new fails into the screen's own retry state.
 */
export function OfflineBanner() {
  const network = useNetworkState();
  if (network.isConnected !== false && network.isInternetReachable !== false) return null;
  return (
    <View pointerEvents="none" className="absolute inset-x-4 bottom-24 items-center">
      <View role="status" accessibilityLiveRegion="polite" className="rounded-full bg-foreground px-4 py-2.5">
        <Text className="font-bold text-background">没有网络，显示的是已经加载的内容</Text>
      </View>
    </View>
  );
}
