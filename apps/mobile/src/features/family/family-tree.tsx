import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, type ScrollViewInstance, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { Easing, FadeIn, ReduceMotion, type SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { type Family, type FamilyMember, memberMeta } from "@/features/family/family";
import { type PlacedCard, type PlacedLine, layoutFamily } from "@/features/family/family-layout";
import { matchLines, type MorphLine, transitionOffset } from "@/features/family/family-transition";
import { cn } from "@/lib/utils";
import { usePandaCover } from "@/lib/covers";

export function MemberAvatar({ member, className }: { member: FamilyMember; className?: string }) {
  const photo = usePandaCover(member.id);
  return (
    <Avatar alt={member.name} className={cn("size-11", className)}>
      {member.photoUrl || photo ? <AvatarImage source={{ uri: member.photoUrl ?? photo! }} /> : null}
      <AvatarFallback className="bg-accent">
        <Text className="font-extrabold">{member.name.slice(0, 1)}</Text>
      </AvatarFallback>
    </Avatar>
  );
}

function Card({ card, onSelect, pending }: { card: PlacedCard; onSelect: (member: FamilyMember) => void; pending: string | null }) {
  const { member, kind } = card;
  const position = { left: 0, top: 0, width: card.width, height: card.height };

  const label = pending === member.slug ? `正在加载${member.name}的家谱` : `${member.name}，${memberMeta(member)}，查看它的家族`;
  return (
    <Pressable
      style={position}
      className="absolute items-center gap-1.5 rounded-control px-1.5 pt-2 active:bg-accent"
      onPress={() => onSelect(member)}
      disabled={kind === "focus" || pending !== null}
      accessibilityState={{ disabled: kind === "focus" || pending !== null, busy: pending === member.slug }}
      role={kind === "focus" ? undefined : "button"}
      accessibilityLabel={kind === "focus" ? `${member.name}，当前查看` : label}
    >
      <View className={kind === "focus" ? "rounded-full border-hairline border-foreground p-1" : undefined}>
        <MemberAvatar member={member} className={kind === "focus" ? "size-16" : "size-12"} />
      </View>
      <Text className="font-bold" numberOfLines={1}>
        {member.name}
      </Text>
      <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
        {kind === "focus" ? "当前查看" : pending === member.slug ? "加载中…" : member.relation}
      </Text>
    </Pressable>
  );
}

const motion = { duration: 250, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

function MovingCard({ card, from, moving, revision, onSelect, pending }: {
  card: PlacedCard;
  from?: PlacedCard;
  moving: boolean;
  revision: string;
  onSelect: (member: FamilyMember) => void;
  pending: string | null;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  useLayoutEffect(() => {
    if (!moving) return;
    x.set(from ? from.x + from.width / 2 - card.x - card.width / 2 : 0);
    y.set(from ? from.y - card.y : 0);
    opacity.set(from ? 1 : 0);
    x.set(withTiming(0, motion));
    y.set(withTiming(0, motion));
    opacity.set(withTiming(1, motion));
  }, [revision, x, y, opacity, moving, from, card.x, card.y, card.width]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateX: x.get() }, { translateY: y.get() }] }));
  return (
    <Animated.View style={[{ position: "absolute", left: card.x, top: card.y, width: card.width, height: card.height }, animated]}>
      <Card card={card} onSelect={onSelect} pending={pending} />
    </Animated.View>
  );
}

function RetiringCard({ card }: { card: PlacedCard }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withTiming(0, { ...motion, duration: 100 }));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[{ position: "absolute", left: card.x, top: card.y, width: card.width, height: card.height }, style]}>
      <Card card={card} onSelect={() => undefined} pending="transition" />
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function MorphingLine({ line, progress, color }: { line: MorphLine; progress: SharedValue<number>; color: string }) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.get();
    let path = line.parts[0] ?? "";
    for (let index = 0; index < line.to.length; index++) {
      path += (line.from[index]! + (line.to[index]! - line.from[index]!) * t) + (line.parts[index + 1] ?? "");
    }
    return { d: path };
  });
  return <AnimatedPath animatedProps={animatedProps} stroke={color} strokeWidth={0.5} fill="none" />;
}

