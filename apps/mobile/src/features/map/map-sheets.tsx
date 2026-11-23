import { router } from "expo-router";
import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Heart, History, House, Landmark, type LucideIcon, Navigation, PawPrint, Trees, Video, X } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PandaTile } from "@/components/panda-tile";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useFollowVenue } from "@/features/engagement/followed-venues";
import type { Point } from "@/features/map/camera";
import { MapStat } from "@/features/map/map-controls";
import type { MapFilter, VenueLiveMeta } from "@/features/map/map-filter";
import type { MapItem, MapView } from "@/features/map/model";
import { MapRows, PlaceRows, openVenue } from "@/features/map/place-list";
import { WILD_AREAS, WILD_SOURCE, type WildArea } from "@/features/map/wild";
import { useIOSColors } from "@/lib/theme";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

const TILE = 96;
const HERO_THUMB = 48;

export function pointsOf(items: readonly MapItem[]): Point[] {
  return items.flatMap((item) => (item.point ? [item.point] : []));
}

function routeUrl(item: MapItem): string | null {
  if (!item.coordinates) return null;
  const { longitude, latitude } = item.coordinates;
  const name = encodeURIComponent(item.name);
  if (Platform.OS === "ios") return `maps://?ll=${latitude},${longitude}&q=${name}`;
  if (Platform.OS === "android") return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${name})`;
  return `https://uri.amap.com/marker?position=${longitude},${latitude}&name=${name}`;
}

export function CloseButton({ onPress, label = "关闭" }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="items-center justify-center rounded-full bg-secondary active:bg-accent"
      style={{ width: 30, height: 30 }}
    >
      <Icon icon={X} size={16} tone="secondary" strokeWidth={2.5} />
    </Pressable>
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
      className={cn("min-h-12 flex-1 items-center justify-center gap-1 rounded-control py-2 active:bg-accent", filled ? "bg-highlight-soft" : "bg-card")}
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={icon} size="subhead" tone="tint" strokeWidth={filled ? 2.5 : 2} />
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

function VenueFocusCard({
  item,
  liveMeta,
  explicitlySelected,
  onClose,
}: {
  item: MapItem;
  liveMeta: VenueLiveMeta | null;
  explicitlySelected: boolean;
  onClose?: () => void;
}) {
  const colors = useIOSColors();
  const [wildInk, warningInk] = useCSSVariable(["--color-map-wild-ink", "--color-warning"]).map(String) as [string, string];
  const stacked = useStacked();
  const lead = item.residents[0];
  const route = routeUrl(item);

  const statusColor =
    liveMeta?.status === "active"
      ? wildInk || colors.tint
      : liveMeta?.status === "upcoming" || liveMeta?.status === "nap"
        ? warningInk || colors.secondaryLabel
        : colors.secondaryLabel;

  const statusText = [
    liveMeta?.localTime ? `当地 ${liveMeta.localTime}` : item.where,
    liveMeta?.statusLabel,
    item.residentCount > 0 ? `现居 ${item.residentCount} 只` : "现在没有熊猫",
  ]
    .filter(Boolean)
    .join("　");

  const primaryLeft = liveMeta?.liveCamUrl ? (
    <Button
      variant="tinted"
      size="sm"
      className={stacked ? "w-full" : "flex-1"}
      accessibilityLabel={`看${item.name}官方直播`}
      onPress={() => void Linking.openURL(liveMeta.liveCamUrl!)}
    >
      <Icon icon={Video} size="subhead" tone="tint" strokeWidth={2} />
      <Text>看直播</Text>
    </Button>
  ) : route ? (
    <Button
      variant="tinted"
      size="sm"
      className={stacked ? "w-full" : "flex-1"}
      accessibilityLabel={`在地图应用里打开去${item.name}的路线`}
      onPress={() => void Linking.openURL(route)}
    >
      <Icon icon={Navigation} size="subhead" tone="tint" strokeWidth={2} />
      <Text>路线</Text>
    </Button>
  ) : null;

  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-center gap-row">
        {lead ? (
          <PandaThumb pandaId={lead.id} name={lead.name} size={HERO_THUMB} />
        ) : (
          <View className="items-center justify-center" style={{ width: HERO_THUMB, height: HERO_THUMB }}>
            <Icon icon={House} size="title3" tone="tint" strokeWidth={2} />
          </View>
        )}
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="title" role="heading" numberOfLines={2}>
            {item.name}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {liveMeta?.localTime ? (
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
            ) : null}
            <Text variant="subheadline" className="min-w-0 flex-1 text-muted-foreground tabular-nums" numberOfLines={1}>
              {statusText}
            </Text>
          </View>
        </View>
        {explicitlySelected && onClose ? <CloseButton onPress={onClose} /> : null}
      </View>

      <View className={stacked ? "gap-2" : "flex-row gap-2.5"}>
        {primaryLeft}
        <Button
          size="sm"
          className={stacked ? "w-full" : "flex-1"}
          accessibilityLabel={`打开${item.name}的页面`}
          onPress={() => openVenue(item)}
        >
          <Text>{item.kind === "institution" ? "进入场馆与攻略" : "进入地点页"}</Text>
        </Button>
      </View>

      {explicitlySelected ? (
        <View className="gap-stack-tight pt-1">
          {item.kind === "institution" || (liveMeta?.liveCamUrl && route) ? (
            <View className="flex-row gap-2">
              {liveMeta?.liveCamUrl && route ? (
                <Action
                  icon={Navigation}
                  label="路线"
                  spoken={`在地图应用里打开去${item.name}的路线`}
                  onPress={() => void Linking.openURL(route)}
                />
              ) : null}
              {item.kind === "institution" ? <FollowAction item={item} /> : null}
            </View>
          ) : null}
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
      ) : null}
    </View>
  );
}

