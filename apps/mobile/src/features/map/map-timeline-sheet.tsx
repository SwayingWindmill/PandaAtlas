import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, View } from "react-native";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import {
  Baby,
  History,
  type LucideIcon,
  Pause,
  Plane,
  Play,
  Sparkles,
  Tag,
  Truck,
} from "@/components/icons";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { Text } from "@/components/ui/text";
import { MAP_FLOAT_SHADOW } from "@/features/map/map-controls";
import type { MapTimeline, YearEvent, YearEventKind } from "@/features/map/timeline";

const HIST_HEIGHT = 40;

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

export function YearSheet({ timelineBlock, events }: { timelineBlock: React.ReactNode; events: YearEvent[] }) {
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
