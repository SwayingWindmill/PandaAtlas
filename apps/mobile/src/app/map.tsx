import { useQuery } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, PanResponder, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import {
  Baby,
  ChevronLeft,
  Globe,
  Heart,
  History,
  House,
  LocateFixed,
  type LucideIcon,
  Navigation,
  Pause,
  PawPrint,
  Plane,
  Play,
  Sparkles,
  Tag,
  Trees,
  Truck,
  X,
} from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { PandaTile } from "@/components/panda-tile";
import { ScreenState } from "@/components/screen-state";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { setFollowingVenue, useFollowedVenues } from "@/features/engagement/followed-venues";
import { type Camera, type Point, type Viewport, fitPoints } from "@/features/map/camera";
import { mapTimelineQueryOptions, mapViewQueryOptions } from "@/features/map/load";
import { type MapItem, type MapView, pandaCountLabel } from "@/features/map/model";
import { MapRows } from "@/features/map/place-list";
import { type MapTimeline, type YearEvent, type YearEventKind, buildTimeline, eventsInYear, residentsInYear } from "@/features/map/timeline";
import { useMapCamera } from "@/features/map/use-map-camera";
import { type MapMarker, VenueMap, type YearView } from "@/features/map/venue-map";
import { WILD_AREAS, WILD_SOURCE, type WildArea } from "@/features/map/wild";
import { useSession } from "@/features/session/session";
import { tapHaptic } from "@/lib/haptics";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

const BUTTON = 44;
const TILE = 96;
/** The sheet at its tallest covers this share of the screen; dragged down it keeps only its header. */
const SHEET_SHARE = 0.5;
const SHEET_PEEK = 176;
const FLOAT_SHADOW = "0 1px 2px rgba(0,0,0,0.1), 0 4px 14px rgba(0,0,0,0.1)";
const PLAY_STEP_MS = 700;
/** A venue within this many outline units of a wild area's centre (about 200 km) counts as near it. */
const NEAR_WILD = 6;

type Selection = { kind: "place"; id: string } | { kind: "wild"; id: string } | null;

function openPage(item: MapItem) {
  if (item.kind === "institution") router.push({ pathname: "/institutions/[slug]", params: { slug: item.slug } });
  else router.push({ pathname: "/places/[slug]", params: { slug: item.slug } });
}

function pointsOf(items: readonly MapItem[]): Point[] {
  return items.flatMap((item) => (item.point ? [item.point] : []));
}

function pandasIn(view: MapView): number {
  return view.items.reduce((sum, item) => sum + item.residentCount, 0);
}

/** A round button floating over the map, on the card surface so it reads on land and sea. */
function FloatingButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="items-center justify-center rounded-full bg-paper active:opacity-70"
      style={{ width: BUTTON, height: BUTTON, boxShadow: FLOAT_SHADOW }}
    >
      {children}
    </Pressable>
  );
}

/** The two layers, as the mockup's capsule: each one a pill that is filled while its layer shows. */
function LayerToggle({
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
    <View className="flex-row gap-1 rounded-full bg-paper p-1" style={{ boxShadow: FLOAT_SHADOW }}>
      {pill(venues, House, "场馆", onVenues)}
      {pill(wild, Trees, "野生区", onWild)}
    </View>
  );
}