function BentoShortcuts({
  totalVenues,
  chinaCount,
  overseasCount,
  yearSpan,
  onOpenTimeline,
}: {
  totalVenues: number;
  chinaCount: number;
  overseasCount: number;
  yearSpan: string;
  onOpenTimeline: () => void;
}) {
  const stacked = useStacked();
  return (
    <View className={stacked ? "gap-2.5" : "flex-row gap-2.5"}>
      <Pressable
        role="link"
        accessibilityLabel={`${totalVenues} 家场馆名录，国内 ${chinaCount}，海外 ${overseasCount}`}
        onPress={() => router.push("/institutions")}
        className="flex-1 flex-row items-center gap-2.5 rounded-group bg-card px-3.5 py-3 active:opacity-75"
        style={{ borderCurve: "continuous" }}
      >
        <Icon icon={Landmark} size="body" tone="tint" strokeWidth={2} />
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline" numberOfLines={1}>{`${totalVenues} 家场馆名录`}</Text>
          <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
            {`国内 ${chinaCount}　海外 ${overseasCount}`}
          </Text>
        </View>
      </Pressable>
      <Pressable
        role="button"
        accessibilityLabel={`分布时间轴，${yearSpan}`}
        onPress={onOpenTimeline}
        className="flex-1 flex-row items-center gap-2.5 rounded-group bg-card px-3.5 py-3 active:opacity-75"
        style={{ borderCurve: "continuous" }}
      >
        <Icon icon={History} size="body" tone="tint" strokeWidth={2} />
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline" numberOfLines={1}>
            分布时间轴
          </Text>
          <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
            {yearSpan}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export function Overview({
  view,
  filter,
  filteredItems,
  featuredPlace,
  featuredLiveMeta,
  explicitPlace,
  yearSpan,
  wildShown,
  onClearPlace,
  onOpenTimeline,
  onChoose,
  onWild,
}: {
  view: MapView;
  filter: MapFilter;
  filteredItems: MapItem[];
  featuredPlace: MapItem | undefined;
  featuredLiveMeta: VenueLiveMeta | null;
  explicitPlace: MapItem | undefined;
  yearSpan: string;
  wildShown: boolean;
  onClearPlace: () => void;
  onOpenTimeline: () => void;
  onChoose: (item: MapItem) => void;
  onWild: (area: WildArea) => void;
}) {
  if (view.items.length === 0) return <ScreenState message="地点资料还在整理中。" />;
  const chinaCount = view.items.filter((item) => !item.overseas).length;
  const overseasCount = view.items.filter((item) => item.overseas).length;

  return (
    <View className="gap-stack">
      {filter !== "wild" && featuredPlace ? (
        <VenueFocusCard
          item={featuredPlace}
          liveMeta={featuredLiveMeta}
          explicitlySelected={Boolean(explicitPlace)}
          onClose={onClearPlace}
        />
      ) : null}

      {!explicitPlace && filter !== "wild" ? (
        <BentoShortcuts
          totalVenues={view.items.length}
          chinaCount={chinaCount}
          overseasCount={overseasCount}
          yearSpan={yearSpan}
          onOpenTimeline={onOpenTimeline}
        />
      ) : null}

      {filter === "wild" && wildShown ? (
        <Text variant="footnote" className="text-muted-foreground">
          野生栖息地是大熊猫国家公园里的局域种群，位置和大小是示意，不是真实边界。
        </Text>
      ) : null}

      <View testID="map-places" className="gap-stack-tight">
        <Text variant="footnote" role="heading" className="px-inset text-muted-foreground">
          {filter === "wild" ? `野生栖息地　${WILD_AREAS.length} 片` : "附近场馆与栖息地"}
        </Text>
        {filter === "wild" ? (
          <PlaceRows
            icon={Trees}
            rows={WILD_AREAS.map((area) => ({
              key: area.range.id,
              name: area.range.name,
              detail: `野生栖息地　${area.provinces.join("、")}`,
              count: area.count,
              lead: undefined,
              accessibilityLabel: `${area.range.name}，野生大熊猫 ${area.count} 只`,
              onPress: () => onWild(area),
            }))}
          />
        ) : filteredItems.length === 0 ? (
          <ScreenState message="这一筛选项里暂时没有场馆。" />
        ) : (
          <MapRows items={filteredItems} onOpen={onChoose} />
        )}
      </View>
    </View>
  );
}

export function PlaceSheet({
  item,
  liveMeta,
  onClose,
}: {
  item: MapItem;
  liveMeta: VenueLiveMeta | null;
  onClose: () => void;
}) {
  return <VenueFocusCard item={item} liveMeta={liveMeta} explicitlySelected onClose={onClose} />;
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
