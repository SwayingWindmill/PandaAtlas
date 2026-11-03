import { View } from "react-native";

import { Icon } from "@/components/icon";
import { type LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";

/**
 * A number on a tile, as Fitness and the 图鉴 summary show one: the footnote label (with its
 * glyph, when the row of tiles has them) over the value in `stat`. The tile reads as one sentence.
 */
export function StatTile({ label, value, icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <View
      className="min-w-0 flex-1 gap-hair-gap rounded-tile bg-card p-row"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`${label} ${value}`}
    >
      <View className="flex-row items-center gap-hair-gap">
        {icon ? <Icon icon={icon} size="footnote" /> : null}
        <Text variant="footnote" className="min-w-0 flex-1 text-muted-foreground" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text variant="stat" role="none">
        {value}
      </Text>
    </View>
  );
}
