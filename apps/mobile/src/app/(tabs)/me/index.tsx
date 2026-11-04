import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  Bell,
  CalendarHeart,
  FilePen,
  Flag,
  FolderHeart,
  Heart,
  LayoutGrid,
  MapPin,
  PawPrint,
  Pencil,
  Settings,
  Sun,
} from "@/components/icons";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { loadCheckins } from "@/features/checkin/checkin";
import { loadCollections } from "@/features/collections/collections";
import { loadMyContributions } from "@/features/corrections/submissions";
import { useFollowed } from "@/features/engagement/favorites";
import { localToday } from "@/features/engagement/seen";
import { loadMilestones } from "@/features/milestones/load";
import { useMilestonesOn } from "@/features/milestones/prefs";
import { loadInbox } from "@/features/notifications/inbox";
import { unreadCount } from "@/features/notifications/notifications";
import { ProfileAvatar } from "@/features/profile/avatar";
import { NICKNAME_MAX, displayName, useProfile } from "@/features/profile/profile";
import { useSession } from "@/features/session/session";
import { StoryPhotoTile } from "@/features/today/story-photo-tile";
import { type StoryPhoto, useStoryPhotos } from "@/features/today/story-photos";
import { loadVisits } from "@/features/visits/visits";
import { successHaptic } from "@/lib/haptics";

const AVATAR = 64;

/** The round 设置 button in the corner of the signed-out card, as Music and the App Store put the account. */
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
        <ListCell icon={PawPrint} label="关注熊猫" accessibilityLabel="关注熊猫，在今天页第一时间看到它们的新动态" />
        <ListCell icon={LayoutGrid} label="点亮图鉴" accessibilityLabel="点亮图鉴，猜中每日一猫、去现场见过，都记进你的图鉴" />
        <ListCell icon={FolderHeart} label="收进合集" accessibilityLabel="收进合集，把喜欢的熊猫按自己的方式分组" />
        <ListCell icon={MapPin} label="记下去过的地点" accessibilityLabel="记下去过的地点，去过的基地和动物园，一处不落" />
        <ListCell icon={CalendarHeart} label="每日打卡" accessibilityLabel="每日打卡，每天打开每日一猫就记一天，累计不清零" />
        <ListCell icon={Bell} label="收到通知" accessibilityLabel="收到通知，关注的熊猫资料更新时告诉你" last />
      </ListSection>
      {strip.length > 0 ? (
        <View className="gap-row">
          <SectionHeader title="今天的熊猫" icon={Sun} action={{ label: "找熊猫", href: "/find" }} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-gutter"
            contentContainerClassName="gap-row px-gutter"
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

/** The fan's monogram and name in one row, with a tint pencil that opens the rename field under it. */
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

  if (!profile) return <Skeleton className="h-16 w-full rounded-card" accessibilityLabel="正在加载" />;
  const name = displayName(profile, email);

  return (
    <View className="gap-stack">
      <View className="flex-row items-center gap-stack">
        <ProfileAvatar name={name} size={AVATAR} quiet />
        <Text variant="title" className="min-w-0 flex-1" numberOfLines={1}>
          {name}
        </Text>
        {editing ? null : (
          <Pressable
            onPress={() => {
              setDraft(profile.nickname);
              setEditing(true);
            }}
            role="button"
            accessibilityLabel="改名字"
            className="size-11 items-center justify-center active:opacity-70"
          >
            <Icon icon={Pencil} tone="tint" />
          </Pressable>
        )}
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
      ) : null}
    </View>
  );
}

/** What 我的 counts. A count that fails to load is left out rather than shown as 0. */
interface Counts {
  checkinDays?: number;
  places?: number;
  collections?: number;
  milestones?: number;
  unread?: number;
  contributions?: number;
}

/** Read again each time the tab shows, so a change made elsewhere is counted on return. */
function useCounts(milestonesOn: boolean): Counts {
  const [counts, setCounts] = useState<Counts>({});
  useFocusEffect(
    useCallback(() => {
      const set = (patch: Counts) => setCounts((current) => ({ ...current, ...patch }));
      loadCheckins()
        .then((summary) => set({ checkinDays: summary.totalVisitDays }))
        .catch(() => undefined);
      loadVisits()
        .then((visits) => set({ places: new Set(visits.map((visit) => visit.placeId)).size }))
        .catch(() => undefined);
      loadCollections()
        .then((items) => set({ collections: items.length }))
        .catch(() => undefined);
      loadInbox()
        .then((messages) => set({ unread: unreadCount(messages) }))
        .catch(() => undefined);
      loadMyContributions()
        .then((items) => set({ contributions: items.length }))
        .catch(() => undefined);
      if (milestonesOn) {
        loadMilestones()
          .then((items) => set({ milestones: items.length }))
          .catch(() => undefined);
      }
    }, [milestonesOn]),
  );
  return counts;
}

function count(value: number | undefined) {
  return value === undefined ? undefined : value.toLocaleString("zh-CN");
}

function amount(value: number | undefined, unit: string) {
  return value === undefined ? "—" : `${count(value)} ${unit}`;
}

function SignedIn({ email }: { email: string | null }) {
  const stacked = useStacked();
  const followed = useFollowed();
  const milestonesOn = useMilestonesOn();
  const counts = useCounts(milestonesOn);
  return (
    <View className="gap-section">
      <Profile email={email} />
      <View className={stacked ? "gap-row" : "flex-row gap-row"}>
        <StatTile icon={Heart} label="关注" value={amount(followed?.size, "只")} href="/following" />
        <StatTile icon={CalendarHeart} label="打卡" value={amount(counts.checkinDays, "天")} href="/checkin" />
        <StatTile icon={MapPin} label="去过" value={amount(counts.places, "处")} href="/visits" />
      </View>
      <ListSection>
        <ListCell label="关注的熊猫" icon={Heart} meta={count(followed?.size)} href="/following" />
        <ListCell label="我的合集" icon={FolderHeart} meta={count(counts.collections)} href="/collections" />
        <ListCell label="去过的地点" icon={MapPin} meta={count(counts.places)} href="/visits" last={!milestonesOn} />
        {milestonesOn ? <ListCell label="里程碑" icon={Flag} meta={count(counts.milestones)} href="/milestones" last /> : null}
      </ListSection>
      <ListSection>
        <ListCell label="通知" icon={Bell} meta={counts.unread ? `${counts.unread} 条未读` : undefined} href="/notifications" />
        <ListCell
          label="我的纠错"
          icon={FilePen}
          meta={counts.contributions ? count(counts.contributions) : undefined}
          href="/contributions"
        />
        <ListCell label="设置" icon={Settings} href="/settings" last />
      </ListSection>
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
      {state.status === "signedIn" ? <SignedIn email={state.email} /> : null}
    </Page>
  );
}
