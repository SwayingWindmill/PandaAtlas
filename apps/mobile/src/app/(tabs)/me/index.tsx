import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Bell, FolderHeart, LayoutGrid, MapPin, PawPrint, Settings } from "@/components/icons";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { statusLabel } from "@/features/corrections/correction";
import { type ContributionRecord, loadMyContributions } from "@/features/corrections/submissions";
import { useFollowed } from "@/features/engagement/favorites";
import { localToday, shortDay } from "@/features/engagement/seen";
import { loadInbox } from "@/features/notifications/inbox";
import { unreadCount } from "@/features/notifications/notifications";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { ProfileAvatar } from "@/features/profile/avatar";
import { NICKNAME_MAX, displayName, useProfile } from "@/features/profile/profile";
import { useSession } from "@/features/session/session";
import { PandaAvatar } from "@/features/today/followed-strip";
import { StoryPhotoTile } from "@/features/today/story-photo-tile";
import { type StoryPhoto, useStoryPhotos } from "@/features/today/story-photos";
import { successHaptic } from "@/lib/haptics";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

const AVATAR = 72;

/** The round 设置 button in the corner of the profile card, as Music and the App Store put the account. */
function SettingsButton() {
  return (
    <Pressable
      onPress={() => router.push("/settings")}
      role="button"
      accessibilityLabel="设置"
      className="absolute right-row top-row size-11 items-center justify-center rounded-full bg-secondary active:opacity-70"
    >
      <Icon icon={Settings} size="subhead" tone="label" />
    </Pressable>
  );
}

function ProfileCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="gap-stack rounded-card bg-card p-stack" style={{ borderCurve: "continuous" }}>
      {children}
      <SettingsButton />
    </View>
  );
}

/** Photos in the signed-out card, then the 今天的熊猫 strip under it. */
const COLLAGE = 3;
const STRIP = 6;
const STRIP_TILE = 128;
const COLLAGE_HEIGHT = 196;

function CollagePhoto({ photo, style }: { photo: StoryPhoto | undefined; style: object }) {
  return (
    <View className="overflow-hidden bg-secondary" style={style}>
      {photo ? (
        <Image source={photo.url} style={{ flex: 1 }} contentFit="cover" transition={200} accessible={false} />
      ) : null}
    </View>
  );
}

/**
 * Three of today's reviewed panda photos across the top of the signed-out card, one large and two
 * stacked, as the App Store fronts a story. Real pandas, named in the footnote under the title.
 */
