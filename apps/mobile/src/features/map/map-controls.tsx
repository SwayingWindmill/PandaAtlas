import { Pressable, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { Globe, Layers, type LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { MapFilter, MapFilterCounts } from "@/features/map/map-filter";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

export const MAP_BUTTON_SIZE = 44;
export const MAP_FLOAT_SHADOW = "0 1px 2px rgba(0,0,0,0.1), 0 4px 14px rgba(0,0,0,0.1)";

export function FilterBar({
  active,
  counts,
  onSelect,
}: {
  active: MapFilter;
  counts: MapFilterCounts;
  onSelect: (filter: MapFilter) => void;
}) {
  const pills: { key: MapFilter; label: string }[] = [
    { key: "all", label: counts.all > 0 ? `全部 ${counts.all}` : "全部" },
    { key: "china", label: counts.china > 0 ? `国内 ${counts.china}` : "国内" },
    { key: "overseas", label: counts.overseas > 0 ? `海外 ${counts.overseas}` : "海外" },
    { key: "live", label: "有直播" },
    { key: "wild", label: "野生区" },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-gutter py-1"
      accessibilityRole="tablist"
    >
      {pills.map((pill) => {
        const selected = active === pill.key;
        return (
          <Pressable
            key={pill.key}
            role="tab"
            aria-selected={selected}
            accessibilityState={{ selected }}
            accessibilityLabel={pill.label}
            hitSlop={4}
            onPress={() => onSelect(pill.key)}
            className={cn(
              "h-9 items-center justify-center rounded-full px-3.5 active:opacity-75",
              selected ? "bg-foreground" : "bg-paper",
            )}
            style={{ boxShadow: MAP_FLOAT_SHADOW }}
          >
            <Text
              variant="subheadline"
              className={cn("font-semibold tabular-nums", selected ? "text-background" : "text-foreground")}
            >
              {pill.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ViewControls({
  overseas,
  worldView,
  wild,
  onToggleWorld,
  onToggleWild,
}: {
  overseas: number;
  worldView: boolean;
  wild: boolean;
  onToggleWorld: () => void;
  onToggleWild: () => void;
}) {
  return (
    <View className="overflow-hidden rounded-control bg-paper" style={{ width: MAP_BUTTON_SIZE, boxShadow: MAP_FLOAT_SHADOW }}>
      <Pressable
        role="button"
        accessibilityLabel={worldView ? "回到中国西南" : `查看全球视野${overseas > 0 ? `，含海外 ${overseas} 个地方` : ""}`}
        onPress={onToggleWorld}
        className="items-center justify-center active:opacity-60"
        style={{ height: MAP_BUTTON_SIZE }}
      >
        <Icon icon={Globe} size={21} tone={worldView ? "tint" : "label"} strokeWidth={2} />
      </Pressable>
      <View className="mx-2 bg-border" style={{ height: HAIRLINE }} />
      <Pressable
        role="switch"
        accessibilityLabel="野生区图层"
        aria-checked={wild}
        onPress={onToggleWild}
        className="items-center justify-center active:opacity-60"
        style={{ height: MAP_BUTTON_SIZE }}
      >
        <Icon icon={Layers} size={21} tone={wild ? "tint" : "secondary"} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

export function MapStat({ icon, value, label, tone = "tint" }: { icon: LucideIcon; value: string; label: string; tone?: "tint" | "wild" }) {
  const [wildInk] = useCSSVariable(["--color-map-wild-ink"]).map(String) as [string];
  return (
    <View
      className="min-w-0 flex-1 gap-1 rounded-group bg-card p-row"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`${label} ${value}`}
    >
      {tone === "wild" ? (
        <Icon icon={icon} size="subhead" color={wildInk} strokeWidth={2} />
      ) : (
        <Icon icon={icon} size="subhead" tone="tint" strokeWidth={2} />
      )}
      <Text variant="stat" role="none" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="footnote" role="none" className="text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
