import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { Check, ChevronRight, type LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component, semantic } from "@/design/tokens";
import { cssEasing } from "@/design/motion";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** At accessibility text sizes a value no longer fits beside its label, so it moves under it. */
export const STACK_AT_FONT_SCALE = 1.35;
/**
 * Below this window width (a phone at 200% browser zoom, or a split-screen sliver) rows stack as they
 * do at accessibility sizes, and grids drop to one column. On the web the text size reaches the layout
 * only as zoom, so width is the signal there.
 */
export const NARROW_WIDTH = 280;

/** True when rows should stack: an accessibility text size, or a narrow window. */
export function useStacked() {
  const { fontScale, width } = useWindowDimensions();
  return fontScale >= STACK_AT_FONT_SCALE || width < NARROW_WIDTH;
}

/** True at the largest text sizes or in a narrow window: a grid goes to one column. */
export function useSingleColumn() {
  const { fontScale, width } = useWindowDimensions();
  return fontScale >= 2 || width < NARROW_WIDTH;
}

/** The disclosure chevron in tertiary label, as Settings draws it. */
export function Chevron() {
  return <Icon icon={ChevronRight} size={component.icon.chevron} tone="tertiary" strokeWidth={2.25} />;
}

/** Where a row's separator starts when it has a leading icon or glyph square: under the label, as in Settings. */
export const ICON_INSET = { marginLeft: component.listRow.iconInset } as const;
const GLYPH_INSET = { marginLeft: component.settingsGlyph.inset } as const;
/** At the default text size a trailing value takes at most this share of the row. */
const META_MAX = { maxWidth: "60%" } as const;

/**
 * A 设置 row's glyph: the bare glyph, centred in a 30pt slot so labels line up. No tile behind it
 * (v2.15: icons never sit in a square, a rounded tile or a circle; DESIGN.md, "Icons").
 */
export function GlyphSquare({ icon, tone = "tint" }: { icon: LucideIcon; tone?: "tint" | "destructive" }) {
  const size = component.settingsGlyph.size;
  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Icon icon={icon} size={component.settingsGlyph.icon} tone={tone === "tint" ? "label" : "secondary"} />
    </View>
  );
}

/** An inset grouped section: footnote header, white (or elevated) rounded group, optional footer. */
export function ListSection({
  title,
  titleIcon,
  footer,
  children,
}: {
  title?: string;
  /** A secondary glyph before the header naming the section's kind (家族, 动态). Decoration only. */
  titleIcon?: LucideIcon;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      {title ? <SectionTitle title={title} icon={titleIcon} /> : null}
      <View className="overflow-hidden rounded-group bg-card">{children}</View>
      {footer ? <Text variant="footnote" className="px-4 text-muted-foreground">{footer}</Text> : null}
    </View>
  );
}

/** A grouped section's footnote header, with an optional leading glyph, aligned with the rows' text. */
export function SectionTitle({ title, icon }: { title: string; icon?: LucideIcon }) {
  return (
    <View className="flex-row items-center gap-hair-gap px-4">
      {icon ? <Icon icon={icon} size="footnote" /> : null}
      <Text variant="footnote" role="heading" className="text-muted-foreground">
        {title}
      </Text>
    </View>
  );
}

/**
 * One row in a grouped section. The separator is inset and stops before the last row.
 * `meta` is the trailing value (Settings' "detail" text); at large Dynamic Type sizes it
 * wraps under the label instead of squeezing it. `tone="tint"` is an action row.
 * `icon` is a leading glyph that names the row's category (出生, 地址, 官网); give one to every
 * row in a group or to none, and never to a row that is itself data (a name, an event).
 */
