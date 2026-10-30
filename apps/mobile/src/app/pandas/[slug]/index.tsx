import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { GlassButton } from "@/components/glass-button";
import { ListCell, ListSection } from "@/components/grouped-list";
import {
  Cake,
  ChevronLeft,
  CircleQuestionMark,
  Flower,
  Hourglass,
  House,
  Landmark,
  type LucideIcon,
  MapPin,
  Mars,
  Network,
  Share,
  Users,
  Venus,
  Waypoints,
} from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PandaActions } from "@/features/engagement/panda-actions";
import { relativesOf } from "@/features/family/family";
import { openPanda } from "@/features/pandas/panda-row";
import { type Profile, loadProfile, longDate } from "@/features/pandas/profile";
import { UNKNOWN } from "@/features/pandas/profile-facts";

/** Hero height below the status bar. The photo runs under the status bar too. */
const HERO = 340;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function correct(slug: string) {
  router.push({ pathname: "/pandas/[slug]/correct", params: { slug } });
}

/** The top bar over the photo: Liquid Glass back and share, fixed while the page scrolls. */
function Toolbar({ slug }: { slug?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      className="absolute right-0 left-0 flex-row justify-between px-4"
      style={{ top: insets.top + 6 }}
    >
      <GlassButton icon={ChevronLeft} label="返回" onPress={goBack} />
      {slug ? (
        <GlassButton
          icon={Share}
          label="分享"
          onPress={() => router.push({ pathname: "/pandas/[slug]/share", params: { slug } })}
        />
      ) : null}
    </View>
  );
}

/** "雄　史密森尼国家动物园": sex and where it lives now, or that it has died. */
function subtitleOf(profile: Profile): string {
  const fact = (label: string) => profile.facts.find((item) => item.label === label)?.value;
  const sex = fact("性别");
  const where = profile.deceased ? "已离世" : (profile.visit?.place ?? fact("所在地"));
  return [sex, where].filter((part) => part && part !== UNKNOWN).join("　");
}

function Hero({ profile, scrollY }: { profile: Profile; scrollY: { value: number } }) {
  const insets = useSafeAreaInsets();
  const muted = String(useCSSVariable("--color-muted"));
  const height = HERO + insets.top;
  const cover = profile.photos[0];
  // Pulling down stretches the photo from its bottom edge; scrolling up lets it drift a little slower.
  const stretch = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-height, 0, height], [-height / 2, 0, height * 0.35], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-height, 0], [2, 1], Extrapolation.CLAMP) },
    ],
  }));

  if (!cover) {
    return (
      <View style={{ paddingTop: insets.top + 64 }} className="px-4">
        <ListSection>
          <ListCell label="暂无照片" />
          <ListCell label="有它的照片？告诉我们" tone="tint" onPress={() => correct(profile.slug)} last />
        </ListSection>
      </View>
    );
  }
  return (
    <View style={{ height, overflow: Platform.OS === "web" ? "hidden" : "visible" }}>
      <Animated.View style={[{ height, backgroundColor: muted }, stretch]}>
        <Pressable
          onPress={() => router.push({ pathname: "/pandas/[slug]/photos", params: { slug: profile.slug } })}
          role="button"
          accessibilityLabel={`查看${profile.name}的照片，共 ${profile.photos.length} 张`}
          style={{ flex: 1 }}
        >
          <Image source={cover.url} style={{ flex: 1 }} contentFit="cover" accessible={false} transition={200} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** The glyph for each 基本信息 fact. 性别 shows the sex itself, so the row reads at a glance. */
function factIcon(label: string, value: string): LucideIcon {
  if (label === "性别") return value === "雄" ? Mars : value === "雌" ? Venus : CircleQuestionMark;
  const icons: Record<string, LucideIcon> = {
    出生: Cake,
    出生地: MapPin,
    离世: Flower,
    享年: Hourglass,
    所在地: House,
  };
  return icons[label] ?? CircleQuestionMark;
}

function Basics({ profile }: { profile: Profile }) {
  const rows = profile.facts.filter((fact) => fact.label !== "父母");
  return (
    <ListSection title="基本信息">
      {rows.map((fact, index) => (
        <ListCell
          key={fact.label}
          icon={factIcon(fact.label, fact.value)}
          label={fact.label}
          meta={fact.value}
          last={index === rows.length - 1}
        />
      ))}
    </ListSection>
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
    <ListSection title="家族">
      {relatives.map((member) => (
        <ListCell
          key={member.id}
          label={member.name}
          meta={member.relation}
          accessibilityLabel={`${member.name}，${member.relation}`}
          onPress={() => openPanda(member.slug)}
        />
      ))}
      <ListCell icon={Network} label="看家谱" href={{ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } }} />
      <ListCell icon={Waypoints} label="查关系" href={{ pathname: "/relationship", params: { from: profile.slug } }} last />
    </ListSection>
  );
}

function Institution({ profile }: { profile: Profile }) {
  const past = profile.placesLived.filter((place) => !place.current);
  if (!profile.visit && past.length === 0) return null;
  return (
    <ListSection title={profile.deceased ? "生活过的地方" : "所在机构"}>
      {profile.visit ? (
        <ListCell
          icon={Landmark}
          label={profile.visit.place}
          detail={profile.visit.address ?? "参观指南"}
          href={{ pathname: "/institutions/[slug]", params: { slug: profile.visit.institutionSlug } }}
          last={past.length === 0}
        />
      ) : null}
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

export default function ProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
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
              <Skeleton className="h-5 w-48" />
            </View>
          </View>
        )}
        <Toolbar />
      </View>
    );
  }

  const subtitle = subtitleOf(profile);
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
        <Hero profile={profile} scrollY={scrollY} />
        <View className="gap-7 bg-background px-4 pt-5">
          <View className="gap-3">
            <View className="gap-0.5">
              <Text variant="largeTitle">{profile.name}</Text>
              {subtitle ? (
                <Text variant="subhead" className="text-muted-foreground">
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {profile.deceased ? null : <PandaActions pandaId={profile.id} name={profile.name} />}
          </View>
          <Basics profile={profile} />
          <Family profile={profile} />
          <Institution profile={profile} />
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
          {profile.photos[0]?.credit ? (
            <Text variant="footnote" className="px-4 text-muted-foreground">
              {`封面照片：${profile.photos[0].credit}`}
            </Text>
          ) : null}
        </View>
      </Animated.ScrollView>
      <Toolbar slug={profile.slug} />
    </View>
  );
}
