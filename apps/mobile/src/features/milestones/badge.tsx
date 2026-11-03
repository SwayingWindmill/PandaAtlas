import { View } from "react-native";

import { Text } from "@/components/ui/text";

/**
 * A milestone's chip: the 笋金 warm badge (DESIGN.md, Accent), which marks what is about time, never an action.
 * The words carry the meaning; the color only adds to them.
 */
export function MilestoneBadge({ label }: { label: string }) {
  return (
    <View className="self-start rounded-pill bg-warm-soft px-stack-tight py-hair-gap" style={{ borderCurve: "continuous" }}>
      <Text variant="footnote" className="font-semibold text-warm tabular-nums">
        {label}
      </Text>
    </View>
  );
}
