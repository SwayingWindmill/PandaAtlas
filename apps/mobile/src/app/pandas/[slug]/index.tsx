import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { BackButton } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { relativesOf } from "@/features/family/family";
import { openPanda } from "@/features/pandas/panda-row";
import { type Profile, loadProfile } from "@/features/pandas/profile";
import { cn } from "@/lib/utils";

const WEBSITE = "https://www.zhipanda.com/zh/pandas";

function ShareButton({ profile, className }: { profile: Profile; className?: string }) {
  const ink = String(useCSSVariable("--color-foreground"));
  return (
    <Button
      variant="secondary"
      size="icon"
      className={className}
      accessibilityLabel="分享"
      onPress={() => void Share.share({ message: `${profile.name} ${WEBSITE}/${profile.slug}` })}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round">
        <Path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />
      </Svg>
    </Button>
  );
}

function Facts({ facts }: { facts: Profile["facts"] }) {
  const rows = facts.reduce<Profile["facts"][]>((pairs, fact, index) => {
    if (index % 2 === 0) pairs.push([fact]);
    else pairs[pairs.length - 1].push(fact);
    return pairs;
  }, []);
  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={row[0].label} className="flex-row gap-5">
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
      <Button
        variant="outline"
        className="self-start"
        onPress={() => router.push({ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } })}
      >
        <Text>看家谱</Text>
      </Button>
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

  if (!profile) {
    return (
      <View className="flex-1 bg-background px-5" style={{ paddingTop: insets.top + 12 }}>
        <BackButton />
        {failed ? (
          <View className="mt-6 items-start gap-3 rounded-lg bg-muted p-5">
            <Text>资料暂时打不开。</Text>
            <Button onPress={retry}>
              <Text>重试</Text>
            </Button>
          </View>
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
      {profile.photo ? (
        <View>
          <Image
            source={profile.photo.url}
            style={{ width: "100%", height: 380, backgroundColor: String(muted) }}
            contentFit="cover"
            accessibilityLabel={`${profile.name}的照片`}
          />
          <View className="absolute inset-x-4 flex-row justify-between" style={top}>
            <BackButton className="bg-background" />
            <ShareButton profile={profile} className="bg-background" />
          </View>
          {profile.photo.credit ? (
            <Text variant="muted" className="px-5 pt-2" numberOfLines={1}>
              {profile.photo.credit}
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
        {profile.facts.length > 0 ? <Facts facts={profile.facts} /> : null}
        {profile.events.length > 0 ? <Events events={profile.events} /> : null}
        <Relatives profile={profile} />
      </View>
    </ScrollView>
  );
}
