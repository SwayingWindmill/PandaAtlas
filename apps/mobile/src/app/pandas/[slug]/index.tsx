import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  Baby,
  BadgeCheck,
  BookA,
  Cake,
  CalendarHeart,
  Flag,
  Flower,
  FolderHeart,
  History,
  Hourglass,
  House,
  type LucideIcon,
  MapPin,
  Mars,
  Navigation,
  Network,
  Newspaper,
  Plane,
  Sparkles,
  Users,
  Venus,
} from "@/components/icons";
import { PendingDot } from "@/components/status-mark";
import { LoadFailed } from "@/components/load-failed";
import { PressScale } from "@/components/press-scale";
import { HeroHeader, useHeroScroll } from "@/components/hero-header";
import { HeroFade } from "@/components/scrim";
import { Segmented } from "@/components/segmented";
import { StretchyHero } from "@/components/stretchy-hero";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { PAGE_ENTER } from "@/design/motion";
import { component } from "@/design/tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CompareRows } from "@/features/compare/compare-rows";
import { PandaActions } from "@/features/engagement/panda-actions";
import { type FamilyMember, relativesOf } from "@/features/family/family";
import { sourceLine } from "@/features/on-this-day/memory-group";
import { useMilestonesOn } from "@/features/milestones/prefs";
import { DECEASED_POLICY, isCubDay } from "@/features/on-this-day/on-this-day";
import { openPanda } from "@/features/pandas/panda-row";
import { type Profile, longDate, profileQueryOptions } from "@/features/pandas/profile";
import type { Stat } from "@/features/pandas/profile-facts";
import type { MilestoneKind } from "@/features/timeline/timeline";
import { RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** Hero height below the status bar. The photo runs under the status bar too. */
const HERO = 320;
/** How far the name block rides up onto the photo's faded bottom. */
const OVERLAP = 64;

function correct(slug: string) {
  router.push({ pathname: "/pandas/[slug]/correct", params: { slug } });
}

function statIcon(stat: Stat, deceased: boolean): LucideIcon {
  if (stat.key === "birth") return Cake;
  if (stat.key === "age") return deceased ? Hourglass : Sparkles;
  return deceased ? Flower : MapPin;
}

/** The glyph on a timeline line, by what happened. */
const KIND_ICON: Record<MilestoneKind, LucideIcon> = {
  birth: Cake,
  cub: Baby,
  move: Plane,
  arrive: MapPin,
  home: House,
  debut: Sparkles,
  naming: BookA,
  death: Flower,
  stay: House,
  leave: Navigation,
  month: Cake,
  hundred: Cake,
  age: Cake,
  parent: Baby,
};

/** One of the three tiles: a bare glyph, the value large with its unit, the label under it. */
function StatTile({
  stat,
  confirmed,
  onPress,
  stacked,
  deceased,
}: {
  stat: Stat;
  deceased: boolean;
  /** The birthday tile carries a badge when the date is confirmed. */
  confirmed: boolean;
  onPress?: () => void;
  stacked: boolean;
}) {
  const label = stat.key === "place" ? (stat.detail ?? stat.label) : stat.label;
  const spoken = `${stat.label}，${stat.value}${stat.unit ?? ""}${stat.detail ? `，${stat.detail}` : ""}${confirmed ? "，已确认" : ""}`;
  const body = (
    <View className="flex-1 bg-card p-3" style={{ borderRadius: RADIUS.tile, borderCurve: "continuous" }}>
      <View className="flex-row items-center justify-between">
        <Icon icon={statIcon(stat, deceased)} size="subhead" tone="secondary" />
        {confirmed ? <Icon icon={BadgeCheck} size="subhead" tone="tint" /> : null}
      </View>
      <View className="mt-2.5 flex-row items-baseline gap-0.5">
        <Text variant="stat" className="shrink" numberOfLines={stacked ? undefined : 1} adjustsFontSizeToFit={!stacked}>
          {stat.value}
        </Text>
        {stat.unit ? <Text className="text-footnote font-semibold">{stat.unit}</Text> : null}
      </View>
      <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 1}>
        {label}
      </Text>
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

function Stats({ profile }: { profile: Profile }) {
  const stacked = useStacked();
  const visit = profile.visit;
  return (
    <View className={stacked ? "gap-2.5" : "flex-row gap-2.5"}>
      {profile.stats.map((stat) => (
        <StatTile
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

const FACE = 26;
const FACE_RING = 2;

/** A parent's face on the 父母 row: the photo, or the first character, ringed in the card colour. */
function Face({ member, first }: { member: FamilyMember; first: boolean }) {
  return (
    <View
      className={cn("items-center justify-center overflow-hidden border-card bg-highlight-soft", !first && "-ml-2.5")}
      style={{ width: FACE, height: FACE, borderRadius: FACE / 2, borderWidth: FACE_RING }}
    >
      {member.photoUrl ? (
        <Image source={member.photoUrl} style={{ width: FACE, height: FACE }} contentFit="cover" accessible={false} />
      ) : (
        <Text className="text-footnote font-bold text-primary">{member.name.slice(0, 1)}</Text>
      )}
    </View>
  );
}

/** 父母 and the latest move, as two rows; each opens the page that tells the rest. */
function KeyRows({ profile }: { profile: Profile }) {
  const parents = profile.family ? [profile.family.mother, profile.family.father].filter((m): m is FamilyMember => m !== null) : [];
  const move = profile.move;
  if (parents.length === 0 && !move) return null;
  return (
    <ListSection>
      {parents.length > 0 ? (
        <ListCell
          icon={Users}
          label={parents.map((member) => member.name).join(" · ")}
          accessibilityLabel={`父母，${parents.map((member) => `${member.relation}${member.name}`).join("，")}`}
          trailing={
            <View className="flex-row" accessible={false}>
              {parents.map((member, index) => (
                <Face key={member.id} member={member} first={index === 0} />
              ))}
            </View>
          }
          href={{ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } }}
          last={!move}
        />
      ) : null}
      {move ? (
        <ListCell
          icon={Plane}
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
    .map((event) => ({ key: event.id, date: event.date, title: event.text, icon: KIND_ICON[event.kind] }));
}

/** The latest few events in a card, newest first. */
function Recent({ profile }: { profile: Profile }) {
  const items = timelineItems(profile).slice(0, 3);
  if (items.length === 0) return null;
  return (
    <View className="gap-2.5 bg-card px-4 py-3.5" style={{ borderRadius: RADIUS.tile, borderCurve: "continuous" }}>
      <Pressable
        role="link"
        accessibilityLabel="最近，看时间线"
        onPress={() => router.push({ pathname: "/pandas/[slug]/timeline", params: { slug: profile.slug } })}
        className="flex-row items-center justify-between"
      >
        <Text variant="headline">最近</Text>
        <Icon icon={History} size="subhead" tone="tertiary" />
      </Pressable>
      <Timeline items={items} />
    </View>
  );
}

function FamilyList({ profile }: { profile: Profile }) {
  const relatives = profile.family ? relativesOf(profile.family) : [];
  return (
    <ListSection>
      {relatives.map((member) => (
        <ListCell
          key={member.id}
          label={member.name}
          meta={member.relation}
          leading={<Face member={member} first />}
          onPress={() => openPanda(member.slug)}
          role="link"
        />
      ))}
      <ListCell icon={Network} label="家族树" href={{ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } }} last />
    </ListSection>
  );
}

const GRID_GAP = 2;

function PhotoGrid({ profile }: { profile: Profile }) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - 32 - GRID_GAP * 2) / 3);
  const open = () => router.push({ pathname: "/pandas/[slug]/photos", params: { slug: profile.slug } });
  if (profile.photos.length === 0) {
    return (
      <ListSection>
        <ListCell label="有它的照片？告诉我们" tone="tint" onPress={() => correct(profile.slug)} last />
      </ListSection>
    );
  }
  return (
    <View className="flex-row flex-wrap overflow-hidden" style={{ gap: GRID_GAP, borderRadius: RADIUS.tile }}>
      {profile.photos.slice(0, 12).map((photo, index) => (
        <Pressable key={photo.id} onPress={open} role="link" accessibilityLabel={`照片 ${index + 1}`}>
          <Image source={photo.url} style={{ width: size, height: size }} contentFit="cover" accessible={false} />
        </Pressable>
      ))}
    </View>
  );
}

function EventsList({ profile }: { profile: Profile }) {
  const items = timelineItems(profile);
  const timeline = { pathname: "/pandas/[slug]/timeline" as const, params: { slug: profile.slug } };
  return (
    <View className="gap-3">
      {items.length > 0 ? (
        <View className="bg-card px-4 py-3.5" style={{ borderRadius: RADIUS.tile, borderCurve: "continuous" }}>
          <Timeline items={items} />
        </View>
      ) : null}
      <ListSection>
        <ListCell icon={History} label="时间线" href={timeline} last={items.length > 0} />
        {items.length === 0 ? (
          <ListCell label="知道它的经历？告诉我们" tone="tint" onPress={() => correct(profile.slug)} last />
        ) : null}
      </ListSection>
    </View>
  );
}

function Memories({ profile }: { profile: Profile }) {
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

/** Sources a fan sees before asking for the rest; a long list would bury the actions below it. */
const SOURCES_SHOWN = 5;

function Sources({ sources }: { sources: Profile["sources"] }) {
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

function NoPhoto({ profile }: { profile: Profile }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 64 }} className="px-4">
      <ListSection>
        <ListCell label="暂无照片" />
        <ListCell label="有它的照片？告诉我们" tone="tint" onPress={() => correct(profile.slug)} last />
      </ListSection>
    </View>
  );
}

type Tab = "overview" | "family" | "photos" | "events";
const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "概况" },
  { value: "family", label: "家族" },
  { value: "photos", label: "照片" },
  { value: "events", label: "动态" },
];

/** Alive and confirmed: a solid dot with a soft ring. Still being checked: the hollow dot. */
function LifeDot({ profile }: { profile: Profile }) {
  if (profile.deceased || !profile.certainty.life) return null;
  if (profile.certainty.life === "pending") return <PendingDot />;
  const size = component.statusDot + 2;
  return (
    <View
      aria-hidden
      accessible={false}
      className="rounded-pill border-highlight-soft bg-graphic"
      style={{ width: size + 6, height: size + 6, borderWidth: 3 }}
    />
  );
}

function lifeWords(profile: Profile) {
  if (profile.deceased || !profile.certainty.life) return "";
  return profile.certainty.life === "pending" ? "，在世，待核实" : "，在世";
}

export default function ProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: profile, isError: failed, refetch } = useQuery(profileQueryOptions(slug));
  const { scrollY, onScroll, pastHero } = useHeroScroll(HERO);
  const [tab, setTab] = useState<Tab>("overview");
  const page = String(useCSSVariable("--color-background"));

  if (!profile) {
    return (
      <View className="flex-1 bg-background">
        <HeroHeader title="" pastHero={false} />
        {failed ? (
          <View className="px-4 pt-28">
            <LoadFailed message="资料暂时打不开。" onRetry={() => void refetch()} />
          </View>
        ) : (
          <View className="gap-4" accessibilityLabel="正在加载资料">
            <Skeleton className="h-96 w-full rounded-none" />
            <View className="gap-4 px-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-12 w-full rounded-pill" />
              <View className="flex-row gap-2.5">
                {[0, 1, 2].map((key) => (
                  <Skeleton key={key} className="h-24 flex-1 rounded-tile" />
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  const cover = profile.photos[0];
  const share = () => router.push({ pathname: "/pandas/[slug]/share", params: { slug: profile.slug } });
  const sexIcon = profile.sex === "male" ? Mars : profile.sex === "female" ? Venus : null;
  return (
    <View className="flex-1 bg-background">
      <HeroHeader
        title={profile.name}
        pastHero={pastHero}
        menu={[
          {
            label: "加入合集",
            icon: FolderHeart,
            onPress: () => router.push({ pathname: "/pandas/[slug]/collect", params: { slug: profile.slug } }),
          },
          { label: "资料有误", icon: Flag, onPress: () => correct(profile.slug) },
        ]}
      />
      <Animated.ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="pb-16"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {cover ? (
          <StretchyHero
            url={cover.url}
            height={HERO}
            scrollY={scrollY}
            label={`查看${profile.name}的照片，共 ${profile.photos.length} 张`}
            onPress={() => router.push({ pathname: "/pandas/[slug]/photos", params: { slug: profile.slug } })}
            overlay={<HeroFade id={`hero-${profile.id}`} page={page} />}
          />
        ) : (
          <NoPhoto profile={profile} />
        )}
        <Animated.View entering={PAGE_ENTER} className="gap-4 px-4" style={cover ? { marginTop: -OVERLAP } : undefined}>
          <View>
            <View className="flex-row items-center gap-2">
              {/* The display variant is the page heading; the dot's words ride on it for screen readers. */}
              <Text variant="display" className="shrink" accessibilityLabel={`${profile.name}${lifeWords(profile)}`}>
                {profile.name}
              </Text>
              <LifeDot profile={profile} />
            </View>
            {profile.nameEn || sexIcon ? (
              <View
                className="flex-row items-center gap-1.5"
                accessible
                accessibilityLabel={`${profile.nameEn ?? ""}${profile.sex === "male" ? "，雄性" : profile.sex === "female" ? "，雌性" : ""}`}
              >
                {profile.nameEn ? (
                  <Text variant="subheadline" className="text-muted-foreground">
                    {profile.nameEn}
                  </Text>
                ) : null}
                {sexIcon ? <Icon icon={sexIcon} size="footnote" tone="tint" strokeWidth={2.4} /> : null}
              </View>
            ) : null}
          </View>
          <PandaActions pandaId={profile.id} name={profile.name} onShare={share} deceased={profile.deceased} />
          <Stats profile={profile} />
          <View className="pt-0.5">
            <Segmented value={tab} options={TABS} onChange={setTab} accessibilityLabel="资料分区" />
          </View>
          {tab === "overview" ? (
            <View className="gap-3">
              <KeyRows profile={profile} />
              <Recent profile={profile} />
              <CompareRows slug={profile.slug} />
              {profile.memories.length > 0 ? <Memories profile={profile} /> : null}
              {profile.sources.length > 0 ? <Sources sources={profile.sources} /> : null}
              {cover?.credit ? (
                <Text variant="footnote" className="px-4 text-muted-foreground">
                  {`封面照片：${cover.credit}`}
                </Text>
              ) : null}
            </View>
          ) : tab === "family" ? (
            <FamilyList profile={profile} />
          ) : tab === "photos" ? (
            <PhotoGrid profile={profile} />
          ) : (
            <EventsList profile={profile} />
          )}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
