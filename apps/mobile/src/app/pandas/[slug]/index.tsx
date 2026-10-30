import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chevron, ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  Cake,
  CircleQuestionMark,
  Flower,
  Hourglass,
  House,
  type LucideIcon,
  Mars,
  Network,
  Users,
  Venus,
  Waypoints,
} from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { CONTENT_ENTER, HeroToolbar, StretchyHero } from "@/components/stretchy-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PandaActions } from "@/features/engagement/panda-actions";
import { type FamilyMember, relativesOf } from "@/features/family/family";
import { openPanda } from "@/features/pandas/panda-row";
import { type Profile, loadProfile, longDate } from "@/features/pandas/profile";
import { type Stat, UNKNOWN } from "@/features/pandas/profile-facts";
import { RADIUS } from "@/lib/surface";

/** Hero height below the status bar. The photo runs under the status bar too. */
const HERO = 340;

function correct(slug: string) {
  router.push({ pathname: "/pandas/[slug]/correct", params: { slug } });
}

/** A section's footnote header, aligned with the text inside the group below it. */
function SectionHeader({ children }: { children: string }) {
  return (
    <Text variant="footnote" role="heading" className="px-4 text-muted-foreground">
      {children}
    </Text>
  );
}

/** The glyph beside each stat's label. 性别 shows the sex itself, so it reads at a glance. */
function statIcon(stat: Stat, deceased: boolean): LucideIcon {
  if (stat.key === "sex") return stat.value === "雄" ? Mars : stat.value === "雌" ? Venus : CircleQuestionMark;
  if (stat.key === "age") return deceased ? Hourglass : Cake;
  return deceased ? Flower : House;
}

/** How much of the row each block takes: the place needs room for a zoo's name. */
const STAT_FLEX: Record<Stat["key"], number> = { sex: 1, age: 1.25, place: 1.9 };
/** Below this width three tiles leave the sex tile too narrow for its label, so the place takes its own row. */
const STAT_ROW_MIN_WIDTH = 360;

function StatBlock({
  stat,
  deceased,
  onPress,
  stacked,
  wrapped,
}: {
  stat: Stat;
  deceased: boolean;
  onPress?: () => void;
  stacked: boolean;
  wrapped: boolean;
}) {
  const body = (
    <View
      className="gap-1 bg-card p-3"
      style={{ flex: 1, borderRadius: RADIUS.tile, borderCurve: "continuous", minHeight: 96 }}
    >
      <View className="flex-row items-center gap-1">
        <Icon icon={statIcon(stat, deceased)} size="footnote" tone="secondary" />
        <Text variant="footnote" className="flex-1 text-muted-foreground" numberOfLines={1}>
          {stat.label}
        </Text>
        {onPress ? <Chevron /> : null}
      </View>
      <Text variant="stat" numberOfLines={stacked ? undefined : 2}>
        {stat.value}
      </Text>
      {stat.detail ? (
        <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
          {stat.detail}
        </Text>
      ) : null}
    </View>
  );
  const style = stacked
    ? undefined
    : wrapped && stat.key === "place"
      ? { flexBasis: "100%" as const }
      : { flex: STAT_FLEX[stat.key] };
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={`${stat.label}，${stat.value}${stat.detail ? `，${stat.detail}` : ""}`}>
        {body}
      </View>
    );
  }
  return (
    <PressScale
      onPress={onPress}
      role="link"
      accessibilityLabel={`${stat.label}，${stat.value}，参观指南`}
      containerStyle={style}
      style={{ flex: 1 }}
    >
      {body}
    </PressScale>
  );
}

/** Sex, age and where it lives as three tiles, the way Health leads with its summary. */
function Stats({ profile }: { profile: Profile }) {
  const stacked = useStacked();
  const wrapped = useWindowDimensions().width < STAT_ROW_MIN_WIDTH;
  const visit = profile.visit;
  const fact = (label: string) => profile.facts.find((item) => item.label === label)?.value;
  const born = fact("出生");
  const birthPlace = fact("出生地");
  const birthLine =
    born && born !== UNKNOWN
      ? `${born}出生${birthPlace && birthPlace !== UNKNOWN ? `于${birthPlace}` : ""}`
      : null;
  return (
    <View className="gap-2">
    <View className={stacked ? "gap-2" : wrapped ? "flex-row flex-wrap gap-2" : "flex-row gap-2"}>
      {profile.stats.map((stat) => (
        <StatBlock
          key={stat.key}
          stat={stat}
          deceased={profile.deceased}
          stacked={stacked}
          wrapped={wrapped}
          onPress={
            stat.key === "place" && visit
              ? () => router.push({ pathname: "/institutions/[slug]", params: { slug: visit.institutionSlug } })
              : undefined
          }
        />
      ))}
    </View>
      {birthLine ? (
        <Text variant="footnote" className="px-1 text-muted-foreground">
          {birthLine}
        </Text>
      ) : null}
    </View>
  );
}

/** Avatar 44 inside a 52pt capsule with 4pt padding: the circles share a centre. */
const AVATAR = 44;
const CHIP_PAD = 4;

