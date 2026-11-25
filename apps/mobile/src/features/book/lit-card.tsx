import { View } from "react-native";

import { useStacked } from "@/components/grouped-list";
import { ProgressRing } from "@/components/progress-ring";
import { Text } from "@/components/ui/text";
import { HAIRLINE } from "@/lib/surface";
import { IOS } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { catalogPercent } from "./book";

function PassportCounter({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View className="flex-1 items-center gap-hair-gap px-hair-gap" role="none">
      <Text variant="footnote" style={{ color: IOS.dark.secondaryLabel }} numberOfLines={1} role="none">
        {label}
      </Text>
      <Text role="none">
        <Text variant="stat" className="text-on-media" role="none">
          {value.toLocaleString("zh-CN")}
        </Text>
        <Text variant="footnote" className="font-semibold text-on-media" role="none">
          {` ${unit}`}
        </Text>
      </Text>
    </View>
  );
}

/**
 * Obsidian Panda Passport Hero Cover: dark ink surface in light mode, elevated dark card with hairline
 * border in dark mode, combining overall 点亮 ring progress and 3-column passport counters.
 */
export function LitCard({
  met,
  catalog,
  seenCount,
  recognizedCount,
  visitedPlaces,
  label = "点亮",
}: {
  met: number;
  catalog: number;
  seenCount?: number;
  recognizedCount?: number;
  visitedPlaces?: number;
  label?: string;
}) {
  const stacked = useStacked();
  const percent = catalogPercent(met, catalog);
  const showCounters =
    seenCount !== undefined && recognizedCount !== undefined && visitedPlaces !== undefined;
  const eyebrow = label === "点亮" ? "吱熊猫　个人图鉴护照" : label;
  const dividerColor = IOS.dark.separator;

  return (
    <View
      className="gap-inset rounded-card bg-button p-inset dark:border-hairline dark:border-border dark:bg-card"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`${label} ${met} 只，共收录 ${catalog.toLocaleString("zh-CN")} 只，${percent}%`}
    >
      <View className={stacked ? "gap-row" : "flex-row items-center gap-stack"}>
        <ProgressRing value={percent / 100} trackColor={IOS.dark.fill} accessibilityLabel={`点亮 ${percent}%`}>
          <Text variant="subheadline" className="font-rounded font-semibold text-on-media tabular-nums" role="none">
            {`${percent}%`}
          </Text>
        </ProgressRing>
        <View className={cn("gap-hair-gap", !stacked && "min-w-0 flex-1")}>
          <Text variant="footnote" style={{ color: IOS.dark.secondaryLabel }} role="none">
            {eyebrow}
          </Text>
          <Text role="none">
            <Text variant="figure" className="text-on-media" role="none">
              {met.toLocaleString("zh-CN")}
            </Text>
            <Text variant="subheadline" className="tabular-nums" style={{ color: IOS.dark.secondaryLabel }} role="none">
              {` / ${catalog.toLocaleString("zh-CN")} 只大熊猫`}
            </Text>
          </Text>
        </View>
      </View>

      {showCounters ? (
        <>
          <View style={{ height: HAIRLINE, backgroundColor: dividerColor }} aria-hidden />
          {stacked ? (
            <View className="gap-stack-tight" role="none">
              {[
                { label: "现场见过", value: seenCount, unit: "只" },
                { label: "猜谜认出", value: recognizedCount, unit: "只" },
                { label: "去过场馆", value: visitedPlaces, unit: "处" },
              ].map((item) => (
                <View key={item.label} className="flex-row items-baseline justify-between gap-row" role="none">
                  <Text variant="footnote" style={{ color: IOS.dark.secondaryLabel }} role="none">
                    {item.label}
                  </Text>
                  <Text variant="headline" className="font-rounded font-bold text-on-media tabular-nums" role="none">
                    {`${item.value.toLocaleString("zh-CN")} ${item.unit}`}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-row items-stretch" role="none">
              <PassportCounter label="现场见过" value={seenCount} unit="只" />
              <View style={{ width: HAIRLINE, backgroundColor: dividerColor }} aria-hidden />
              <PassportCounter label="猜谜认出" value={recognizedCount} unit="只" />
              <View style={{ width: HAIRLINE, backgroundColor: dividerColor }} aria-hidden />
              <PassportCounter label="去过场馆" value={visitedPlaces} unit="处" />
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}