function Collage({ photos }: { photos: StoryPhoto[] }) {
  return (
    <View className="flex-row gap-hair-gap" style={{ height: COLLAGE_HEIGHT }} accessible={false}>
      <CollagePhoto photo={photos[0]} style={{ flex: 3 }} />
      <View className="gap-hair-gap" style={{ flex: 2 }}>
        <CollagePhoto photo={photos[1]} style={{ flex: 1 }} />
        <CollagePhoto photo={photos[2]} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function SignedOut() {
  const photos = useStoryPhotos(localToday(), COLLAGE + STRIP);
  const pictured = photos.slice(0, COLLAGE).map((photo) => photo.name);
  const strip = photos.slice(COLLAGE);
  return (
    <View className="gap-section">
      <View className="overflow-hidden rounded-card bg-card" style={{ borderCurve: "continuous" }}>
        <Collage photos={photos} />
        <View className="gap-stack p-stack">
          <View className="gap-hair-gap">
            <Text variant="title">把喜欢的熊猫留在身边</Text>
            <Text variant="subheadline" className="text-muted-foreground">
              登录后，关注的熊猫、图鉴和去过的地点都保存在你的账号里，换手机也不会丢。
            </Text>
            {pictured.length > 0 ? (
              <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                {`照片：${pictured.join("、")}`}
              </Text>
            ) : null}
          </View>
          <Button onPress={() => router.push("/sign-in")}>
            <Text>登录</Text>
          </Button>
        </View>
        <SettingsButton />
      </View>
      <ListSection title="登录后可以">
        <ListCell icon={PawPrint} label="关注熊猫" detail="在今天页第一时间看到它们的新动态" />
        <ListCell icon={LayoutGrid} label="点亮图鉴" detail="猜中每日一猫、去现场见过，都记进你的图鉴" />
        <ListCell icon={FolderHeart} label="收进合集" detail="把喜欢的熊猫按自己的方式分组" />
        <ListCell icon={MapPin} label="记下去过的地点" detail="去过的基地和动物园，一处不落" />
        <ListCell icon={Bell} label="收到通知" detail="关注的熊猫资料更新时告诉你" last />
      </ListSection>
      {strip.length > 0 ? (
        <View className="gap-row">
          <SectionHeader title="今天的熊猫" action={{ label: "找熊猫", href: "/find" }} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-inset"
            contentContainerClassName="gap-row px-inset"
          >
            {strip.map((photo) => (
              <StoryPhotoTile key={photo.pandaId} photo={photo} width={STRIP_TILE} slot={`me-${photo.pandaId}`} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function Profile({ email }: { email: string | null }) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const { profile, rename } = useProfile();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");

  async function save() {
    setStatus("saving");
    if (!(await rename(draft))) {
      setStatus("failed");
      return;
    }
    successHaptic();
    setEditing(false);
    setStatus("idle");
  }

  if (!profile) return <Skeleton className="h-44 w-full rounded-card" accessibilityLabel="正在加载" />;
  const name = displayName(profile, email);

  return (
    <ProfileCard>
      <ProfileAvatar name={name} size={AVATAR} />
      <View className="gap-hair-gap">
        <Text variant="title" numberOfLines={1}>
          {name}
        </Text>
        {email && email !== name ? (
          <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>
      {editing ? (
        <View className="gap-stack-tight">
          <TextInput
            value={draft}
            onChangeText={(value) => setDraft(value.slice(0, NICKNAME_MAX))}
            placeholder="名字"
            placeholderTextColor={muted}
            accessibilityLabel="名字"
            autoFocus
            maxFontSizeMultiplier={2}
            className="h-11 rounded-control bg-secondary px-row text-body text-foreground"
            style={{ borderCurve: "continuous" }}
          />
          <View className="flex-row gap-stack-tight">
            <Button size="sm" onPress={() => void save()} disabled={status === "saving" || draft.trim().length === 0}>
              <Text>保存</Text>
            </Button>
            <Button size="sm" variant="plain" onPress={() => setEditing(false)}>
              <Text>取消</Text>
            </Button>
          </View>
          {status === "failed" ? (
            <Text variant="footnote" className="text-destructive">
              没能保存，请再试一次。
            </Text>
          ) : null}
        </View>
      ) : (
        <Button
          variant="tinted"
          size="sm"
          className="self-start"
          onPress={() => {
            setDraft(profile.nickname);
            setEditing(true);
          }}
        >
          <Text>改名字</Text>
        </Button>
      )}
    </ProfileCard>
  );
}

function Following() {
  const followed = useFollowed();
  const [pandas, setPandas] = useState<PandaListItem[] | null>(null);
  useEffect(() => {
    void loadPandaIndex().then(setPandas);
  }, []);
  if (followed === null || pandas === null) return null;
  const items = pandas.filter((panda) => followed.has(panda.id));
  return (
    <View className="gap-row">
      <SectionHeader
        title="关注的熊猫"
        count={String(items.length)}
        action={items.length === 0 ? { label: "找熊猫", href: "/find" } : undefined}
      />
      {items.length === 0 ? (
        <Text variant="subheadline" className="text-muted-foreground">
          在熊猫资料页点「关注」，它们会排在这里。
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-inset"
          contentContainerClassName="gap-row px-inset"
        >
          {items.map((panda) => (
            <PandaAvatar key={panda.id} panda={panda} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Destinations() {
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      loadInbox()
        .then((messages) => setUnread(unreadCount(messages)))
        .catch(() => setUnread(0));
    }, []),
  );
  return (
    <ListSection>
      <ListCell label="我的合集" icon={FolderHeart} href="/collections" />
      <ListCell label="去过的地点" icon={MapPin} href="/visits" />
      <ListCell
        label="通知"
        icon={Bell}
        meta={unread > 0 ? `${unread} 条未读` : undefined}
        href="/notifications"
        last
      />
    </ListSection>
  );
}

function Contributions() {
  const [items, setItems] = useState<ContributionRecord[] | null>(null);
  const [pandas, setPandas] = useState<Map<string, PandaListItem>>(new Map());
  // Read again whenever 我的 shows, so a report sent from a profile appears on return.
  useFocusEffect(
    useCallback(() => {
      loadMyContributions()
        .then(setItems)
        .catch(() => setItems(null));
      loadPandaIndex()
        .then((list) => setPandas(new Map(list.map((panda) => [panda.id, panda]))))
        .catch(() => undefined);
    }, []),
  );
  if (!items || items.length === 0) return null;
  return (
    <View className="gap-row">
      <SectionHeader title="我的纠错" count={String(items.length)} />
      <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
        {items.map((item, index) => {
          const panda = pandas.get(item.targetPandaId);
          const name = panda?.name ?? "熊猫";
          const status = statusLabel(item.status);
          return (
            <View key={item.submissionId}>
              <Pressable
                disabled={!panda}
                onPress={() => panda && openPanda(panda.slug)}
                role="button"
                accessibilityLabel={`${name}，${status}`}
                className="min-h-11 gap-hair-gap px-inset py-row active:bg-accent"
              >
                <View className="flex-row items-center justify-between gap-row">
                  <Text variant="headline" className="min-w-0 flex-1" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text
                    variant="subheadline"
                    className={cn(
                      item.status === "accepted" ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {status}
                  </Text>
                </View>
                <Text variant="footnote" className="text-muted-foreground tabular-nums">
                  {`${shortDay(item.submittedAt.slice(0, 10))}提交`}
                </Text>
                {item.statusExplanation ? (
                  <Text variant="subheadline" className="text-muted-foreground">
                    {item.statusExplanation}
                  </Text>
                ) : null}
              </Pressable>
              {index < items.length - 1 ? <View className="ml-inset bg-border" style={{ height: HAIRLINE }} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function MeScreen() {
  const { state } = useSession();
  return (
    <Page title="我的" back={false}>
      {state.status === "loading" ? (
        <Skeleton className="h-44 w-full rounded-card" accessibilityLabel="正在加载" />
      ) : null}
      {state.status === "signedOut" ? <SignedOut /> : null}
      {state.status === "unavailable" ? (
        <ProfileCard>
          <ProfileAvatar name={null} size={AVATAR} />
          <Text variant="subheadline" className="text-muted-foreground">
            账号暂时不可用，请稍后再试。
          </Text>
        </ProfileCard>
      ) : null}
      {state.status === "signedIn" ? (
        <View className="gap-section">
          <Profile email={state.email} />
          <Following />
          <Destinations />
          <Contributions />
        </View>
      ) : null}
    </Page>
  );
}
