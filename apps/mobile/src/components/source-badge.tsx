import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { BadgeCheck, Landmark, type LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";

/**
 * Where a fact comes from, as one line: the institution's glyph and name, and a tint BadgeCheck when
 * it is the institution's own publication. The check replaces the word 官方; VoiceOver still hears it.
 */
export function SourceBadge({
  name,
  official = false,
  icon = Landmark,
  verifiedOn,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  /** Overrides the spoken form, e.g. "来源 example.org". */
  accessibilityLabel?: string;
  official?: boolean;
  icon?: LucideIcon;
  /** Spoken only: "核实于 2026 年 10 月 1 日". */
  verifiedOn?: string;
  onPress?: () => void;
}) {
  const label = accessibilityLabel ?? `${name}${official ? "，官方来源" : ""}${verifiedOn ? `，核实于 ${verifiedOn}` : ""}`;
  const body = (
    <View className="flex-row items-center gap-hair-gap">
      <Icon icon={icon} size="footnote" />
      <Text variant="footnote" className="shrink text-muted-foreground" numberOfLines={1}>
        {name}
      </Text>
      {official ? <Icon icon={BadgeCheck} size="footnote" tone="confirmed" strokeWidth={component.iconStroke.bold} /> : null}
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} className="self-start">
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      role="link"
      accessibilityLabel={label}
      hitSlop={(component.hitTarget - component.icon.footnote) / 2}
      className="self-start active:opacity-60"
    >
      {body}
    </Pressable>
  );
}
