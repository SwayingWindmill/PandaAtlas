import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  BadgeCheck,
  Cake,
  CalendarHeart,
  Clock,
  Flower,
  History,
  Hourglass,
  type LucideIcon,
  MapPin,
  Newspaper,
  Plane,
} from "@/components/icons";
import { PressScale } from "@/components/press-scale";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { Text } from "@/components/ui/text";
import type { FamilyMember } from "@/features/family/family";
import { useMilestonesOn } from "@/features/milestones/prefs";
import { sourceLine } from "@/features/on-this-day/memory-group";
import { DECEASED_POLICY, isCubDay } from "@/features/on-this-day/on-this-day";
import { type Profile, longDate, shortPublisher } from "@/features/pandas/profile";
import { Face } from "@/features/pandas/profile-family-tab";
import type { Stat } from "@/features/pandas/profile-facts";
import type { MilestoneKind } from "@/features/timeline/timeline";
import { PAGE_COLUMN, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

const KIND_WORD: Record<MilestoneKind, string> = {
  birth: "出生",
  cub: "产仔",
  move: "迁居",
  arrive: "迁居",
  home: "回国",
  debut: "亮相",
  naming: "命名",
  death: "离世",
  stay: "入住",
  leave: "迁出",
  month: "满月",
  hundred: "百天",
  age: "生日",
  parent: "产仔",
};

const PARENT_FACE = 30;
const FACE_RING = 2;
/** Sources a fan sees before asking for the rest; a long list would bury the actions below it. */
const SOURCES_SHOWN = 5;

export function openPandaCorrection(slug: string) {
  router.push({ pathname: "/pandas/[slug]/correct", params: { slug } });
}

function statIcon(stat: Stat, deceased: boolean): LucideIcon {
  if (stat.key === "birth") return Cake;
  if (stat.key === "age") return deceased ? Hourglass : Clock;
  return deceased ? Flower : MapPin;
}

function ProfileStatTile({
  stat,
  confirmed,
  onPress,
  stacked,
  deceased,
}: {
  stat: Stat;
  deceased: boolean;
  confirmed: boolean;
  onPress?: () => void;
  stacked: boolean;
}) {
  const label = stat.key === "place" ? (stat.detail ?? stat.label) : stat.label;
  const spoken = `${stat.label}，${stat.value}${stat.unit ?? ""}${stat.detail ? `，${stat.detail}` : ""}${confirmed ? "，已确认" : ""}`;
  const body = (
    <View className="flex-1 bg-card px-3 py-3" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
      <View className="flex-row items-center gap-1">
        <Icon icon={statIcon(stat, deceased)} size="footnote" tone="tint" strokeWidth={2.3} />
        <Text variant="footnote" className="shrink font-semibold text-muted-foreground" numberOfLines={stacked ? undefined : 1}>
          {label}
        </Text>
      </View>
      <View className="mt-1.5 flex-row items-baseline gap-0.5">
        <Text variant="stat" className="shrink" numberOfLines={stacked ? undefined : 1} adjustsFontSizeToFit={!stacked}>
          {stat.value}
        </Text>
        {stat.unit ? <Text className="text-footnote font-semibold">{stat.unit}</Text> : null}
      </View>
    </View>
  );
  const style = stacked ? undefined : { flex: 1 };
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }
  return (
    <PressScale onPress={onPress} role="link" accessibilityLabel={spoken} containerStyle={style} style={{ flex: 1 }}>
      {body}
    </PressScale>
  );
}

export function Stats({ profile }: { profile: Profile }) {
  const stacked = useStacked();
  const visit = profile.visit;
  return (
    <View className={stacked ? "gap-2.5" : "flex-row gap-2.5"}>
      {profile.stats.map((stat) => (
        <ProfileStatTile
          key={stat.key}
          stat={stat}
          stacked={stacked}
          deceased={profile.deceased}
          confirmed={stat.key === "birth" && profile.certainty.birth === "confirmed"}
          onPress={
            stat.key === "place" && visit
              ? () => router.push({ pathname: "/institutions/[slug]", params: { slug: visit.institutionSlug } })
              : undefined
          }
        />
      ))}
    </View>
  );
}

export function KeyRows({ profile }: { profile: Profile }) {
  const parents = profile.family ? [profile.family.mother, profile.family.father].filter((m): m is FamilyMember => m !== null) : [];
  const move = profile.move;
  if (parents.length === 0 && !move) return null;
  return (
    <ListSection>
      {parents.length > 0 ? (
        <ListCell
          leading={
            <View className="flex-row" accessible={false}>
              {parents.map((member, index) => (
                <View
                  key={member.id}
                  className={cn("rounded-pill border-card", index > 0 && "-ml-2.5")}
                  style={{ borderWidth: index > 0 ? FACE_RING : 0 }}
                >
                  <Face member={member} size={PARENT_FACE} />
                </View>
              ))}
            </View>
          }
          label={parents.map((member) => member.name).join(" · ")}
          meta="父母"
          accessibilityLabel={`父母，${parents.map((member) => `${member.relation}${member.name}`).join("，")}`}
          href={{ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } }}
          last={!move}
        />
      ) : null}
      {move ? (
        <ListCell
          leading={
            <View className="items-center" style={{ width: PARENT_FACE * 2 - 10 }}>
              <Icon icon={Plane} tone="label" />
            </View>
          }
          label={`${move.from} → ${move.to}`}
          accessibilityLabel={`${move.year} 年从${move.from}到${move.to}`}
          meta={move.year}
          href={{ pathname: "/pandas/[slug]/timeline", params: { slug: profile.slug } }}
          last
        />
      ) : null}
    </ListSection>
  );
}

