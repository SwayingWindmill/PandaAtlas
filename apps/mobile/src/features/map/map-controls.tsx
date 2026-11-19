import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { Globe, House, LocateFixed, type LucideIcon, Trees } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

export const MAP_BUTTON_SIZE = 44;
export const MAP_FLOAT_SHADOW = "0 1px 2px rgba(0,0,0,0.1), 0 4px 14px rgba(0,0,0,0.1)";

export function FloatingButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="items-center justify-center rounded-full bg-paper active:opacity-70"
      style={{ width: MAP_BUTTON_SIZE, height: MAP_BUTTON_SIZE, boxShadow: MAP_FLOAT_SHADOW }}
    >
      {children}
    </Pressable>
  );
}

export function LayerToggle({
  venues,
  wild,
  onVenues,
  onWild,
}: {
  venues: boolean;
  wild: boolean;
  onVenues: () => void;
  onWild: () => void;
}) {
  const pill = (on: boolean, icon: LucideIcon, label: string, onPress: () => void) => (
    <Pressable
      role="switch"
      accessibilityLabel={label}
      aria-checked={on}
      onPress={onPress}
      className={cn("h-9 flex-row items-center gap-1 rounded-full px-3 active:opacity-70", on ? "bg-primary" : "")}
    >
      <Icon icon={icon} size="subhead" tone={on ? "onButton" : "label"} strokeWidth={2} />
      <Text variant="subheadline" className={cn("font-semibold", on ? "text-primary-foreground" : "")}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View className="flex-row gap-1 rounded-full bg-paper p-1" style={{ boxShadow: MAP_FLOAT_SHADOW }}>
      {pill(venues, House, "场馆", onVenues)}
      {pill(wild, Trees, "野生区", onWild)}
    </View>
  );
}

export function ViewControls({ overseas, onOverseas, onHome }: { overseas: number; onOverseas: () => void; onHome: () => void }) {
  return (
    <View className="overflow-hidden rounded-control bg-paper" style={{ width: MAP_BUTTON_SIZE, boxShadow: MAP_FLOAT_SHADOW }}>
      {overseas > 0 ? (
        <>
          <Pressable
            role="button"
            accessibilityLabel={`看海外的 ${overseas} 个地方`}
            onPress={onOverseas}
            className="items-center justify-center active:opacity-60"
            style={{ height: MAP_BUTTON_SIZE }}
          >
            <Icon icon={Globe} size={21} tone="tint" strokeWidth={2} />
          </Pressable>
          <View className="mx-2 bg-border" style={{ height: HAIRLINE }} />
        </>
      ) : null}
      <Pressable
        role="button"
        accessibilityLabel="回到中国西南"
        onPress={onHome}
        className="items-center justify-center active:opacity-60"
        style={{ height: MAP_BUTTON_SIZE }}
      >
        <Icon icon={LocateFixed} size={21} tone="label" strokeWidth={2} />
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
