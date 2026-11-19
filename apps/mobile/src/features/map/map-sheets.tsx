import { router } from "expo-router";
import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { Heart, House, type LucideIcon, Navigation, PawPrint, Trees, X } from "@/components/icons";
import { PandaTile } from "@/components/panda-tile";
import { ScreenState } from "@/components/screen-state";
import { Text } from "@/components/ui/text";
import { useFollowVenue } from "@/features/engagement/followed-venues";
import type { Point } from "@/features/map/camera";
import { MapStat } from "@/features/map/map-controls";
import { type MapItem, type MapView, pandaCountLabel } from "@/features/map/model";
import { MapRows, openVenue } from "@/features/map/place-list";
import { WILD_AREAS, WILD_SOURCE, type WildArea } from "@/features/map/wild";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

const TILE = 96;

export function pointsOf(items: readonly MapItem[]): Point[] {
  return items.flatMap((item) => (item.point ? [item.point] : []));
}

function pandasIn(view: MapView): number {
  return view.items.reduce((sum, item) => sum + item.residentCount, 0);
}

function routeUrl(item: MapItem): string | null {
  if (!item.coordinates) return null;
  const { longitude, latitude } = item.coordinates;
  const name = encodeURIComponent(item.name);
  if (Platform.OS === "ios") return `maps://?ll=${latitude},${longitude}&q=${name}`;
  if (Platform.OS === "android") return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${name})`;
  return `https://uri.amap.com/marker?position=${longitude},${latitude}&name=${name}`;
}

