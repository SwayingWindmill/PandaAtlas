import { Platform, StyleSheet } from "react-native";

import { semantic } from "@/design/tokens";
import { type AppearanceScheme } from "@/lib/theme";

export { concentric } from "@/design/tokens";

/**
 * One device pixel. Native draws `StyleSheet.hairlineWidth`; react-native-web reports 1 there,
 * so the web export draws the 0.5px line browsers render as a hairline on a Retina screen.
 */
export const HAIRLINE = Platform.OS === "web" ? 0.5 : StyleSheet.hairlineWidth;

/**
 * Corner radii, nested concentrically: an element inside a rounded surface takes the outer radius
 * minus the padding between them, so the two curves share a centre.
 *   card 24, padding 16 → inner 8       a featured 今天 card and what sits on it
 *   tile 16, padding 12 → inner 4       a stat block, a resident tile, a small 今天 card
 *   chip = height / 2, padding 4 → avatar = chip − 4
 */
export const RADIUS = {
  card: semantic.radius.card.value,
  tile: semantic.radius.tile.value,
  control: semantic.radius.control.value,
  group: semantic.radius.group.value,
} as const;

/**
 * The edge on a photograph: 1px of pure black at 10% in light mode, pure white at 10% in dark,
 * so a pale photo does not bleed into a white card and a dark one keeps its edge on black.
 * Never a tinted or neutral grey: on a photo that reads as dirt.
 */
export function photoOutline(scheme: AppearanceScheme) {
  return semantic.color[scheme].photoStroke;
}
