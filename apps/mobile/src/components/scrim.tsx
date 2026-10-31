import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { semantic } from "@/design/tokens";

/**
 * A bottom scrim over a photograph, clear at the top to 72% black at the bottom, so white text
 * holds on any picture. `id` must be unique on the screen: it names the SVG gradient.
 */
export function Scrim({ id, height = "62%" }: { id: string; height?: `${number}%` }) {
  return (
    <Svg
      aria-hidden
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height }}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {semantic.scrim.stops.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={semantic.scrim.color} stopOpacity={stop.opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
