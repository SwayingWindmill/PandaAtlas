import { View } from "react-native";

import { ProgressRing } from "@/components/progress-ring";
import { Text } from "@/components/ui/text";

import { catalogPercent } from "./book";

/** 点亮: the pandas met against every published panda, one ring, as Fitness shows a share. */
export function LitCard({ met, catalog, label = "点亮" }: { met: number; catalog: number; label?: string }) {
  const percent = catalogPercent(met, catalog);
  return (
    <View
      className="flex-row items-center gap-stack rounded-group bg-card p-inset"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`${label} ${met} 只，共收录 ${catalog.toLocaleString("zh-CN")} 只，${percent}%`}
    >
      <ProgressRing value={percent / 100} label={`${percent}%`} accessibilityLabel={`点亮 ${percent}%`} />
      <View className="min-w-0 flex-1 gap-hair-gap">
        <Text variant="footnote" className="text-muted-foreground" role="none">
          {label}
        </Text>
        <Text role="none">
          <Text variant="stat">{met.toLocaleString("zh-CN")}</Text>
          <Text variant="subheadline" className="text-muted-foreground tabular-nums">
            {` / ${catalog.toLocaleString("zh-CN")}`}
          </Text>
        </Text>
      </View>
    </View>
  );
}
