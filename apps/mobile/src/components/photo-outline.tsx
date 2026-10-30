import { StyleSheet, View } from "react-native";

import { photoOutline } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";

/**
 * The 1px outline drawn over a photograph, inside its corners. Put it last in the photo's
 * container so it sits on top of the image; it takes no touches.
 */
export function PhotoOutline({ radius = 0 }: { radius?: number }) {
  const { scheme } = useIOSColors();
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, borderCurve: "continuous", borderWidth: 1, borderColor: photoOutline(scheme) },
      ]}
    />
  );
}
