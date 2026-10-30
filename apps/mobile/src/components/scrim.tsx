import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * A bottom scrim over a photograph, clear at the top to 72% black at the bottom, so white text
 * holds on any picture. `id` must be unique on the screen: it names the SVG gradient.
 */
export function Scrim({ id, height = "62%" }: { id: string; height?: `${number}%` }) {
  return (
    <Svg
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height }}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0" />
          <Stop offset="0.45" stopColor="#000" stopOpacity="0.32" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
