import { router } from "expo-router";
import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Heart, House, Landmark, type LucideIcon, MapPinCheck, Navigation, PawPrint, Trees, Video, X } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PandaTile } from "@/components/panda-tile";
import { ProgressRing } from "@/components/progress-ring";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useFollowVenue } from "@/features/engagement/followed-venues";
import { shortDay } from "@/features/engagement/seen";
import type { Point } from "@/features/map/camera";
import { MapStat } from "@/features/map/map-controls";
import { type MapFilter, type VenueLiveMeta, lastVisitedOfItem } from "@/features/map/map-filter";
import { type MapItem, type MapView, mapItemLabel, pandaCountLabel } from "@/features/map/model";
import { PlaceRows, openVenue } from "@/features/map/place-list";
import { WILD_AREAS, WILD_SOURCE, type WildArea } from "@/features/map/wild";
import { HAIRLINE } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const TILE = 96;
const HERO_THUMB = 48;

export function pointsOf(items: readonly MapItem[]): Point[] {
  return items.flatMap((item) => (item.point ? [item.point] : []));
}

function leadResidentOf(item: MapItem) {
  return item.residents.find((resident) => resident.hasFullBleedCover) ?? item.residents[0];
}

function visitDayLabel(day: string, currentYear: number): string {
  const year = Number(day.slice(0, 4));
  const monthDay = shortDay(day);
  return year && year !== currentYear ? `${year}年${monthDay}` : monthDay;
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

function FootprintPassportCard({
  visitedVenueCount,
  totalVenueCount,
  visitedThisYearCount,
  seenCount,
}: {
  visitedVenueCount: number;
  totalVenueCount: number;
  visitedThisYearCount: number;
  seenCount: number | null;
}) {
  const stacked = useStacked();
  const ratio = totalVenueCount > 0 ? visitedVenueCount / totalVenueCount : 0;
  const pct =
    visitedVenueCount === 0 || totalVenueCount === 0
      ? 0
      : Math.min(100, Math.max(1, Math.round(ratio * 100)));

  const yearPart = visitedThisYearCount > 0 ? `今年新解锁 ${visitedThisYearCount} 处` : null;
  const seenPart = seenCount !== null ? `现场见过 ${seenCount} 只大熊猫` : null;
  const subtitle = [yearPart, seenPart].filter(Boolean).join("　") || "去过的每座基地都会在这里点亮";

  const diaryLink = (
    <Pressable
      role="link"
      accessibilityLabel="看猫日记"
      onPress={() => router.push("/visits")}
      hitSlop={8}
      className="min-h-11 shrink-0 flex-row items-center gap-0.5 active:opacity-60"
    >
      <Text variant="footnote" className="font-semibold text-primary">
        看猫日记
      </Text>
      <Chevron />
    </Pressable>
  );

  return (
    <View
      className={cn("rounded-group bg-card px-inset py-row", stacked ? "gap-stack-tight" : "flex-row items-center gap-row")}
      style={{ borderCurve: "continuous" }}
    >
      <ProgressRing
        value={ratio}
        label={`${pct}%`}
        accessibilityLabel={`已去过 ${visitedVenueCount} / ${totalVenueCount} 个场馆，进度 ${pct}%`}
      />
      <View className={stacked ? "gap-hair-gap" : "min-w-0 flex-1 gap-hair-gap"}>
        <View className={stacked ? "gap-hair-gap" : "flex-row items-center justify-between gap-2"}>
          <Text variant="headline" className={cn("tabular-nums", !stacked && "min-w-0 flex-1")} numberOfLines={stacked ? undefined : 1}>
            {`已去过 ${visitedVenueCount} / ${totalVenueCount} 个场馆`}
          </Text>
          {stacked ? null : diaryLink}
        </View>
        <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={stacked ? undefined : 2}>
          {subtitle}
        </Text>
        {stacked ? diaryLink : null}
      </View>
    </View>
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
  const lead = leadResidentOf(item);
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

function DirectoryShortcut({
  totalVenues,
  chinaCount,
  overseasCount,
}: {
  totalVenues: number;
  chinaCount: number;
  overseasCount: number;
}) {
  return (
    <Pressable
      role="link"
      accessibilityLabel={`${totalVenues} 家场馆名录，国内 ${chinaCount}，海外 ${overseasCount}`}
      onPress={() => router.push("/institutions")}
      className="min-h-11 flex-row items-center gap-2.5 rounded-group bg-card px-inset py-row active:opacity-75"
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={Landmark} size="body" tone="tint" strokeWidth={2} />
      <View className="min-w-0 flex-1 gap-hair-gap">
        <Text variant="headline" numberOfLines={1}>{`${totalVenues} 家场馆名录`}</Text>
        <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
          {`国内 ${chinaCount}　海外 ${overseasCount}`}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
}

function VisitedEmptyCard({ onResetFilter }: { onResetFilter?: () => void }) {
  return (
    <View
      className="items-center gap-stack-tight rounded-group bg-card px-inset py-stack"
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={MapPinCheck} size="title3" tone="tint" strokeWidth={2} />
      <Text variant="headline" className="text-center">
        还没有去过的场馆足迹
      </Text>
      <Text variant="footnote" className="text-center text-muted-foreground">
        打开任意基地或动物园页面，点击「去过打卡」即可点亮地图足迹。
      </Text>
      {onResetFilter ? (
        <Button variant="tinted" size="sm" onPress={onResetFilter}>
          <Text>看看全部场馆</Text>
        </Button>
      ) : null}
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
  wildShown,
  visitedVenueCount = 0,
  visitedThisYearCount = 0,
  seenCount = null,
  lastVisitedByInstitution,
  lastVisitedByPlace,
  thisYear = new Date().getFullYear(),
  onClearPlace,
  onResetFilter,
  onChoose,
  onWild,
}: {
  view: MapView;
  filter: MapFilter;
  filteredItems: MapItem[];
  featuredPlace: MapItem | undefined;
  featuredLiveMeta: VenueLiveMeta | null;
  explicitPlace: MapItem | undefined;
  wildShown: boolean;
  visitedVenueCount?: number;
  visitedThisYearCount?: number;
  seenCount?: number | null;
  lastVisitedByInstitution?: ReadonlyMap<string, string>;
  lastVisitedByPlace?: ReadonlyMap<string, string>;
  thisYear?: number;
  onClearPlace: () => void;
  onResetFilter?: () => void;
  onChoose: (item: MapItem) => void;
  onWild: (area: WildArea) => void;
}) {
  if (view.items.length === 0) return <ScreenState message="地点资料还在整理中。" />;
  const chinaCount = view.items.filter((item) => !item.overseas).length;
  const overseasCount = view.items.filter((item) => item.overseas).length;
  const showPassport = filter !== "wild" && (visitedVenueCount > 0 || filter === "visited");

  const sortedItems =
    filter === "visited"
      ? [...filteredItems].sort((left, right) => {
          const leftDay = lastVisitedOfItem(left, lastVisitedByInstitution, lastVisitedByPlace) ?? "";
          const rightDay = lastVisitedOfItem(right, lastVisitedByInstitution, lastVisitedByPlace) ?? "";
          return (
            rightDay.localeCompare(leftDay) ||
            right.residentCount - left.residentCount ||
            left.name.localeCompare(right.name, "zh-CN")
          );
        })
      : filteredItems;

  return (
    <View className="gap-stack">
      {showPassport ? (
        <FootprintPassportCard
          visitedVenueCount={visitedVenueCount}
          totalVenueCount={view.items.length}
          visitedThisYearCount={visitedThisYearCount}
          seenCount={seenCount}
        />
      ) : null}

      {filter !== "wild" && filter !== "visited" && featuredPlace ? (
        <VenueFocusCard
          item={featuredPlace}
          liveMeta={featuredLiveMeta}
          explicitlySelected={Boolean(explicitPlace)}
          onClose={onClearPlace}
        />
      ) : null}

      {!explicitPlace && filter !== "wild" && filter !== "visited" ? (
        <DirectoryShortcut totalVenues={view.items.length} chinaCount={chinaCount} overseasCount={overseasCount} />
      ) : null}

      {filter === "wild" && wildShown ? (
        <Text variant="footnote" className="text-muted-foreground">
          野生栖息地是大熊猫国家公园里的局域种群，位置和大小是示意，不是真实边界。
        </Text>
      ) : null}

      <View testID="map-places" className="gap-stack-tight">
        <Text variant="footnote" role="heading" className="px-inset text-muted-foreground tabular-nums">
          {filter === "wild"
            ? `野生栖息地　${WILD_AREAS.length} 片`
            : filter === "visited"
              ? `已打卡足迹　${sortedItems.length} 处`
              : "附近场馆与栖息地"}
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
        ) : sortedItems.length === 0 ? (
          filter === "visited" ? (
            <VisitedEmptyCard onResetFilter={onResetFilter} />
          ) : (
            <ScreenState message="这一筛选项里暂时没有场馆。" />
          )
        ) : (
          <PlaceRows
            rows={sortedItems.map((item) => {
              const lastDay = lastVisitedOfItem(item, lastVisitedByInstitution, lastVisitedByPlace);
              const visitedLabel = lastDay ? `${visitDayLabel(lastDay, thisYear)}去过` : null;
              const detail = [visitedLabel, item.overseas ? item.where : null, item.residentNames ?? pandaCountLabel(item.residentCount)]
                .filter(Boolean)
                .join("　");
              const spoken = visitedLabel ? `${mapItemLabel(item)}，${visitedLabel}` : mapItemLabel(item);
              const lead = leadResidentOf(item);
              return {
                key: item.id,
                name: item.name,
                detail,
                count: item.residentCount,
                lead: lead ? { id: lead.id, name: lead.name } : undefined,
                accessibilityLabel: spoken,
                onPress: () => onChoose(item),
              };
            })}
          />
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