export function Overview({
  view,
  timelineBlock,
  wildShown,
  onChoose,
}: {
  view: MapView;
  timelineBlock: React.ReactNode;
  wildShown: boolean;
  onChoose: (item: MapItem) => void;
}) {
  if (view.items.length === 0) return <ScreenState message="地点资料还在整理中。" />;
  return (
    <View className="gap-section-tight">
      <View className="gap-hair-gap">
        <Text variant="title" role="heading">
          熊猫地图
        </Text>
        <Text variant="subheadline" className="text-muted-foreground">
          中国西南　拖动时间轴看过去
        </Text>
      </View>
      {timelineBlock}
      <View className="flex-row gap-stack-tight">
        <MapStat icon={House} label="场馆" value={`${view.items.length}`} />
        <MapStat icon={PawPrint} label="住在场馆" value={`${pandasIn(view)}`} />
        <MapStat icon={Trees} label="野生栖息地" value={`${WILD_AREAS.length}`} tone="wild" />
      </View>
      {wildShown ? (
        <Text variant="footnote" className="text-muted-foreground">
          野生栖息地是大熊猫国家公园里的局域种群，位置和大小是示意，不是真实边界。
        </Text>
      ) : null}
      <View testID="map-places" className="gap-section-tight">
        {view.groups.map((group) => (
          <View key={group.id} className="gap-1.5">
            <Text variant="footnote" role="heading" className="px-inset text-muted-foreground tabular-nums">
              {`${group.title}　${group.items.length} 个地方`}
            </Text>
            <MapRows items={group.items} onOpen={onChoose} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  spoken,
  filled = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  spoken: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      className={cn("min-h-14 flex-1 items-center justify-center gap-1 rounded-control py-2 active:bg-accent", filled ? "bg-highlight-soft" : "bg-card")}
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={icon} size="body" tone="tint" strokeWidth={filled ? 2.5 : 2} />
      <Text variant="footnote" className="font-semibold text-primary">
        {label}
      </Text>
    </Pressable>
  );
}

function FollowAction({ item }: { item: MapItem }) {
  const { following, toggle } = useFollowVenue(item.slug);
  return (
    <Action
      icon={Heart}
      label={following ? "已关注" : "关注"}
      spoken={following ? `已关注${item.name}，点按取消` : `关注${item.name}`}
      filled={following}
      onPress={toggle}
    />
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      role="button"
      accessibilityLabel="关闭"
      onPress={onPress}
      hitSlop={8}
      className="items-center justify-center rounded-full bg-secondary active:bg-accent"
      style={{ width: 30, height: 30 }}
    >
      <Icon icon={X} size={16} tone="secondary" strokeWidth={2.5} />
    </Pressable>
  );
}

export function PlaceSheet({ item, onClose }: { item: MapItem; onClose: () => void }) {
  const route = routeUrl(item);
  const page = item.kind === "institution" ? "场馆页" : "地点页";
  return (
    <View className="gap-stack">
      <View className="flex-row items-start gap-row">
        <View className="pt-1">
          <Icon icon={House} size="title3" tone="tint" strokeWidth={2} />
        </View>
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="title" role="heading">
            {item.name}
          </Text>
          <Text variant="subheadline" className="text-muted-foreground tabular-nums">
            {[item.where, pandaCountLabel(item.residentCount)].filter(Boolean).join("　")}
          </Text>
        </View>
        <CloseButton onPress={onClose} />
      </View>
      <View className="flex-row gap-stack-tight">
        {route ? (
          <Action icon={Navigation} label="路线" spoken={`在地图应用里打开去${item.name}的路线`} onPress={() => void Linking.openURL(route)} />
        ) : null}
        {item.kind === "institution" ? <FollowAction item={item} /> : null}
        <Action icon={House} label={page} spoken={`打开${item.name}的页面`} onPress={() => openVenue(item)} />
      </View>
      {item.residents.length > 0 ? (
        <View className="gap-stack-tight">
          <View className="flex-row items-center gap-1.5">
            <Icon icon={PawPrint} size="subhead" tone="label" strokeWidth={2} />
            <Text variant="headline" role="heading" className="flex-1">
              住在这里
            </Text>
            <Text variant="subheadline" className="text-muted-foreground tabular-nums">{`${item.residentCount} 只`}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-stack-tight px-gutter">
            {item.residents.map((panda) => (
              <PandaTile
                key={panda.id}
                pandaId={panda.id}
                name={panda.name}
                width={TILE}
                accessibilityLabel={panda.name}
                onPress={() => router.push({ pathname: "/pandas/[slug]", params: { slug: panda.slug } })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export function WildSheet({ area, nearVenues, onClose }: { area: WildArea; nearVenues: number; onClose: () => void }) {
  const [wildInk] = useCSSVariable(["--color-map-wild-ink"]).map(String) as [string];
  return (
    <View className="gap-stack">
      <View className="flex-row items-start gap-row">
        <View className="pt-1">
          <Icon icon={Trees} size="title3" color={wildInk} strokeWidth={2} />
        </View>
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="title" role="heading">
            {area.range.name}
          </Text>
          <Text variant="subheadline" className="text-muted-foreground">
            {`野生栖息地　${area.provinces.join("、")}`}
          </Text>
        </View>
        <CloseButton onPress={onClose} />
      </View>
      <View className="flex-row gap-stack-tight">
        <Action
          icon={Trees}
          label="栖息地页"
          spoken={`打开${area.range.name}的页面`}
          onPress={() => router.push({ pathname: "/wild/[id]", params: { id: area.range.id } })}
        />
      </View>
      <View className="flex-row gap-stack-tight">
        <MapStat icon={PawPrint} label="野生大熊猫" value={`${area.count}`} tone="wild" />
        <MapStat icon={Trees} label="栖息地 km²" value={Math.round(area.habitatKm2).toLocaleString("en-US")} tone="wild" />
        <MapStat icon={House} label="附近场馆" value={`${nearVenues}`} />
      </View>
      <View className="gap-1.5">
        <Text variant="footnote" role="heading" className="px-inset text-muted-foreground">
          {`局域种群　${area.range.populations.length} 个`}
        </Text>
        <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
          {area.range.populations.map((population, index) => (
            <View key={population.name}>
              <View className="flex-row items-center gap-row px-inset py-row" accessible accessibilityLabel={`${population.name}，${population.count} 只，${population.counties.join("、")}`}>
                <View className="min-w-0 flex-1 gap-hair-gap">
                  <Text variant="headline">{population.name}</Text>
                  <Text variant="subheadline" className="text-muted-foreground">
                    {population.counties.join("、")}
                  </Text>
                </View>
                <Text variant="subheadline" className="text-muted-foreground tabular-nums">{`${population.count} 只`}</Text>
              </View>
              {index === area.range.populations.length - 1 ? null : <View className="ml-inset bg-border" style={{ height: HAIRLINE }} />}
            </View>
          ))}
        </View>
      </View>
      <Pressable role="link" accessibilityLabel="打开数据来源" onPress={() => void Linking.openURL(WILD_SOURCE.url)} className="active:opacity-60">
        <Text variant="footnote" className="text-muted-foreground">
          {`数量和栖息地面积出自${WILD_SOURCE.title}，${WILD_SOURCE.note}`}
          <Text variant="footnote" className="text-primary">
            查看来源
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}