/** Apple Maps' control column: the map's two view buttons in one capsule, split by a hairline. */
function ViewControls({ overseas, onOverseas, onHome }: { overseas: number; onOverseas: () => void; onHome: () => void }) {
  return (
    <View className="overflow-hidden rounded-control bg-paper" style={{ width: BUTTON, boxShadow: FLOAT_SHADOW }}>
      {overseas > 0 ? (
        <>
          <Pressable
            role="button"
            accessibilityLabel={`看海外的 ${overseas} 个地方`}
            onPress={onOverseas}
            className="items-center justify-center active:opacity-60"
            style={{ height: BUTTON }}
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
        style={{ height: BUTTON }}
      >
        <Icon icon={LocateFixed} size={21} tone="label" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** A number tile as the mockup draws it: a bare tint glyph, the number, and what it counts. */
function MapStat({ icon, value, label, tone = "tint" }: { icon: LucideIcon; value: string; label: string; tone?: "tint" | "wild" }) {
  const [wildInk] = useCSSVariable(["--color-map-wild-ink"]).map(String) as [string];
  return (
    <View
      className="min-w-0 flex-1 gap-1 rounded-group bg-card p-row"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`${label} ${value}`}
    >
      {tone === "wild" ? <Icon icon={icon} size="subhead" color={wildInk} strokeWidth={2} /> : <Icon icon={icon} size="subhead" tone="tint" strokeWidth={2} />}
      <Text variant="stat" role="none" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="footnote" role="none" className="text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** The phone's map app, with a pin on the place: 高德 on the web, where no app can be opened. */
function routeUrl(item: MapItem): string | null {
  if (!item.coordinates) return null;
  const { longitude, latitude } = item.coordinates;
  const name = encodeURIComponent(item.name);
  if (Platform.OS === "ios") return `maps://?ll=${latitude},${longitude}&q=${name}`;
  if (Platform.OS === "android") return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${name})`;
  return `https://uri.amap.com/marker?position=${longitude},${latitude}&name=${name}`;
}

const HIST_HEIGHT = 40;

/**
 * kepler.gl's time filter: records per year as bars, tinted up to the chosen year and grey after it, and a
 * year with no record hatched as Our World in Data marks No data. A finger on it picks the year; the last
 * bar is 现在.
 */
function YearScrubber({
  timeline,
  index,
  onIndex,
}: {
  timeline: MapTimeline;
  index: number;
  onIndex: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [tint, rest, hatch] = useCSSVariable(["--color-graphic", "--color-accent", "--color-tertiary-foreground"]).map(String) as [
    string,
    string,
    string,
  ];
  const widthRef = useRef(0);
  const count = timeline.years.length;
  const pick = (x: number) => {
    const w = widthRef.current;
    if (!w) return;
    onIndex(Math.max(0, Math.min(count - 1, Math.floor((x / w) * count))));
  };
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });
  // The handlers read pickRef when a finger moves, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => pickRef.current(event.nativeEvent.locationX),
      onPanResponderMove: (event) => pickRef.current(event.nativeEvent.locationX),
    }),
  );
  const max = Math.max(1, ...timeline.counts);
  const bar = width / count;
  const first = timeline.years[0] ?? 0;
  // The first year and each round 20 years, none closer than 44pt to the one before or to 现在.
  const ticks = timeline.years.reduce<number[]>((kept, year, at) => {
    const x = at * bar;
    const previous = kept.length ? (kept[kept.length - 1]! - (timeline.years[0] ?? 0)) * bar : -Infinity;
    if ((at === 0 || year % 20 === 0) && x - previous >= 44 && x < width - 56) kept.push(year);
    return kept;
  }, []);
  return (
    <View className="gap-1">
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="年份"
        accessibilityValue={{ text: index === count - 1 ? "现在" : `${timeline.years[index]} 年` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) =>
          onIndex(Math.max(0, Math.min(count - 1, index + (event.nativeEvent.actionName === "increment" ? 1 : -1))))
        }
        style={{ height: HIST_HEIGHT + 14 }}
        onLayout={(event) => {
          widthRef.current = event.nativeEvent.layout.width;
          setWidth(event.nativeEvent.layout.width);
        }}
        {...responder.panHandlers}
      >
        {width > 0 ? (
          <Svg width={width} height={HIST_HEIGHT + 14} pointerEvents="none">
            <Defs>
              <Pattern id="nodata" patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
                <Line x1={0} y1={0} x2={0} y2={4} stroke={hatch} strokeWidth={1.5} />
              </Pattern>
            </Defs>
            {timeline.counts.map((value, at) => {
              const h = value === 0 ? 8 : Math.max(3, (value / max) * HIST_HEIGHT);
              return (
                <Rect
                  key={at}
                  x={at * bar + bar * 0.12}
                  y={HIST_HEIGHT - h}
                  width={Math.max(1, bar * 0.76)}
                  height={h}
                  rx={Math.min(1.5, bar / 4)}
                  fill={value === 0 ? "url(#nodata)" : at <= index ? tint : rest}
                />
              );
            })}
            <Rect x={0} y={HIST_HEIGHT + 4} width={(index + 1) * bar} height={3} rx={1.5} fill={tint} />
            <Rect x={(index + 1) * bar} y={HIST_HEIGHT + 4} width={width - (index + 1) * bar} height={3} rx={1.5} fill={rest} />
          </Svg>
        ) : null}
        {width > 0 ? (
          <View
            pointerEvents="none"
            className="absolute rounded-full bg-paper"
            style={{ width: 22, height: 22, top: HIST_HEIGHT - 5.5, left: (index + 0.5) * bar - 11, boxShadow: FLOAT_SHADOW }}
          />
        ) : null}
      </View>
      <View className="h-4">
        {width > 0
          ? ticks.map((year) => (
              <Text
                key={year}
                variant="footnote"
                allowFontScaling={false}
                className="absolute text-muted-foreground tabular-nums"
                style={{ left: (year - first) * bar }}
              >
                {String(year)}
              </Text>
            ))
          : null}
        <Text variant="footnote" allowFontScaling={false} className="absolute right-0 text-muted-foreground">
          现在
        </Text>
      </View>
      {timeline.counts.includes(0) ? (
        <View className="flex-row items-center gap-1.5 pt-1">
          <Svg width={12} height={8}>
            <Defs>
              <Pattern id="legend" patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
                <Line x1={0} y1={0} x2={0} y2={4} stroke={hatch} strokeWidth={1.5} />
              </Pattern>
            </Defs>
            <Rect width={12} height={8} rx={1.5} fill="url(#legend)" />
          </Svg>
          <Text variant="footnote" className="text-muted-foreground">
            这一年没有记录
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The timeline's header: play or pause, the year (or 现在) and what it holds, and the way back to 现在. */
function TimelineBlock({
  timeline,
  index,
  onIndex,
  playing,
  onPlay,
  subtitle,
}: {
  timeline: MapTimeline;
  index: number;
  onIndex: (index: number) => void;
  playing: boolean;
  onPlay: () => void;
  subtitle: string;
}) {
  const now = index === timeline.years.length - 1;
  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-center gap-row">
        <Pressable
          role="button"
          accessibilityLabel={playing ? "暂停" : "从头一年一年播放"}
          onPress={onPlay}
          className="items-center justify-center rounded-full bg-primary active:opacity-70"
          style={{ width: 40, height: 40 }}
        >
          <Icon icon={playing ? Pause : Play} size={18} tone="onButton" strokeWidth={2.25} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text variant="title" className="tabular-nums">
            {now ? "现在" : `${timeline.years[index]} 年`}
          </Text>
          <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {now ? null : (
          <Pressable
            role="button"
            accessibilityLabel="回到现在"
            onPress={() => onIndex(timeline.years.length - 1)}
            hitSlop={8}
            className="flex-row items-center gap-1 active:opacity-60"
          >
            <Icon icon={History} size="footnote" tone="tint" strokeWidth={2} />
            <Text variant="footnote" className="font-semibold text-primary">
              现在
            </Text>
          </Pressable>
        )}
      </View>
      <YearScrubber timeline={timeline} index={index} onIndex={onIndex} />
    </View>
  );
}

const KIND: Record<YearEventKind, { icon?: LucideIcon; meta: string }> = {
  birth: { icon: Baby, meta: "出生" },
  abroad: { icon: Plane, meta: "出国" },
  home: { icon: Plane, meta: "回国" },
  move: { icon: Truck, meta: "搬家" },
  debut: { icon: Sparkles, meta: "公开亮相" },
  naming: { icon: Tag, meta: "取名" },
  death: { meta: "离世" },
  other: { meta: "" },
};

/** The year's events in the app's Timeline: the date over who it was and what happened. A death is a quiet grey row. */
function YearEvents({ events }: { events: YearEvent[] }) {
  if (events.length === 0) {
    return (
      <Text variant="subheadline" className="text-muted-foreground">
        这一年没有出生、搬家或亮相的记录。
      </Text>
    );
  }
  const items: TimelineItem[] = events.map((event) => ({
    key: event.id,
    date: event.when,
    meta: KIND[event.kind].meta,
    title: event.kind === "death" ? `${event.who}　${event.what}` : event.who,
    detail: event.kind === "death" ? undefined : event.what,
    icon: KIND[event.kind].icon,
    quiet: event.kind === "death",
  }));
  return <Timeline items={items} newestFirst={false} />;
}

/** The sheet with nothing chosen: the timeline, what the map holds as tiles, then every place as a list. */
function Overview({
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

/** A past year: the timeline on top, then 这一年 as the app's Timeline. */
function YearSheet({ timelineBlock, events }: { timelineBlock: React.ReactNode; events: YearEvent[] }) {
  return (
    <View className="gap-section-tight">
      {timelineBlock}
      <View className="gap-stack-tight">
        <Text variant="headline" role="heading">
          这一年
        </Text>
        <YearEvents events={events} />
      </View>
    </View>
  );
}

/** One of the place sheet's actions: a bare tint glyph over its label, on the card surface. */
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
  /** A state that is on (已关注): the tile takes the selected ground, as a selected chip does. */
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

/** 关注 for a venue: signed out it goes to sign-in; signed in it toggles, on the selected ground while followed. */
function FollowAction({ item }: { item: MapItem }) {
  const { state } = useSession();
  const followed = useFollowedVenues();
  const following = followed?.has(item.slug) ?? false;
  return (
    <Action
      icon={Heart}
      label={following ? "已关注" : "关注"}
      spoken={following ? `已关注${item.name}，点按取消` : `关注${item.name}`}
      filled={following}
      onPress={() => {
        tapHaptic();
        if (state.status !== "signedIn") router.push("/sign-in");
        else void setFollowingVenue(state.accountId, item.slug, !following);
      }}
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

/** The sheet for one place: its name, a route, 关注 and its page, then who lives there. */
function PlaceSheet({ item, onClose }: { item: MapItem; onClose: () => void }) {
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
        <Action icon={House} label={page} spoken={`打开${item.name}的页面`} onPress={() => openPage(item)} />
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

/** A wild area: how many wild pandas live there, in which local populations and counties, and the source. */
function WildSheet({ area, nearVenues, onClose }: { area: WildArea; nearVenues: number; onClose: () => void }) {
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
          {`数量和栖息地面积出自${WILD_SOURCE.title}，只算大熊猫国家公园里的部分。地图上的范围是示意，不是真实边界。`}
          <Text variant="footnote" className="text-primary">
            查看来源
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { data: view, isError: failed, refetch } = useQuery(mapViewQueryOptions());
  const { data: history } = useQuery(mapTimelineQueryOptions());
  const [selection, setSelection] = useState<Selection>(null);
  const [layers, setLayers] = useState({ venues: true, wild: true });
  const top = insets.top + 8 + BUTTON + 8;
  // The camera frames the strip above the sheet at its tallest, so the map does not jump as the sheet moves.
  const sheetMax = Math.round(window.height * SHEET_SHARE);
  const viewport = useMemo<Viewport | null>(
    () => (window.width && window.height ? { width: window.width, height: window.height, top, bottom: sheetMax } : null),
    [window.width, window.height, top, sheetMax],
  );
  const { camera, setCamera, flyTo, handlers } = useMapCamera(viewport);

  const thisYear = new Date().getFullYear();
  const timeline = useMemo(
    () => (history ? buildTimeline(history.residencies, history.events, thisYear) : null),
    [history, thisYear],
  );
  const [yearIndex, setYearIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const lastIndex = timeline ? timeline.years.length - 1 : 0;
  const index = yearIndex ?? lastIndex;
  const year = timeline && yearIndex !== null && yearIndex < lastIndex ? timeline.years[yearIndex] : undefined;

  useEffect(() => {
    if (!playing || !timeline) return;
    const id = setInterval(() => {
      setYearIndex((current) => {
        const next = (current ?? 0) + 1;
        if (next >= lastIndex) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, PLAY_STEP_MS);
    return () => clearInterval(id);
  }, [playing, timeline, lastIndex]);

  const yearEvents = useMemo(
    () => (view && history && year !== undefined ? eventsInYear(view.items, history.events, history.pandas, year) : []),
    [view, history, year],
  );
  const yearView = useMemo<YearView | undefined>(() => {
    if (!view || !history || year === undefined) return undefined;
    const byId = new Map(view.items.map((item) => [item.id, item]));
    return {
      year,
      counts: residentsInYear(view.items, history.residencies, year),
      flows: yearEvents.flatMap((event) => {
        const from = event.from ? byId.get(event.from)?.point : undefined;
        const to = event.to ? byId.get(event.to)?.point : undefined;
        return from && to && event.from !== event.to ? [{ from, to }] : [];
      }),
    };
  }, [view, history, year, yearEvents]);

  const china = useMemo(() => pointsOf(view?.items.filter((item) => !item.overseas) ?? []), [view]);
  const everywhere = useMemo(() => pointsOf(view?.items ?? []), [view]);
  const overseas = view?.items.filter((item) => item.overseas && item.point).length ?? 0;
  const wildPoints = useMemo(() => WILD_AREAS.flatMap((area) => area.patches.map((patch) => ({ x: patch.x, y: patch.y }))), []);
  // 中国西南: the Sichuan bases and the wild ranges, close enough that the bases open as separate places.
  const home = (port: Viewport): Camera => fitPoints([...china, ...(layers.wild ? wildPoints : [])], port, 40, 8);

  // The map opens on 中国西南, where most pandas live, once it knows the screen.
  const opened = useRef(false);
  useEffect(() => {
    if (!viewport || !view || opened.current) return;
    opened.current = true;
    setCamera(home(viewport));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first layout with data
  }, [viewport, view]);

  // The sheet drags between its full height and a peek that keeps only its header.
  const [sheetUp, setSheetUp] = useState(true);
  const [sheetResponder] = useState(() =>
    PanResponder.create({
      // Capture, so a vertical drag is taken from the grabber's Pressable, which keeps the tap.
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 40) setSheetUp(false);
        else if (gesture.dy < -40) setSheetUp(true);
      },
    }),
  );

  const place = selection?.kind === "place" ? view?.items.find((item) => item.id === selection.id) : undefined;
  const wildArea = selection?.kind === "wild" ? WILD_AREAS.find((area) => area.range.id === selection.id) : undefined;

  function choose(item: MapItem) {
    if (!item.point || !viewport || !camera) {
      openPage(item);
      return;
    }
    setSelection({ kind: "place", id: item.id });
    setSheetUp(true);
    flyTo({ x: item.point.x, y: item.point.y, scale: Math.max(camera.scale, home(viewport).scale) });
  }

  function onMarker(marker: MapMarker) {
    const [only] = marker.items;
    if (marker.items.length === 1 && only) choose(only);
    else if (viewport) flyTo(fitPoints(pointsOf(marker.items), viewport, 64, 4));
  }

  function onWild(area: WildArea) {
    setSelection({ kind: "wild", id: area.range.id });
    setSheetUp(true);
    if (viewport) flyTo(fitPoints(area.patches, viewport, 72, 6));
  }

  function play() {
    if (playing) {
      setPlaying(false);
      return;
    }
    setSelection(null);
    if (yearIndex === null || yearIndex >= lastIndex) setYearIndex(0);
    setPlaying(true);
  }

  const timelineBlock = timeline ? (
    <TimelineBlock
      timeline={timeline}
      index={index}
      onIndex={(next) => {
        setPlaying(false);
        setSelection(null);
        setYearIndex(next >= lastIndex ? null : next);
      }}
      playing={playing}
      onPlay={play}
      subtitle={
        year === undefined
          ? `${view?.items.filter((item) => item.residentCount > 0).length ?? 0} 个场馆有熊猫`
          : `这一年 ${yearEvents.length} 件事　拖动或播放`
      }
    />
  ) : null;

  const nearVenues = wildArea
    ? (view?.items.filter(
        (item) => item.point && Math.hypot(item.point.x - wildArea.label.x, item.point.y - wildArea.label.y) < NEAR_WILD,
      ).length ?? 0)
    : 0;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false, title: "熊猫地图" }} />
      <View testID="panda-world-map" className="absolute inset-0" {...handlers}>
        {viewport && camera && view ? (
          <>
            <Pressable accessible={false} onPress={() => setSelection(null)} className="absolute inset-0" />
            <VenueMap
              items={layers.venues || year !== undefined ? view.items : []}
              camera={camera}
              viewport={viewport}
              selectedId={place?.id ?? null}
              onSelect={onMarker}
              wild={layers.wild && year === undefined ? WILD_AREAS : []}
              selectedWildId={wildArea?.range.id ?? null}
              onSelectWild={onWild}
              year={yearView}
            />
          </>
        ) : (
          <View className="flex-1 bg-map-water" />
        )}
      </View>

      <View className="absolute left-gutter" style={{ top: insets.top + 8 }}>
        <FloatingButton label="返回" onPress={() => router.back()}>
          <Icon icon={ChevronLeft} size={24} tone="label" strokeWidth={2.25} />
        </FloatingButton>
      </View>
      {viewport && view ? (
        <View className="absolute right-gutter items-end gap-stack-tight" style={{ top: insets.top + 8 }}>
          <LayerToggle
            venues={layers.venues}
            wild={layers.wild}
            onVenues={() => setLayers((current) => ({ ...current, venues: !current.venues }))}
            onWild={() => {
              setLayers((current) => ({ ...current, wild: !current.wild }));
              if (selection?.kind === "wild") setSelection(null);
            }}
          />
          <ViewControls
            overseas={overseas}
            onOverseas={() => {
              setSelection(null);
              flyTo(fitPoints(everywhere, viewport, 56, 0));
            }}
            onHome={() => {
              setSelection(null);
              flyTo(home(viewport));
            }}
          />
        </View>
      ) : null}

      <View
        className="absolute inset-x-0 bottom-0 rounded-t-card bg-paper"
        style={{
          height: sheetUp ? sheetMax : SHEET_PEEK + insets.bottom,
          boxShadow: "0 -2px 16px rgba(0,0,0,0.08)",
          borderCurve: "continuous",
        }}
      >
        <View {...sheetResponder.panHandlers}>
          <Pressable
            role="button"
            accessibilityLabel={sheetUp ? "收起面板" : "展开面板"}
            onPress={() => setSheetUp((up) => !up)}
            className="items-center pt-3 pb-3"
          >
            <View className="rounded-full bg-tertiary-foreground" style={{ width: 36, height: 5, opacity: 0.6 }} />
          </Pressable>
        </View>
        <ScrollView
          scrollEnabled={sheetUp}
          contentContainerClassName="px-gutter pt-stack-tight"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          {view ? (
            place ? (
              <PlaceSheet item={place} onClose={() => setSelection(null)} />
            ) : wildArea ? (
              <WildSheet area={wildArea} nearVenues={nearVenues} onClose={() => setSelection(null)} />
            ) : year !== undefined ? (
              <YearSheet timelineBlock={timelineBlock} events={yearEvents} />
            ) : (
              <Overview view={view} timelineBlock={timelineBlock} wildShown={layers.wild} onChoose={choose} />
            )
          ) : failed ? (
            <LoadFailed message="地图暂时打不开。" onRetry={() => void refetch()} />
          ) : (
            <View className="gap-stack" accessibilityLabel="正在加载地图">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-40 w-full rounded-group" />
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
