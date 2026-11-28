import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, View } from "react-native";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { History, Pause, Play } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { MAP_FLOAT_SHADOW } from "@/features/map/map-controls";
import type { MapTimeline, YearEvent, YearEventKind } from "@/features/map/timeline";
import { cn } from "@/lib/utils";

const HIST_HEIGHT = 40;
const EVENT_DOT = 8;
const EVENT_THUMB = 36;

const KIND_BADGE: Record<YearEventKind, string> = {
  birth: "出生",
  abroad: "出国",
  home: "归国",
  move: "旅居",
  debut: "亮相",
  naming: "取名",
  death: "",
  other: "",
};

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
            style={{ width: 22, height: 22, top: HIST_HEIGHT - 5.5, left: (index + 0.5) * bar - 11, boxShadow: MAP_FLOAT_SHADOW }}
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

export function TimelineBlock({
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

function YearEventRow({
  event,
  pandaId,
  first,
  last,
  stacked,
}: {
  event: YearEvent;
  pandaId: string | undefined;
  first: boolean;
  last: boolean;
  stacked: boolean;
}) {
  const quiet = event.kind === "death";
  const isHome = event.kind === "home";
  const badge = KIND_BADGE[event.kind];
  const title = quiet ? `${event.who}　${event.what}` : event.who;
  const detail = quiet ? undefined : event.what;
  const spoken = `${event.when}${badge ? `，${badge}` : ""}，${title}${detail ? `，${detail}` : ""}`;

  const content = (
    <View className="flex-row gap-row">
      <View className="items-center" style={{ width: component.timeline.column }}>
        <View className={cn("w-hairline bg-border", first && "opacity-0")} style={{ height: 6 }} />
        <View
          className={cn("rounded-full", isHome ? "bg-primary" : quiet ? "bg-tertiary-foreground" : "bg-graphic")}
          style={{ width: EVENT_DOT, height: EVENT_DOT }}
        />
        <View className={cn("w-hairline flex-1 bg-border", last && "opacity-0")} />
      </View>

      <View className={cn("min-w-0 flex-1 flex-row items-center gap-row", !last && "pb-stack-tight")}>
        <View className="min-w-0 flex-1 gap-hair-gap">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text variant="footnote" className="text-muted-foreground tabular-nums">
              {event.when}
            </Text>
            {badge ? (
              <View className={cn("rounded-pill px-2 py-0.5", isHome ? "bg-highlight-soft" : "bg-secondary")}>
                <Text variant="footnote" className={cn("font-semibold", isHome ? "text-primary" : "text-muted-foreground")}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="headline" className={cn(quiet && "font-normal text-muted-foreground")} numberOfLines={stacked ? undefined : 2}>
            {title}
          </Text>
          {detail ? (
            <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
              {detail}
            </Text>
          ) : null}
        </View>
        {!stacked && pandaId && !quiet ? <PandaThumb pandaId={pandaId} name={event.who} size={EVENT_THUMB} /> : null}
      </View>
    </View>
  );

  if (!event.pandaSlug) {
    return (
      <View accessible accessibilityLabel={spoken}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      role="link"
      accessibilityLabel={spoken}
      onPress={() => router.push({ pathname: "/pandas/[slug]", params: { slug: event.pandaSlug! } })}
      className="min-h-11 active:opacity-70"
    >
      {content}
    </Pressable>
  );
}

function YearEvents({
  events,
  pandaIdBySlug,
}: {
  events: YearEvent[];
  pandaIdBySlug?: ReadonlyMap<string, string>;
}) {
  const stacked = useStacked();
  if (events.length === 0) {
    return (
      <Text variant="subheadline" className="text-muted-foreground">
        这一年没有出生、搬家或亮相的记录。
      </Text>
    );
  }
  return (
    <View className="rounded-group bg-card px-inset py-row" style={{ borderCurve: "continuous" }}>
      {events.map((event, index) => (
        <YearEventRow
          key={event.id}
          event={event}
          pandaId={event.pandaSlug ? pandaIdBySlug?.get(event.pandaSlug) : undefined}
          first={index === 0}
          last={index === events.length - 1}
          stacked={stacked}
        />
      ))}
    </View>
  );
}

export function YearSheet({
  timelineBlock,
  events,
  pandaIdBySlug,
}: {
  timelineBlock: React.ReactNode;
  events: YearEvent[];
  pandaIdBySlug?: ReadonlyMap<string, string>;
}) {
  return (
    <View className="gap-section-tight">
      {timelineBlock}
      <View className="gap-stack-tight">
        <Text variant="headline" role="heading">
          这一年
        </Text>
        <YearEvents events={events} pandaIdBySlug={pandaIdBySlug} />
      </View>
    </View>
  );
}