export function ListCell({
  label,
  detail,
  meta,
  href,
  onPress,
  last,
  leading,
  icon,
  glyph,
  accessibilityLabel,
  accessibilityHint,
  role = "button",
  tone = "label",
  lines,
  chevron = true,
  checked,
  trailing,
}: {
  label: string;
  detail?: string;
  meta?: string;
  href?: Href;
  onPress?: () => void;
  last?: boolean;
  leading?: ReactNode;
  icon?: LucideIcon;
  /** A glyph in a tinted square: 设置 only. */
  glyph?: LucideIcon;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  role?: "button" | "link";
  /** `tint` is an action row; `destructive` is 退出登录, centered and in red. */
  tone?: "label" | "tint" | "destructive";
  /** Lines the label may wrap to. Defaults to 1, or 2 with a detail line. */
  lines?: number;
  /** The disclosure chevron on a tappable row. Off for a row that chooses rather than opens (a picker). */
  chevron?: boolean;
  /** A picker row: a trailing checkmark on the chosen one, read as selected. */
  checked?: boolean;
  /** Drawn before the meta and chevron: the parents' faces on the 父母 row. */
  trailing?: ReactNode;
}) {
  const stacked = useStacked();
  const open = href ? () => router.push(href) : onPress;
  const labelLines = stacked ? undefined : (lines ?? (detail ? 2 : 1));
  const metaText = meta ? (
    <Text
      variant="body"
      className={cn("text-muted-foreground", !stacked && "text-right")}
      style={stacked ? undefined : META_MAX}
      numberOfLines={stacked ? undefined : 2}
    >
      {meta}
    </Text>
  ) : null;
  return (
    <View>
      <Pressable
        onPress={open}
        disabled={!open}
        role={open ? role : undefined}
        accessibilityLabel={accessibilityLabel ?? (meta ? `${label}，${meta}` : label)}
        accessibilityHint={accessibilityHint}
        accessibilityState={checked === undefined ? undefined : { selected: checked }}
        className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
      >
        {glyph ? <GlyphSquare icon={glyph} /> : icon ? <Icon icon={icon} tone={tone === "tint" ? "tint" : "secondary"} /> : leading}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            variant="body"
            className={cn(tone === "tint" && "text-primary", tone === "destructive" && "text-center text-destructive")}
            numberOfLines={labelLines}
          >
            {label}
          </Text>
          {detail ? (
            <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
              {detail}
            </Text>
          ) : null}
          {stacked ? metaText : null}
        </View>
        {trailing}
        {stacked ? null : metaText}
        {checked ? <Icon icon={Check} size="body" tone="tint" strokeWidth={2.5} /> : null}
        {open && chevron && checked === undefined && tone === "label" ? <Chevron /> : null}
      </Pressable>
      {last ? null : (
        <View
          className={cn("bg-border", !glyph && !icon && (leading ? "ml-16" : "ml-4"))}
          style={[{ height: HAIRLINE }, glyph ? GLYPH_INSET : icon ? ICON_INSET : null]}
        />
      )}
    </View>
  );
}

/**
 * A row with a switch, as Settings draws one: the whole row is the control, so it is a 44pt target and
 * VoiceOver reads "名字，开关，开" once. The track is drawn, not a second control. At large sizes it stacks.
 */
export function SwitchRow({
  label,
  value,
  onChange,
  glyph,
  accessibilityLabel,
  separator = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** A hairline under the row, inset as ListCell's, when another row follows in the group. */
  separator?: boolean;
  glyph?: LucideIcon;
  accessibilityLabel?: string;
}) {
  // At accessibility sizes or in a narrow window the switch moves under its label, as a value does.
  const stacked = useStacked();
  return (
    <View>
      <Pressable
        role="switch"
        aria-checked={value}
        accessibilityState={{ checked: value }}
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={() => onChange(!value)}
        className={cn(
          "min-h-11 gap-row px-inset py-stack-tight active:bg-accent",
          stacked ? "items-start" : "flex-row items-center",
        )}
      >
        <View className={cn("flex-row items-center gap-row", stacked ? "self-stretch" : "min-w-0 flex-1")}>
          {glyph ? <GlyphSquare icon={glyph} /> : null}
          <Text variant="body" className="min-w-0 flex-1">
            {label}
          </Text>
        </View>
        <SwitchTrack on={value} />
      </Pressable>
      {separator ? (
        <View
          className={cn("bg-border", !glyph && "ml-4")}
          style={[{ height: HAIRLINE }, glyph ? GLYPH_INSET : null]}
        />
      ) : null}
    </View>
  );
}

/** The iOS switch's look: a 51×31 pill with a 27pt knob, in ink when on. Decoration for SwitchRow. */
function SwitchTrack({ on }: { on: boolean }) {
  const reduced = useReducedMotion();
  const { width, height, knob } = component.switchTrack;
  const inset = (height - knob) / 2;
  const transition = {
    transitionDuration: reduced ? 0 : semantic.motion.move.duration,
    transitionTimingFunction: cssEasing("inOut"),
  } as const;
  return (
    <Animated.View
      aria-hidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className={on ? "bg-foreground dark:bg-graphic" : "bg-input"}
      style={{ width, height, borderRadius: height / 2, transitionProperty: "backgroundColor", ...transition }}
    >
      <Animated.View
        className="absolute bg-switch-knob shadow-sm"
        style={{
          top: inset,
          left: inset,
          width: knob,
          height: knob,
          borderRadius: knob / 2,
          transform: [{ translateX: on ? width - knob - inset * 2 : 0 }],
          transitionProperty: "transform",
          ...transition,
        }}
      />
    </Animated.View>
  );
}
