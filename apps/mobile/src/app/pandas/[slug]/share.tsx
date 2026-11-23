import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { Copy, Heart, Link, type LucideIcon, Share } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { QrCode } from "@/components/qr-code";
import { Segmented } from "@/components/segmented";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  BIRTHDAY_CARD_STYLES,
  BirthdayCard,
  type BirthdayCardData,
  type BirthdayCardStyle,
} from "@/features/birthdays/birthday-card";
import { nextBirthday } from "@/features/birthdays/birthday-week";
import { localToday } from "@/features/engagement/seen";
import { type Profile, loadProfile } from "@/features/pandas/profile";
import { component } from "@/design/tokens";
import { copyLink, profileUrl, shareCardImage, shareLink } from "@/features/pandas/share-card";

const SC = component.shareCard;

/** A name this long no longer fits the display size on two lines. */
const LONG_NAME = 8;

/** The image a fan shares: photo, name, the key facts, and a QR code that opens the panda's page. */
function Card({ profile, cardRef }: { profile: Profile; cardRef: RefObject<ComponentRef<typeof View> | null> }) {
  const muted = String(useCSSVariable("--color-muted"));
  const cover = profile.photos[0];
  const longName = [...profile.name].length > LONG_NAME;
  return (
    <View
      ref={cardRef}
      collapsable={false}
      accessibilityLabel={`${profile.name}的分享卡片`}
      className="overflow-hidden rounded-tile border-hairline border-border bg-card"
    >
      {cover ? (
        <Image
          source={cover.url}
          style={{ width: "100%", aspectRatio: 4 / 3, backgroundColor: muted }}
          contentFit="cover"
          accessible={false}
        />
      ) : (
        <View className="justify-end bg-secondary px-5" style={{ height: SC.coverlessBand }} accessible={false}>
          <Text
            allowFontScaling={false}
            className="font-extrabold text-tertiary-foreground"
            style={{ fontSize: SC.monogram.size, lineHeight: SC.monogram.lineHeight }}
          >
            {[...profile.name][0]}
          </Text>
        </View>
      )}
      <View className="gap-3 p-5">
        <Text
          variant="display"
          numberOfLines={2}
          style={longName ? { fontSize: SC.longName.size, lineHeight: SC.longName.lineHeight } : undefined}
        >
          {profile.name}
        </Text>
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
          <Text variant="footnote" numberOfLines={2} className="text-muted-foreground">
            {cover.credit}
          </Text>
        ) : null}
        <View className="flex-row items-center justify-between gap-4 border-t-hairline border-border pt-3">
          <View className="shrink">
            <Text className="font-bold">吱熊猫</Text>
            <Text variant="footnote" numberOfLines={1} className="text-muted-foreground">
              扫码看{profile.name}的家谱、照片和近况
            </Text>
          </View>
          <QrCode value={profileUrl(profile.slug)} size={SC.qr} />
        </View>
      </View>
    </View>
  );
}

/** One of the 生日卡's actions: a glyph over its word, as the share sheet's row reads. */
function Action({ icon, label, onPress, disabled }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      role="button"
      onPress={onPress}
      disabled={disabled}
      className="min-w-16 items-center gap-1.5 py-1 active:opacity-60"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <Icon icon={icon} size="title3" tone="label" />
      <Text variant="footnote" className="font-semibold">
        {label}
      </Text>
    </Pressable>
  );
}

/** The 生日卡 for a living panda with a full birth date; null otherwise, and the ordinary card shows. */
function birthdayCardOf(profile: Profile): BirthdayCardData | null {
  if (profile.deceased || !profile.birthDate) return null;
  const next = nextBirthday(profile.birthDate, localToday());
  if (!next || next.age < 1) return null;
  const cover = profile.photos[0];
  return {
    name: profile.name,
    nameEn: profile.nameEn,
    birthDate: profile.birthDate,
    place: profile.visit?.place ?? null,
    sex: profile.sex,
    url: profileUrl(profile.slug),
    ...next,
    photo: cover ? { url: cover.url, credit: cover.credit } : null,
  };
}

export default function ShareScreen() {
  const { slug, birthday: birthdayParam, look: lookParam } = useLocalSearchParams<{ slug: string; birthday?: string; look?: string }>();
  // Only a whole age from 生日周 asks for a 生日卡; anything else shows the ordinary card.
  const wantsBirthday = Boolean(birthdayParam && /^[1-9]\d?$/.test(birthdayParam));
  const [look, setLook] = useState<BirthdayCardStyle>(
    BIRTHDAY_CARD_STYLES.find((option) => option.value === lookParam)?.value ?? "cover",
  );
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

  const birthday = wantsBirthday && profile ? birthdayCardOf(profile) : null;
  const { toast, show } = useToast();

  async function copy(name: string, slug: string) {
    try {
      await copyLink(name, slug);
      show("链接已复制");
    } catch {
      // No toast: the link was not copied.
    }
  }

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
    <>
    <Page label={wantsBirthday ? undefined : "分享"} title={wantsBirthday ? "生日卡" : "分享这只熊猫"}>
      {failed ? (
        <LoadFailed message="资料暂时打不开。" onRetry={() => { setFailed(false); load(); }} />
      ) : !profile ? (
        <Skeleton className="h-96 w-full" accessibilityLabel="正在加载" />
      ) : (
        <>
          {birthday ? (
            <>
              <Segmented value={look} options={BIRTHDAY_CARD_STYLES} onChange={setLook} accessibilityLabel="生日卡样式" />
              <View className="px-6">
                <BirthdayCard card={birthday} look={look} cardRef={card} />
              </View>
              <View className="flex-row justify-center gap-section">
                <Action icon={Share} label="分享" onPress={() => void shareImage()} disabled={status === "sharing"} />
                <Action icon={Copy} label="复制链接" onPress={() => void copy(profile.name, profile.slug)} />
                <Action icon={Link} label="分享链接" onPress={() => void shareLink(profile.name, profile.slug).catch(() => undefined)} />
              </View>
              <Button size="lg" className="rounded-pill" onPress={() => router.push({ pathname: "/pandas/[slug]", params: { slug: profile.slug } })}>
                <Icon icon={Heart} size="body" tone="onButton" />
                <Text>看看{profile.name}</Text>
              </Button>
            </>
          ) : (
            <Card profile={profile} cardRef={card} />
          )}
          {birthday ? null : <View className="gap-2">
            <Button onPress={() => void shareImage()} disabled={status === "sharing"}>
              <Text>分享图片</Text>
            </Button>
            <View className="flex-row gap-2">
              <Button variant="secondary" className="flex-1" onPress={() => void copy(profile.name, profile.slug)}>
                <Text>复制链接</Text>
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => void shareLink(profile.name, profile.slug).catch(() => undefined)}
              >
                <Text>分享链接</Text>
              </Button>
            </View>
          </View>}
          {status === "failed" ? <Text className="text-destructive">没能生成图片，请再试一次。</Text> : null}
        </>
      )}
    </Page>
    {toast}
    </>
  );
}
