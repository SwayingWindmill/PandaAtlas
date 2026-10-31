import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, type ScrollViewInstance, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { type Family, type FamilyMember, memberMeta } from "@/features/family/family";
import { type PlacedCard, layoutFamily } from "@/features/family/family-layout";
import { cn } from "@/lib/utils";

export function openFamily(member: FamilyMember) {
  router.push({ pathname: "/pandas/[slug]/family", params: { slug: member.slug } });
}

export function MemberAvatar({ member, className }: { member: FamilyMember; className?: string }) {
  return (
    <Avatar alt={member.name} className={cn("size-11", className)}>
      {member.photoUrl ? <AvatarImage source={{ uri: member.photoUrl }} /> : null}
      <AvatarFallback className="bg-accent">
        <Text className="font-extrabold">{member.name.slice(0, 1)}</Text>
      </AvatarFallback>
    </Avatar>
  );
}

function Card({ card }: { card: PlacedCard }) {
  const { member, kind } = card;
  const position = { left: card.x, top: card.y, width: card.width, height: card.height };

  if (kind === "focus") {
    return (
      <View
        style={position}
        className="absolute items-center justify-center gap-1.5 rounded-control bg-primary px-2"
        accessibilityLabel={`${member.name}，当前查看`}
      >
        <MemberAvatar member={member} className="size-16" />
        <Text className="font-bold text-primary-foreground" numberOfLines={1}>
          {member.name}
        </Text>
        {member.birthDate ? (
          <Text variant="footnote" className="text-primary-foreground/70">{member.birthDate.slice(0, 4)}</Text>
        ) : null}
      </View>
    );
  }

  const label = `${member.name}，${memberMeta(member)}，查看它的家族`;
  if (kind === "parent") {
    return (
      <Pressable
        style={position}
        className="absolute flex-row items-center gap-2 rounded-control border-hairline border-border bg-card px-2.5 active:bg-accent"
        onPress={() => openFamily(member)}
        role="button"
        accessibilityLabel={label}
      >
        <MemberAvatar member={member} className="size-10" />
        <View className="min-w-0 flex-1">
          <Text className="font-bold" numberOfLines={1}>
            {member.name}
          </Text>
          <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
            {[member.relation, member.birthDate?.slice(0, 4)].filter(Boolean).join("　")}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={position}
      className="absolute items-center justify-center gap-1.5 rounded-control border-hairline border-border bg-card px-1.5 active:bg-accent"
      onPress={() => openFamily(member)}
      role="button"
      accessibilityLabel={label}
    >
      <MemberAvatar member={member} className="size-12" />
      <Text className="font-bold" numberOfLines={1}>
        {member.name}
      </Text>
      <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
        {member.relation}
      </Text>
    </Pressable>
  );
}

export function FamilyTree({ family }: { family: Family }) {
  const [width, setWidth] = useState(0);
  const [lineColor, inkColor] = useCSSVariable(["--color-input", "--color-foreground"]);
  const layout = useMemo(() => (width > 0 ? layoutFamily(family, width) : null), [family, width]);
  const scroll = useRef<ScrollViewInstance>(null);

  // A wide family opens scrolled to the focus panda, not to its left edge.
  function centreOnFocus() {
    const focus = layout?.cards.find((card) => card.kind === "focus");
    if (focus) scroll.current?.scrollTo({ x: Math.max(0, focus.x + focus.width / 2 - width / 2), animated: false });
  }

  return (
    <View className="overflow-hidden rounded-tile bg-muted" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {layout ? (
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={centreOnFocus}>
          <View style={{ width: layout.width, height: layout.height }}>
            <Svg aria-hidden width={layout.width} height={layout.height} style={{ position: "absolute" }}>
              {layout.lines.map((line) => (
                <Path key={line} d={line} stroke={String(lineColor)} strokeWidth={0.5} fill="none" />
              ))}
              {layout.couple ? <Circle cx={layout.couple.x} cy={layout.couple.y} r={4} fill={String(inkColor)} /> : null}
            </Svg>
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
              <Card key={card.member.id} card={card} />
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
                <Text variant="footnote" className="text-muted-foreground">还没有后代</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <View className="h-80" />
      )}
    </View>
  );
}