function FamilyChip({ member }: { member: FamilyMember }) {
  return (
    <PressScale onPress={() => openPanda(member.slug)} role="link" accessibilityLabel={`${member.name}，${member.relation}`}>
      <View
        className="flex-row items-center gap-2.5 bg-card"
        style={{ padding: CHIP_PAD, paddingRight: 16, borderRadius: (AVATAR + CHIP_PAD * 2) / 2, borderCurve: "continuous" }}
      >
        <View
          className="items-center justify-center overflow-hidden bg-muted"
          style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 }}
        >
          {member.photoUrl ? (
            <Image source={member.photoUrl} style={{ width: AVATAR, height: AVATAR }} contentFit="cover" accessible={false} />
          ) : (
            <Text variant="body" className="font-semibold text-muted-foreground">
              {member.name.slice(0, 1)}
            </Text>
          )}
          <PhotoOutline radius={AVATAR / 2} />
        </View>
        <View>
          <Text variant="body" className="font-semibold" numberOfLines={1}>
            {member.name}
          </Text>
          <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
            {member.relation}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}

function Family({ profile }: { profile: Profile }) {
  const relatives = profile.family ? relativesOf(profile.family) : [];
  const parents = profile.facts.find((fact) => fact.label === "父母");
  if (relatives.length === 0) {
    return (
      <ListSection title="家族">
        <ListCell icon={Users} label="父母" meta={parents?.value ?? UNKNOWN} last />
      </ListSection>
    );
  }
  return (
    <View className="gap-1.5">
      <SectionHeader>家族</SectionHeader>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerClassName="gap-2 px-4 pb-1.5"
      >
        {relatives.map((member) => (
          <FamilyChip key={member.id} member={member} />
        ))}
      </ScrollView>
      <ListSection>
        <ListCell icon={Network} label="看家谱" href={{ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } }} />
        <ListCell icon={Waypoints} label="查关系" href={{ pathname: "/relationship", params: { from: profile.slug } }} last />
      </ListSection>
    </View>
  );
}

/** Where it lived before. Where it lives now is the 所在地 tile, which opens the institution. */
function PlacesLived({ profile }: { profile: Profile }) {
  const past = profile.placesLived.filter((place) => !place.current);
  if (past.length === 0) return null;
  return (
    <ListSection title={profile.deceased ? "生活过的地方" : "以前住过"}>
      {past.map((place, index) => (
        <ListCell
          key={`${place.place}-${place.years}`}
          label={place.place}
          meta={place.years || undefined}
          last={index === past.length - 1}
        />
      ))}
    </ListSection>
  );
}

function Events({ profile }: { profile: Profile }) {
  // Newest first, the way a feed reads.
  const events = [...profile.events].reverse();
  return (
    <ListSection title="动态">
      {events.length === 0 ? (
        <>
          <ListCell label={UNKNOWN} />
          <ListCell label="知道它的经历？告诉我们" tone="tint" onPress={() => correct(profile.slug)} last />
        </>
      ) : (
        events.map((event, index) => (
          <ListCell key={event.id} label={event.text} meta={event.date} lines={3} last={index === events.length - 1} />
        ))
      )}
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
    <ListSection title="资料来源">
      {shown.map((source, index) => (
        <ListCell
          key={source.id}
          role="link"
          label={source.title}
          detail={`${source.publisher}　核实于 ${longDate(source.lastVerifiedOn)}`}
          accessibilityLabel={`${source.publisher}，${source.title}`}
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

export default function ProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  const load = useCallback(() => {
    loadProfile(slug)
      .then(setProfile)
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        {failed ? (
          <View className="px-4 pt-28">
            <LoadFailed message="资料暂时打不开。" onRetry={retry} />
          </View>
        ) : (
          <View className="gap-4" accessibilityLabel="正在加载资料">
            <Skeleton className="h-96 w-full rounded-none" />
            <View className="gap-3 px-4">
              <Skeleton className="h-10 w-32" />
              <View className="flex-row gap-2">
                <Skeleton className="h-24 rounded-tile" style={{ flex: STAT_FLEX.sex }} />
                <Skeleton className="h-24 rounded-tile" style={{ flex: STAT_FLEX.age }} />
                <Skeleton className="h-24 rounded-tile" style={{ flex: STAT_FLEX.place }} />
              </View>
            </View>
          </View>
        )}
        <HeroToolbar />
      </View>
    );
  }

  const cover = profile.photos[0];
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false, title: profile.name }} />
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
          />
        ) : (
          <NoPhoto profile={profile} />
        )}
        <Animated.View entering={CONTENT_ENTER} className="gap-7 bg-background px-4 pt-5">
          <View className="gap-3">
            <Text variant="display">{profile.name}</Text>
            {profile.deceased ? null : <PandaActions pandaId={profile.id} name={profile.name} />}
          </View>
          <Stats profile={profile} />
          <Family profile={profile} />
          <PlacesLived profile={profile} />
          <Events profile={profile} />
          {profile.sources.length > 0 ? <Sources sources={profile.sources} /> : null}
          <ListSection>
            <ListCell
              label="加入合集"
              tone="tint"
              onPress={() => router.push({ pathname: "/pandas/[slug]/collect", params: { slug: profile.slug } })}
            />
            <ListCell label="资料有误？纠错" tone="tint" onPress={() => correct(profile.slug)} last />
          </ListSection>
          {cover?.credit ? (
            <Text variant="footnote" className="px-4 text-muted-foreground">
              {`封面照片：${cover.credit}`}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>
      <HeroToolbar onShare={() => router.push({ pathname: "/pandas/[slug]/share", params: { slug: profile.slug } })} />
    </View>
  );
}
