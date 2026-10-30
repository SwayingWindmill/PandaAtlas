import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { Icon } from "@/components/symbol";
import { Text } from "@/components/ui/text";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** At accessibility text sizes a value no longer fits beside its label, so it moves under it. */
export const STACK_AT_FONT_SCALE = 1.35;

export function useStacked() {
  return useWindowDimensions().fontScale >= STACK_AT_FONT_SCALE;
}

/** The disclosure chevron: SF Symbol chevron.forward in tertiary label, as Settings draws it. */
export function Chevron() {
  const { tertiaryLabel } = useIOSColors();
  return <Icon sf="chevron.forward" md="chevron_right" size={14} weight="semibold" color={tertiaryLabel} />;
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
      <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
      {footer ? <Text variant="footnote" className="px-4 text-muted-foreground">{footer}</Text> : null}
    </View>
  );
}

/**
 * One row in a grouped section. The separator is inset and stops before the last row.
 * `meta` is the trailing value (Settings' "detail" text); at large Dynamic Type sizes it
 * wraps under the label instead of squeezing it. `tone="tint"` is an action row.
 */
export function ListCell({
  label,
  detail,
  meta,
  href,
  onPress,
  last,
  leading,
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
  accessibilityLabel?: string;
  accessibilityHint?: string;
  role?: "button" | "link";
  tone?: "label" | "tint";
  /** Lines the label may wrap to. Defaults to 1, or 2 with a detail line. */
  lines?: number;
}) {
  const stacked = useStacked();
  const open = href ? () => router.push(href) : onPress;
  const labelLines = stacked ? undefined : (lines ?? (detail ? 2 : 1));
  const metaText = meta ? (
    <Text
      variant="body"
      className={cn("text-muted-foreground", !stacked && "max-w-[60%] text-right")}
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
        {leading}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="body" className={tone === "tint" ? "text-primary" : undefined} numberOfLines={labelLines}>
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
      {last ? null : <View className={cn("h-hairline bg-border", leading ? "ml-16" : "ml-4")} />}
    </View>
  );
}
