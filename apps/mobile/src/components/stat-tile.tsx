import { type Href, router } from "expo-router";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { type LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";

/**
 * A number on a tile, as Fitness and the 图鉴 summary show one: the footnote label (with its
 * tint glyph, when the row of tiles has them) over the value in `stat`, its unit smaller beside it. The tile reads as one sentence;
 * with `href` it opens the list the number counts.
 */
export function StatTile({ label, value, icon, href }: { label: string; value: string; icon?: LucideIcon; href?: Href }) {
  const Tile = href ? Pressable : View;
  // "12 只": the number in `stat`, the unit at footnote size beside it, as the panda page's tiles.
  const [, amount = value, unit] = /^([\d,.—-]+)\s*(.*)$/.exec(value) ?? [];
  return (
    <Tile
      className="min-w-0 flex-1 gap-hair-gap rounded-group bg-card p-row active:opacity-70"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`${label} ${value}`}
      {...(href ? { role: "link" as const, onPress: () => router.push(href) } : {})}
    >
      <View className="flex-row items-center gap-hair-gap">
        {icon ? <Icon icon={icon} size="footnote" tone="tint" /> : null}
        <Text variant="footnote" className="min-w-0 flex-1 font-semibold text-muted-foreground" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <View className="flex-row items-baseline gap-0.5">
        <Text variant="stat" role="none">
          {amount}
        </Text>
        {unit ? (
          <Text role="none" className="text-footnote font-semibold">
            {unit}
          </Text>
        ) : null}
      </View>
    </Tile>
  );
}
