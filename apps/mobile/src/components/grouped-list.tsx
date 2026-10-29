import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";

function Chevron() {
  const color = String(useCSSVariable("--color-muted-foreground"));
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
      <Path d="M1 1l6 6-6 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** An inset grouped section: footnote header, white (or elevated) rounded group, optional footer. */
export function ListSection({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      {title ? <Text variant="footnote" className="px-4 text-muted-foreground">{title}</Text> : null}
      <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
      {footer ? <Text variant="footnote" className="px-4 text-muted-foreground">{footer}</Text> : null}
    </View>
  );
}

/** One row in a grouped section. The separator is inset and stops before the last row. */
export function ListCell({
  label,
  detail,
  meta,
  href,
  onPress,
  last,
  leading,
  accessibilityLabel,
  role = "button",
}: {
  label: string;
  detail?: string;
  meta?: string;
  href?: Href;
  onPress?: () => void;
  last?: boolean;
  leading?: ReactNode;
  accessibilityLabel?: string;
  role?: "button" | "link";
}) {
  const open = href ? () => router.push(href) : onPress;
  return (
    <View>
      <Pressable
        onPress={open}
        disabled={!open}
        role={open ? role : undefined}
        accessibilityLabel={accessibilityLabel ?? label}
        className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
      >
        {leading}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="body" numberOfLines={detail ? 2 : 1}>
            {label}
          </Text>
          {detail ? (
            <Text variant="footnote" className="text-muted-foreground" numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        {meta ? (
          <Text variant="body" className="text-muted-foreground">
            {meta}
          </Text>
        ) : null}
        {open ? <Chevron /> : null}
      </Pressable>
      {last ? null : <View className="ml-4 h-hairline bg-border" />}
    </View>
  );
}