function timelineItems(profile: Profile): TimelineItem[] {
  return [...profile.events]
    .reverse()
    .map((event) => ({ key: event.id, date: event.date, meta: KIND_WORD[event.kind], title: event.text }));
}

function Seal({ source }: { source: Profile["sources"][number] }) {
  return (
    <Pressable
      role="link"
      accessibilityLabel={`来源，${source.publisher}`}
      accessibilityHint="在浏览器中打开"
      hitSlop={10}
      onPress={() => void WebBrowser.openBrowserAsync(source.url)}
      className="flex-row items-center gap-1 active:opacity-60"
    >
      <Icon icon={BadgeCheck} size={13} tone="tint" strokeWidth={2.2} />
      <Text variant="footnote" className="font-semibold text-muted-foreground" numberOfLines={1}>
        {shortPublisher(source.publisher)}
      </Text>
    </Pressable>
  );
}

function eventSource(profile: Profile) {
  const sources = new Map(profile.sources.map((source) => [source.id, source]));
  for (const event of [...profile.events].reverse()) {
    const found = event.sourceIds.map((id) => sources.get(id)).find(Boolean);
    if (found) return found;
  }
  return null;
}

export function Experience({ profile }: { profile: Profile }) {
  const items = timelineItems(profile).slice(0, 3);
  if (items.length === 0) return null;
  const source = eventSource(profile);
  return (
    <View className="gap-3 bg-card px-4 py-3.5" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          role="link"
          accessibilityLabel="经历，看时间线"
          hitSlop={12}
          onPress={() => router.push({ pathname: "/pandas/[slug]/timeline", params: { slug: profile.slug } })}
          className="active:opacity-60"
        >
          <Text variant="subheadline" className="font-bold">
            经历
          </Text>
        </Pressable>
        {source ? <Seal source={source} /> : null}
      </View>
      <Timeline items={items} />
    </View>
  );
}

export function EventsList({ profile }: { profile: Profile }) {
  const items = timelineItems(profile);
  const timeline = { pathname: "/pandas/[slug]/timeline" as const, params: { slug: profile.slug } };
  return (
    <View className="gap-3">
      {items.length > 0 ? (
        <View className="bg-card px-4 py-3.5" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
          <Timeline items={items} />
        </View>
      ) : null}
      <ListSection>
        <ListCell icon={History} label="时间线" href={timeline} last={items.length > 0} />
        {items.length === 0 ? (
          <ListCell label="知道它的经历？告诉我们" tone="tint" onPress={() => openPandaCorrection(profile.slug)} last />
        ) : null}
      </ListSection>
    </View>
  );
}

export function Memories({ profile }: { profile: Profile }) {
  const sources = new Map(profile.sources.map((source) => [source.id, source]));
  // 满月 and 满百天 are 里程碑, and go with its switch.
  const milestonesOn = useMilestonesOn();
  const memories = profile.memories.filter((memory) => milestonesOn || !isCubDay(memory));
  if (memories.length === 0) return null;
  return (
    <ListSection title={profile.deceased ? DECEASED_POLICY.heading : "那年今天"} titleIcon={CalendarHeart}>
      {memories.map((memory, index) => (
        <ListCell
          key={memory.key}
          label={memory.text}
          detail={sourceLine(memory, memory.sourceIds.map((id) => sources.get(id)).find(Boolean)) ?? undefined}
          lines={3}
          last={index === memories.length - 1}
        />
      ))}
    </ListSection>
  );
}

export function Sources({ sources }: { sources: Profile["sources"] }) {
  const [all, setAll] = useState(false);
  const shown = all ? sources : sources.slice(0, SOURCES_SHOWN);
  const hidden = sources.length - shown.length;
  return (
    <ListSection title="资料来源" titleIcon={Newspaper}>
      {shown.map((source, index) => (
        <ListCell
          key={source.id}
          role="link"
          label={source.title}
          detail={`${source.publisher}　${longDate(source.lastVerifiedOn)}`}
          accessibilityLabel={`${source.publisher}，${source.title}，核实于 ${longDate(source.lastVerifiedOn)}`}
          accessibilityHint="在浏览器中打开"
          onPress={() => void WebBrowser.openBrowserAsync(source.url)}
          last={hidden === 0 && index === shown.length - 1}
        />
      ))}
      {hidden > 0 ? <ListCell tone="tint" label={`显示全部 ${sources.length} 条`} onPress={() => setAll(true)} last /> : null}
    </ListSection>
  );
}

export function NoPhoto({ profile }: { profile: Profile }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[PAGE_COLUMN, { paddingTop: insets.top + 64 }]} className="px-gutter pb-4">
      <ListSection>
        <ListCell label="暂无照片" />
        <ListCell label="有它的照片？告诉我们" tone="tint" onPress={() => openPandaCorrection(profile.slug)} last />
      </ListSection>
    </View>
  );
}
