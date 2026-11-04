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

/**
 * The fade over a full-bleed hero: a light shade under the status bar and the floating buttons, and the
 * photo's bottom running into the page, so the name can sit on it. `id` names the SVG gradient.
 */
export function HeroFade({ id, page }: { id: string; page: string }) {
  return (
    <Svg
      aria-hidden
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={semantic.scrim.color} stopOpacity={0.38} />
          <Stop offset="0.26" stopColor={semantic.scrim.color} stopOpacity={0} />
          <Stop offset="0.58" stopColor={page} stopOpacity={0} />
          <Stop offset="1" stopColor={page} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
