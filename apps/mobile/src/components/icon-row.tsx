import { View } from "react-native";

import { Icon, type IconTone } from "@/components/icon";
import type { LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";

/**
 * A glyph and a short line, for meta under a title (所在地, 开放时间, 出生): the glyph names the
 * kind of fact so the line needs no "所在地：" prefix. Footnote by default; `subhead` beside body text.
 * `trailing` holds a status mark. The glyph is decoration; pass `accessibilityLabel` when the
 * line alone would not say what it is.
 */
export function IconRow({
  icon,
  text,
  size = "footnote",
  tone = "secondary",
  trailing,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  text: string;
  size?: "footnote" | "subhead";
  tone?: IconTone;
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <View className="flex-row items-center gap-hair-gap" accessible={Boolean(accessibilityLabel)} accessibilityLabel={accessibilityLabel}>
      <Icon icon={icon} size={size} tone={tone} />
      <Text variant={size === "footnote" ? "footnote" : "subheadline"} className="shrink text-muted-foreground tabular-nums" numberOfLines={2}>
        {text}
      </Text>
      {trailing}
    </View>
  );
}
