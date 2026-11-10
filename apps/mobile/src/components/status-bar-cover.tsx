import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Android draws edge to edge under a see-through status bar. A screen with no navigation bar has
 * nothing over that strip, so its content would scroll through the clock. This covers the strip with
 * the page ground. iOS and web have no such strip to cover: the bar or the browser owns it.
 */
export function StatusBarCover() {
  const { top } = useSafeAreaInsets();
  if (Platform.OS !== "android") return null;
  return <View pointerEvents="none" className="absolute inset-x-0 top-0 z-10 bg-background" style={{ height: top }} />;
}
