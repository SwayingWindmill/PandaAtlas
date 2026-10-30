import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { Icon } from "@/components/icon";
import { ChevronRight, type LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** At accessibility text sizes a value no longer fits beside its label, so it moves under it. */
export const STACK_AT_FONT_SCALE = 1.35;

export function useStacked() {
  return useWindowDimensions().fontScale >= STACK_AT_FONT_SCALE;
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
 * A 设置 row's glyph: the tint drawn in a 30pt square of the tinted fill, as the system Settings
 * app draws its rows. Only 设置 uses it (DESIGN.md, "Icons").
 */
export function GlyphSquare({ icon, tone = "tint" }: { icon: LucideIcon; tone?: "tint" | "destructive" }) {
  const size = component.settingsGlyph.size;
  return (
    <View
      className={cn("items-center justify-center rounded-glyph", tone === "tint" ? "bg-highlight-soft" : "bg-secondary")}
      style={{ width: size, height: size, borderCurve: "continuous" }}
    >
      <Icon icon={icon} size={component.settingsGlyph.icon} tone={tone === "tint" ? "tint" : "secondary"} strokeWidth={2} />
    </View>
  );
}

/** An inset grouped section: footnote header, white (or elevated) rounded group, optional footer. */
export function ListSection({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      {title ? (
        <Text variant="footnote" role="heading" className="px-4 text-muted-foreground">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-group bg-card">{children}</View>
      {footer ? <Text variant="footnote" className="px-4 text-muted-foreground">{footer}</Text> : null}
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
        {stacked ? null : metaText}
        {open && tone === "label" ? <Chevron /> : null}
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
