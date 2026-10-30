import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { AndroidSymbol, SFSymbol } from "expo-symbols";
import { Platform, Pressable, View } from "react-native";

import { Icon } from "@/components/symbol";
import { useIOSColors } from "@/lib/theme";

const SIZE = 44;

/**
 * A circular toolbar button that floats over a photo: Liquid Glass on iOS 26, and a dark
 * translucent disc elsewhere (with a CSS blur on web) so the white symbol stays legible
 * on any picture.
 */
export function GlassButton({
  sf,
  md,
  label,
  onPress,
}: {
  sf: SFSymbol;
  md: AndroidSymbol;
  label: string;
  onPress: () => void;
}) {
  const { scheme, label: labelColor } = useIOSColors();
  const glass = Platform.OS === "ios" && isLiquidGlassAvailable();
  const icon = <Icon sf={sf} md={md} size={20} weight="semibold" color={glass ? labelColor : "#FFFFFF"} />;
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={label}
      hitSlop={4}
      className="active:opacity-70"
      style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: "hidden" }}
    >
      {glass ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          colorScheme={scheme}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: SIZE / 2 }}
        >
          {icon}
        </GlassView>
      ) : (
        <View
          style={[
            { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.38)" },
            Platform.OS === "web" ? ({ backdropFilter: "blur(20px) saturate(1.6)" } as object) : null,
          ]}
        >
          {icon}
        </View>
      )}
    </Pressable>
  );
}