function TransitionLines({ lines, previous, previousOffset, lineColor }: {
  lines: PlacedLine[];
  previous?: { lines: PlacedLine[]; width: number; height: number };
  previousOffset: number;
  lineColor: string;
}) {
  const paths = useMemo(() => matchLines(previous?.lines ?? [], lines, previousOffset), [previous, lines, previousOffset]);
  const progress = useSharedValue(previous ? 0 : 1);
  const oldOpacity = useSharedValue(previous ? 1 : 0);
  const newOpacity = useSharedValue(previous ? 0 : 1);
  useLayoutEffect(() => {
    if (previous) {
      progress.set(withTiming(1, motion));
      oldOpacity.set(withTiming(0, { ...motion, duration: 100 }));
      newOpacity.set(withDelay(150, withTiming(1, { ...motion, duration: 100 }), ReduceMotion.System));
    }
  }, [previous, progress, oldOpacity, newOpacity]);
  const oldStyle = useAnimatedStyle(() => ({ opacity: oldOpacity.get() }));
  const newStyle = useAnimatedStyle(() => ({ opacity: newOpacity.get() }));
  return (
    <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", width: "100%", height: "100%" }}>
      <Svg width="100%" height="100%">
        {paths.matched.map((line) => <MorphingLine key={line.id} line={line} progress={progress} color={lineColor} />)}
      </Svg>
      {previous ? (
        <Animated.View style={[{ position: "absolute", width: "100%", height: "100%" }, oldStyle]}>
          <Svg width="100%" height="100%">{paths.removed.map((line) => <Path key={line.id} d={line.path} stroke={lineColor} strokeWidth={0.5} fill="none" />)}</Svg>
        </Animated.View>
      ) : null}
      <Animated.View style={[{ position: "absolute", width: "100%", height: "100%" }, newStyle]}>
        <Svg width="100%" height="100%">{paths.added.map((line) => <Path key={line.id} d={line.path} stroke={lineColor} strokeWidth={0.5} fill="none" />)}</Svg>
      </Animated.View>
    </View>
  );
}

export function FamilyTree({ family, previousFamily, onSelect, pending }: { family: Family; previousFamily?: Family; onSelect: (member: FamilyMember) => void; pending: string | null }) {
  const [width, setWidth] = useState(0);
  const lineColor = useCSSVariable("--color-input");
  const layout = useMemo(() => (width > 0 ? layoutFamily(family, width) : null), [family, width]);
  const previous = useMemo(() => (width > 0 && previousFamily ? layoutFamily(previousFamily, width) : null), [previousFamily, width]);
  const scroll = useRef<ScrollViewInstance>(null);

  const previousOffset = previous && layout ? transitionOffset(previous, layout, width) : 0;
  const previousCards = useMemo(() => new Map(
    previous?.cards.map((card) => [card.member.id, { ...card, x: card.x + previousOffset }]) ?? [],
  ), [previous, previousOffset]);

  // A wide family opens scrolled to the focus panda, not to its left edge.
  const centreOnFocus = useCallback(() => {
    const focus = layout?.cards.find((card) => card.kind === "focus");
    if (focus) scroll.current?.scrollTo({ x: Math.max(0, focus.x + focus.width / 2 - width / 2), animated: false });
  }, [layout, width]);

  useLayoutEffect(() => {
    centreOnFocus();
  }, [centreOnFocus]);

  return (
    <Animated.View testID="family-tree-canvas" entering={previousFamily ? undefined : FadeIn.duration(250).reduceMotion(ReduceMotion.System)} className="overflow-hidden rounded-tile bg-card" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {layout ? (
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={centreOnFocus}>
          <View style={{ width: layout.width, height: layout.height }}>
            <TransitionLines key={family.focus.id} lines={layout.lines} previous={previous ?? undefined} previousOffset={previousOffset} lineColor={String(lineColor)} />
            {previous?.cards.filter((old) => !layout.cards.some((card) => card.member.id === old.member.id)).map((card) => (
              <RetiringCard key={`old-${family.focus.id}-${card.member.id}`} card={{ ...card, x: card.x + previousOffset }} />
            ))}
            {layout.groups.map((group) => (
              <View
                key={`${group.x}-${group.label}`}
                style={{ left: group.x, top: group.y, width: group.width, height: group.height }}
                className="absolute items-center rounded-tile border-hairline border-dashed border-input pt-1.5"
              >
                <Text variant="footnote" className="text-muted-foreground">
                  {group.label}
                </Text>
              </View>
            ))}
            {layout.cards.map((card) => (
              <MovingCard
                key={card.member.id}
                card={card}
                moving={Boolean(previous)}
                revision={family.focus.id}
                from={previousCards.get(card.member.id)}
                onSelect={onSelect}
                pending={pending}
              />
            ))}
            {layout.noChildren ? (
              <View
                style={{
                  left: layout.noChildren.x,
                  top: layout.noChildren.y,
                  width: layout.noChildren.width,
                  height: layout.noChildren.height,
                }}
                className="absolute items-center justify-center rounded-full border-hairline border-dashed border-input"
              >
                <Text variant="footnote" className="text-muted-foreground">暂无后代记录</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <View className="h-80" />
      )}
    </Animated.View>
  );
}
