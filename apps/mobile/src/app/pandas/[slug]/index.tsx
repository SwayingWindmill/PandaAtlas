import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { LoadFailed } from "@/components/load-failed";
import { BackButton } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PandaActions } from "@/features/engagement/panda-actions";
import { relativesOf } from "@/features/family/family";
import { openPanda } from "@/features/pandas/panda-row";
import { type Profile, loadProfile, longDate } from "@/features/pandas/profile";
import { cn } from "@/lib/utils";

function ShareButton({ profile, className }: { profile: Profile; className?: string }) {
  const ink = String(useCSSVariable("--color-foreground"));
  return (
    <Button
      variant="secondary"
      size="icon"
      className={className}
      accessibilityLabel="分享"
      onPress={() => router.push({ pathname: "/pandas/[slug]/share", params: { slug: profile.slug } })}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round">
        <Path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />
      </Svg>
    </Button>
  );
}

function Facts({ facts }: { facts: Profile["facts"] }) {
  // Two facts per row, the way an infobox reads.
  const rows: Profile["facts"][] = [];
  for (let index = 0; index < facts.length; index += 2) rows.push(facts.slice(index, index + 2));
  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={row.map((fact) => fact.label).join("/")} className="flex-row gap-5">
          {[0, 1].map((column) => {
            const fact = row[column];
            return (
              <View
                key={column}
                className={cn(
                  "flex-1 py-2.5",
                  fact && "border-t-hairline border-border",
                  fact && rowIndex === rows.length - 1 && "border-b-hairline",
                )}
              >
                {fact ? (
                  <>
                    <Text variant="muted">{fact.label}</Text>
                    <Text className="font-bold">{fact.value}</Text>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Events({ events }: { events: Profile["events"] }) {
  return (
    <View className="gap-3">
      <Text variant="h2">经历</Text>
      <View className="gap-2.5">
        {events.map((event) => (
          <View key={event.id} className="flex-row">
            <Text className="w-18 font-bold">{event.date}</Text>
            <Text className="flex-1">{event.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Relatives({ profile }: { profile: Profile }) {
  const relatives = profile.family ? relativesOf(profile.family) : [];
  if (relatives.length === 0) return null;
  return (
    <View className="gap-3">
      <Text variant="h2">家人</Text>
      <View className="flex-row flex-wrap gap-2">
        {relatives.map((member) => (
          <Pressable
            key={member.id}
            onPress={() => openPanda(member.slug)}
            role="button"
            accessibilityLabel={`${member.name}，${member.relation}`}
            className="h-11 flex-row items-center gap-2 rounded-full bg-secondary px-4 active:bg-accent"
          >
            <Text className="font-bold">{member.name}</Text>
            <Text variant="muted">{member.relation}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="outline"
          onPress={() => router.push({ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } })}
        >
          <Text>看家谱</Text>
        </Button>
        <Button variant="outline" onPress={() => router.push({ pathname: "/relationship", params: { from: profile.slug } })}>
          <Text>查关系</Text>
        </Button>
      </View>
    </View>
  );
}

function Visit({ visit }: { visit: NonNullable<Profile["visit"]> }) {
  return (
    <View className="gap-3 rounded-lg border-hairline border-border p-4">
      <Text variant="h2">去看它</Text>
      <View>
        <Text className="font-bold">{visit.place}</Text>
        {visit.address ? <Text variant="muted">{visit.address}</Text> : null}
      </View>
      <Button
        variant="secondary"
        className="self-start"
        onPress={() => router.push({ pathname: "/institutions/[slug]", params: { slug: visit.institutionSlug } })}
      >
        <Text>参观指南</Text>
      </Button>
    </View>
  );
}

function Sources({ sources }: { sources: Profile["sources"] }) {
  return (
    <View className="gap-3">
      <Text variant="h2">资料来源</Text>
      <View>
        {sources.map((source, index) => (
          <Pressable
            key={source.id}
            onPress={() => void WebBrowser.openBrowserAsync(source.url)}
            role="link"
            accessibilityLabel={`${source.publisher}，${source.title}`}
            accessibilityHint="在浏览器中打开"
            className={cn(
              "gap-0.5 border-t-hairline border-border py-3 active:bg-accent",
              index === sources.length - 1 && "border-b-hairline",
            )}
          >
            <Text className="font-bold" numberOfLines={2}>
              {source.title}
            </Text>
            <Text variant="muted" numberOfLines={1}>
              {source.publisher}　核实于 {longDate(source.lastVerifiedOn)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const muted = useCSSVariable("--color-muted");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);

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

  const top = { top: insets.top + 8 };
  const cover = profile?.photos[0];

  if (!profile) {
    return (
      <View className="flex-1 bg-background px-5" style={{ paddingTop: insets.top + 12 }}>
        <BackButton />
        {failed ? (
          <LoadFailed message="资料暂时打不开。" onRetry={retry} className="mt-6" />
        ) : (
          <View className="mt-6 gap-4" accessibilityLabel="正在加载资料">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-12">
      {cover ? (
        <View>
          <Pressable
            onPress={() => router.push({ pathname: "/pandas/[slug]/photos", params: { slug: profile.slug } })}
            role="button"
            accessibilityLabel={`查看${profile.name}的照片，共 ${profile.photos.length} 张`}
          >
            <Image
              source={cover.url}
              style={{ width: "100%", height: 380, backgroundColor: String(muted) }}
              contentFit="cover"
              accessible={false}
            />
            {profile.photos.length > 1 ? (
              <View className="absolute right-4 bottom-4 rounded-full bg-background px-3 py-1">
                <Text variant="small">共 {profile.photos.length} 张</Text>
              </View>
            ) : null}
          </Pressable>
          <View className="absolute inset-x-4 flex-row justify-between" style={top}>
            <BackButton className="bg-background" />
            <ShareButton profile={profile} className="bg-background" />
          </View>
          {cover.credit ? (
            <Text variant="muted" className="px-5 pt-2" numberOfLines={1}>
              {cover.credit}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="flex-row justify-between px-5" style={{ paddingTop: insets.top + 12 }}>
          <BackButton />
          <ShareButton profile={profile} />
        </View>
      )}

      <View className="gap-7 px-5 pt-6">
        <Text variant="h1">{profile.name}</Text>
        {profile.deceased ? null : <PandaActions pandaId={profile.id} name={profile.name} />}
        <Button
          variant="secondary"
          className="self-start"
          onPress={() => router.push({ pathname: "/pandas/[slug]/collect", params: { slug: profile.slug } })}
        >
          <Text>加入合集</Text>
        </Button>
        {profile.facts.length > 0 ? <Facts facts={profile.facts} /> : null}
        {profile.events.length > 0 ? <Events events={profile.events} /> : null}
        <Relatives profile={profile} />
        {profile.visit ? <Visit visit={profile.visit} /> : null}
        {profile.sources.length > 0 ? <Sources sources={profile.sources} /> : null}
        <Button
          variant="outline"
          className="self-start"
          onPress={() => router.push({ pathname: "/pandas/[slug]/correct", params: { slug: profile.slug } })}
        >
          <Text>资料有误？纠错</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
