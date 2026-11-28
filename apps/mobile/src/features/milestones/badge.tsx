import { View } from "react-native";

import { Text } from "@/components/ui/text";

/**
 * A milestone's chip: a neutral grey capsule with the number in the body color (v2.15: no gold, no colored cards).
 * The words carry the meaning; the color only adds to them.
 */
export function MilestoneBadge({ label }: { label: string }) {
  return (
    <View className="self-start rounded-pill bg-secondary px-stack-tight py-hair-gap" style={{ borderCurve: "continuous" }}>
      <Text variant="footnote" className="font-rounded font-semibold tabular-nums">
        {label}
      </Text>
    </View>
  );
}
