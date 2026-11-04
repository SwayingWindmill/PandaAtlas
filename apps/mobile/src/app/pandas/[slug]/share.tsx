import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { type ComponentRef, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { Cake } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { openPanda } from "@/features/pandas/panda-row";
import { type Profile, loadProfile } from "@/features/pandas/profile";
import { profileUrl, shareCardImage, shareLink } from "@/features/pandas/share-card";

/** The image a fan shares: photo, name, the key facts and where to read more. */
function Card({
  profile,
  cardRef,
  birthday,
}: {
  profile: Profile;
  cardRef: RefObject<ComponentRef<typeof View> | null>;
  /** The age it turns, for 生日卡; the card then leads with the birthday instead of the facts. */
  birthday: number | null;
}) {
  const muted = String(useCSSVariable("--color-muted"));
  const cover = profile.photos[0];
  return (
    <View
      ref={cardRef}
      collapsable={false}
      accessibilityLabel={birthday ? `${profile.name} ${birthday} 岁生日卡` : `${profile.name}的分享卡片`}
      className="overflow-hidden rounded-tile border-hairline border-border bg-card"
    >
      {cover ? (
        <Image
          source={cover.url}
          style={{ width: "100%", aspectRatio: 4 / 3, backgroundColor: muted }}
          contentFit="cover"
          accessible={false}
        />
      ) : null}
      <View className="gap-3 p-5">
        {birthday ? (
          <View className="flex-row items-center gap-stack-tight">
            <Icon icon={Cake} size="body" tone="tint" />
            <Text variant="headline">{`${birthday} 岁生日快乐`}</Text>
          </View>
        ) : null}
        <Text variant="display">{profile.name}</Text>
        <View className="flex-row flex-wrap gap-x-5 gap-y-2">
          {profile.facts.map((fact) => (
            <View key={fact.label}>
              <Text variant="footnote" className="text-muted-foreground">
                {fact.label}
              </Text>
              <Text className="font-bold">{fact.value}</Text>
            </View>
          ))}
        </View>
        {cover?.credit ? (
          <Text variant="footnote" className="text-muted-foreground">
            {cover.credit}
          </Text>
        ) : null}
        <View className="border-t-hairline border-border pt-3">
          <Text className="font-bold">吱熊猫</Text>
          <Text variant="footnote" className="text-muted-foreground">
            {profileUrl(profile.slug).replace("https://", "")}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ShareScreen() {
  const { slug, birthday: birthdayParam } = useLocalSearchParams<{ slug: string; birthday?: string }>();
  // Only a whole age from 生日周 makes a 生日卡; anything else shows the ordinary card.
  const birthday = birthdayParam && /^[1-9]\d?$/.test(birthdayParam) ? Number(birthdayParam) : null;
  const card = useRef<ComponentRef<typeof View>>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sharing" | "failed">("idle");

  const load = useCallback(() => {
    loadProfile(slug)
      .then(setProfile)
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  async function shareImage() {
    setStatus("sharing");
    try {
      await shareCardImage(card, slug);
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <Page label="分享" title={birthday ? "生日卡" : "分享这只熊猫"}>
      {failed ? (
        <LoadFailed message="资料暂时打不开。" onRetry={() => { setFailed(false); load(); }} />
      ) : !profile ? (
        <Skeleton className="h-96 w-full" accessibilityLabel="正在加载" />
      ) : (
        <>
          <Card profile={profile} cardRef={card} birthday={birthday} />
          <View className="flex-row flex-wrap gap-2">
            <Button onPress={() => void shareImage()} disabled={status === "sharing"}>
              <Text>分享图片</Text>
            </Button>
            <Button
              variant="secondary"
              onPress={() => void shareLink(profile.name, profile.slug).catch(() => undefined)}
            >
              <Text>分享链接</Text>
            </Button>
            {birthday ? (
              <Button variant="secondary" onPress={() => openPanda(profile.slug)}>
                <Text>看资料</Text>
              </Button>
            ) : null}
          </View>
          {status === "failed" ? <Text className="text-destructive">没能生成图片，请再试一次。</Text> : null}
        </>
      )}
    </Page>
  );
}
