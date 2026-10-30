import { type AndroidSymbol, type SFSymbol, SymbolView } from "expo-symbols";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";

/**
 * One icon, drawn as a real SF Symbol on iOS and as the matching Material Symbol on Android
 * and web (expo-symbols loads the Material Symbols font there). Icons are decoration: the
 * control that holds one carries the accessible name.
 */
export function Icon({
  sf,
  md,
  size = 24,
  color,
  weight = "regular",
  style,
}: {
  sf: SFSymbol;
  md: AndroidSymbol;
  size?: number;
  color: ColorValue;
  weight?: "regular" | "medium" | "semibold";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={{ ios: sf, android: md, web: md }}
      size={size}
      tintColor={color}
      weight={weight}
      style={style}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
