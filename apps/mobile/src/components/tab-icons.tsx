import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// Web has no SF Symbols. These match the four tab jobs; iOS uses the system symbols.

export function TodayIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </Svg>
  );
}

export function FindIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="m16.2 16.2 4 4" />
    </Svg>
  );
}

export function BookIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round">
      <Rect x={3.5} y={3.5} width={7} height={7} rx={1.5} />
      <Rect x={13.5} y={3.5} width={7} height={7} rx={1.5} />
      <Rect x={3.5} y={13.5} width={7} height={7} rx={1.5} />
      <Rect x={13.5} y={13.5} width={7} height={7} rx={1.5} />
    </Svg>
  );
}

export function MeIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={8} r={3.4} />
      <Path d="M5 19.2c1.4-3.2 3.8-4.8 7-4.8s5.6 1.6 7 4.8" />
    </Svg>
  );
}
