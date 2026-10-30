import { type ColorValue, Platform, type StyleProp, type ViewStyle } from "react-native";

import type { LucideIcon } from "@/components/icons";
import { component } from "@/design/tokens";
import { useIOSColors } from "@/lib/theme";

/**
 * Icon sizes follow the text they sit beside, the way SF Symbols scale with their text style.
 * A row icon beside body text is 22; beside a footnote, 15.
 */
export const ICON_SIZE = {
  footnote: component.icon.footnote,
  subhead: component.icon.subhead,
  body: component.icon.body,
  title3: component.icon.title3,
} as const;

// The DOM has no `accessible` attribute; aria-hidden covers web.
const HIDDEN = Platform.OS === "web" ? {} : { accessible: false };

/**
 * Who an icon speaks for. `secondary` is the default: a row's icon names a category, it is not
 * a control. `tint` is only for an icon on an action row (the row is the control). `tertiary`
 * is the disclosure chevron. `label` and `onMedia` are for toolbar glyphs.
 */
export type IconTone = "secondary" | "tint" | "tertiary" | "label" | "onMedia";

/**
 * One Lucide glyph, drawn with react-native-svg on iOS, Android and web alike. Strokes are
 * 1.75 by default (2 for small chevrons and toolbar glyphs). Icons are decoration: the row or
 * button that holds one carries the accessible name.
 */
export function Icon({
  icon: Glyph,
  size = "body",
  tone = "secondary",
  color,
  strokeWidth = component.iconStroke.regular,
  style,
}: {
  icon: LucideIcon;
  size?: keyof typeof ICON_SIZE | number;
  tone?: IconTone;
  /** Overrides tone, for a navigator that hands the color in (the web tab bar). */
  color?: ColorValue;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useIOSColors();
  const toneColor = {
    secondary: colors.secondaryLabel,
    tint: colors.tint,
    tertiary: colors.tertiaryLabel,
    label: colors.label,
    onMedia: colors.onMedia,
  }[tone];
  const px = typeof size === "number" ? size : ICON_SIZE[size];
  return (
    <Glyph
      size={px}
      color={String(color ?? toneColor)}
      strokeWidth={strokeWidth}
      style={style}
      aria-hidden
      {...HIDDEN}
    />
  );
}
