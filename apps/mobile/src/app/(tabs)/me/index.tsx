import { useQuery } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Chevron, ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Bell, FilePen, Flag, Heart, MapPin, Pencil, Plus, Settings } from "@/components/icons";
import { BARLESS_TOP } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ProgressRing } from "@/components/progress-ring";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type SeenEntry, buildLifeList } from "@/features/book/book";
import { Mosaic } from "@/features/collections/mosaic";
import { collectionsQueryOptions } from "@/features/collections/collections";
import { contributionsQueryOptions } from "@/features/corrections/submissions";
import { useFollowed } from "@/features/engagement/favorites";
import { useFollowedVenues } from "@/features/engagement/followed-venues";
import {
  guestCollectionsQueryOptions,
  guestGamesQueryOptions,
  guestSeenQueryOptions,
  guestVisitsQueryOptions,
} from "@/features/engagement/guest-store";
import { localToday } from "@/features/engagement/seen";
import { guestMilestonesQueryOptions, milestonesQueryOptions } from "@/features/milestones/load";
import { useMilestonePrefs } from "@/features/milestones/prefs";
import { inboxQueryOptions } from "@/features/notifications/inbox";
import { unreadCount } from "@/features/notifications/notifications";
import { type PandaListItem, pandaIndexQueryOptions, placeName, placesQueryOptions } from "@/features/pandas/pandas";
import { ProfileAvatar } from "@/features/profile/avatar";
import { NICKNAME_MAX, displayName, useProfile } from "@/features/profile/profile";
import { useAccount } from "@/features/session/account";
import { useSession } from "@/features/session/session";
import { useStoryPhotos } from "@/features/today/story-photos";
import { visitsQueryOptions } from "@/features/visits/visits";
import { YearReviewBanner } from "@/features/year-review/banner";
import { authedApi } from "@/lib/api";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { successHaptic } from "@/lib/haptics";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { PAGE_COLUMN } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";

const HEADER_AVATAR = 48;
const STACKED_FACE = 26;
const COLLECTION_MOSAIC = 56;
const MILESTONE_THUMB = 40;

async function loadCloudLifeCounts() {
  const [games, seen] = await Promise.all([
    authedApi.GET("/api/v2/me/panda-book"),
    authedApi.GET("/api/v2/me/seen-pandas"),
  ]);
  if (!games.data || !seen.data) throw new Error("Book summary unavailable");
  return buildLifeList(games.data.items, seen.data.items);
}

function yearMonthLabel(date: string): string {
  const [year, month] = date.split("-");
  return year && month ? `${year}年${Number(month)}月` : date;
}

function formatCount(value: number | undefined): string | undefined {
  return value === undefined || value === 0 ? undefined : value.toLocaleString("zh-CN");
}

function OverlappingFaces({
  pandas,
  limit,
  borderColor,
}: {
  pandas: PandaListItem[];
  limit: number;
  borderColor: string;
}) {
  const shown = pandas.slice(0, limit);
  if (shown.length === 0) return null;
  return (
    <View className="flex-row items-center" accessible={false} importantForAccessibility="no-hide-descendants">
      {shown.map((panda, index) => (
        <View
          key={panda.id}
          style={{
            marginLeft: index === 0 ? 0 : -8,
            borderWidth: 2,
            borderColor,
            borderRadius: STACKED_FACE / 2 + 2,
          }}
        >
          <PandaThumb pandaId={panda.id} name={panda.name} size={STACKED_FACE} />
        </View>
      ))}
    </View>
  );
}

function PassportHeader({
  signedIn,
  email,
  followedCount,
  litCount,
  leadPanda,
}: {
  signedIn: boolean;
  email: string | null;
  followedCount: number;
  litCount: number;
  leadPanda: PandaListItem | undefined;
}) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const story = useStoryPhotos(localToday(), 1);
  const { profile, rename } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
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

  if (signedIn && !profile) {
    return <Skeleton className="h-14 w-full rounded-card" accessibilityLabel="正在加载" />;
  }

  const title = signedIn && profile ? displayName(profile, email) : "熊猫护照";
  const subtitle = signedIn
    ? `已云端同步　${followedCount} 关注　${litCount} 点亮`
    : `本机已记 ${followedCount} 关注　${litCount} 点亮`;
  const guestPhoto = !leadPanda ? story[0] : undefined;

  return (
    <View className="gap-row">
      <View className="flex-row items-center gap-row">
        {leadPanda ? (
          <PandaThumb pandaId={leadPanda.id} name={leadPanda.name} size={HEADER_AVATAR} />
        ) : guestPhoto ? (
          <PandaThumb pandaId={guestPhoto.pandaId} name={guestPhoto.name} photoUrl={guestPhoto.url} size={HEADER_AVATAR} />
        ) : (
          <ProfileAvatar name={signedIn ? title : null} size={HEADER_AVATAR} quiet />
        )}
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="title" role="heading" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {signedIn ? (
          editing ? null : (
            <Pressable
              onPress={() => {
                setDraft(profile?.nickname ?? "");
                setEditing(true);
              }}
              role="button"
              accessibilityLabel="改名字"
              className="size-11 items-center justify-center active:opacity-70"
            >
              <Icon icon={Pencil} tone="tint" />
            </Pressable>
          )
        ) : (
          <Button variant="tinted" size="sm" onPress={() => router.push("/sign-in")}>
            <Text>绑定同步</Text>
          </Button>
        )}
      </View>

      {signedIn && editing ? (
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

function BentoDashboard({ signedIn, email }: { signedIn: boolean; email: string | null }) {
  const colors = useIOSColors();
  const [wildInk] = useCSSVariable(["--color-map-wild-ink"]).map(String) as [string];
  const stacked = useStacked();
  const { accountId } = useAccount();
  const id = accountId ?? "";
  const signedOut = !signedIn;

  const followed = useFollowed();
  const followedVenues = useFollowedVenues();
  const milestonePrefs = useMilestonePrefs();
  const milestonesOn = !(milestonePrefs?.off ?? false);

  const indexQuery = useQuery(pandaIndexQueryOptions());
  const placesQuery = useQuery(placesQueryOptions());

  const cloudBook = useQuery({
    queryKey: ["private", id, "me-book"],
    queryFn: loadCloudLifeCounts,
    enabled: signedIn && id.length > 0,
  });
  const guestSeen = useQuery({ ...guestSeenQueryOptions(), enabled: signedOut });
  const guestGames = useQuery({ ...guestGamesQueryOptions(), enabled: signedOut });

  const cloudVisits = useQuery({ ...visitsQueryOptions(id), enabled: signedIn && id.length > 0 });
  const guestVisits = useQuery({ ...guestVisitsQueryOptions(), enabled: signedOut });

  const cloudCollections = useQuery({ ...collectionsQueryOptions(id), enabled: signedIn && id.length > 0 });
  const guestCollections = useQuery({ ...guestCollectionsQueryOptions(), enabled: signedOut });

  const cloudMilestones = useQuery({ ...milestonesQueryOptions(id), enabled: signedIn && id.length > 0 && milestonesOn });
  const guestMilestones = useQuery({ ...guestMilestonesQueryOptions(), enabled: signedOut && milestonesOn });

  const inbox = useQuery({ ...inboxQueryOptions(id), enabled: signedIn && id.length > 0, select: unreadCount });
  const contributions = useQuery({
    ...contributionsQueryOptions(id),
    enabled: signedIn && id.length > 0,
    select: (items) => items.length,
  });

  useRefetchOnFocus(cloudBook.refetch, signedIn && id.length > 0);
  useRefetchOnFocus(cloudVisits.refetch, signedIn && id.length > 0);
  useRefetchOnFocus(cloudCollections.refetch, signedIn && id.length > 0);
  useRefetchOnFocus(cloudMilestones.refetch, signedIn && id.length > 0 && milestonesOn);
  useRefetchOnFocus(inbox.refetch, signedIn && id.length > 0);
  useRefetchOnFocus(contributions.refetch, signedIn && id.length > 0);

  const guestLifeList = useMemo(() => {
    if (!signedOut || !guestSeen.data || !guestGames.data) return undefined;
    const seenEntries: SeenEntry[] = Object.entries(guestSeen.data).map(([pandaId, entry]) => ({
      pandaId,
      seenOn: entry.seenOn,
      placeId: entry.placeId ?? null,
      firstSeenAt: entry.firstSeenAt,
    }));
    return buildLifeList(guestGames.data, seenEntries);
  }, [guestGames.data, guestSeen.data, signedOut]);

  const lifeList = signedIn ? cloudBook.data : guestLifeList;
  const visits = signedIn ? cloudVisits.data : guestVisits.data;
  const collections = (signedIn ? cloudCollections.data : guestCollections.data) ?? [];
  const milestones = (signedIn ? cloudMilestones.data : guestMilestones.data) ?? [];

  const pandasById = useMemo(
    () => new Map((indexQuery.data ?? []).map((panda) => [panda.id, panda])),
    [indexQuery.data],
  );
  const catalog = indexQuery.data?.length ?? 0;
  const litPandas = useMemo(
    () => (lifeList?.entries ?? []).flatMap((entry) => pandasById.get(entry.pandaId) ?? []),
    [lifeList?.entries, pandasById],
  );
  const followedPandas = useMemo(
    () => [...(followed ?? [])].flatMap((pandaId) => pandasById.get(pandaId) ?? []),
    [followed, pandasById],
  );

  const litCount = lifeList?.entries.length ?? 0;
  const seenCount = lifeList?.seenCount ?? 0;
  const recognizedCount = lifeList?.recognizedCount ?? 0;
  const followedCount = followed?.size ?? 0;
  const followedVenueCount = followedVenues?.size ?? 0;
  const placeCount = visits ? new Set(visits.map((visit) => visit.placeId)).size : 0;
  const latestVisitPlace = visits?.[0] ? placesQuery.data?.get(visits[0].placeId) : undefined;
  const latestPlaceName = latestVisitPlace ? placeName(latestVisitPlace) : null;
  const latestMilestone = milestones[0];
  const leadPanda = followedPandas[0] ?? litPandas[0];

  return (
    <View className="gap-stack">
      <PassportHeader
        signedIn={signedIn}
        email={email}
        followedCount={followedCount}
        litCount={litCount}
        leadPanda={leadPanda}
      />

      <View className="gap-3">
        <Pressable
          role="button"
          accessibilityLabel={`我的图鉴，已点亮 ${litCount} 只${catalog > 0 ? `，共 ${catalog} 只` : ""}`}
          onPress={() => router.push("/book")}
          className="active:opacity-80"
        >
          <Card className="flex-row items-center gap-row rounded-group p-inset">
            <ProgressRing
              value={catalog > 0 ? litCount / catalog : 0}
              label={String(litCount)}
              accessibilityLabel={`点亮 ${litCount}${catalog > 0 ? ` / ${catalog}` : ""}`}
            />
            <View className="min-w-0 flex-1 gap-stack-tight">
              <View className="flex-row items-baseline justify-between gap-2">
                <Text variant="headline">我的图鉴</Text>
                <Text variant="subheadline" className="text-muted-foreground tabular-nums">
                  {catalog > 0 ? `${litCount} / ${catalog}` : String(litCount)}
                </Text>
              </View>
              {litCount > 0 ? (
                <View className="flex-row items-center gap-2">
                  <OverlappingFaces pandas={litPandas} limit={4} borderColor={colors.card} />
                  <Text variant="footnote" className="min-w-0 flex-1 text-muted-foreground tabular-nums" numberOfLines={1}>
                    {`${seenCount} 见过　${recognizedCount} 猜中`}
                  </Text>
                </View>
              ) : (
                <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                  见过和猜中的熊猫会点亮在这里
                </Text>
              )}
            </View>
            <Chevron />
          </Card>
        </Pressable>

        <View className={stacked ? "gap-3" : "flex-row gap-3"}>
          <Pressable
            role="button"
            accessibilityLabel={`关注 ${followedCount} 只`}
            onPress={() => router.push("/following")}
            className="flex-1 active:opacity-80"
          >
            <Card className="gap-stack-tight rounded-group p-inset">
              <View className="flex-row items-center gap-1.5">
                <Icon icon={Heart} size="subhead" tone="tint" strokeWidth={2} />
                <Text variant="headline" className="min-w-0 flex-1" numberOfLines={1}>
                  关注
                </Text>
                <Chevron />
              </View>
              <View className="flex-row items-center justify-between gap-2 pt-1">
                <View className="flex-row items-baseline gap-1">
                  <Text variant="stat">{followedCount}</Text>
                  <Text variant="footnote" className="text-muted-foreground">
                    只
                  </Text>
                </View>
                {followedPandas.length > 0 ? (
                  <OverlappingFaces pandas={followedPandas} limit={3} borderColor={colors.card} />
                ) : followedVenueCount > 0 ? (
                  <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
                    {`含 ${followedVenueCount} 场馆`}
                  </Text>
                ) : null}
              </View>
            </Card>
          </Pressable>

          <Pressable
            role="button"
            accessibilityLabel={`去过的基地 ${placeCount} 处`}
            onPress={() => router.push("/visits")}
            className="flex-1 active:opacity-80"
          >
            <Card className="gap-stack-tight rounded-group p-inset">
              <View className="flex-row items-center gap-1.5">
                <Icon icon={MapPin} size="subhead" color={wildInk} strokeWidth={2} />
                <Text variant="headline" className="min-w-0 flex-1" numberOfLines={1}>
                  去过的基地
                </Text>
                <Chevron />
              </View>
              <View className="flex-row items-baseline justify-between gap-2 pt-1">
                <View className="flex-row items-baseline gap-1">
                  <Text variant="stat">{placeCount}</Text>
                  <Text variant="footnote" className="text-muted-foreground">
                    处
                  </Text>
                </View>
                <Text variant="footnote" className="min-w-0 flex-1 text-right text-muted-foreground" numberOfLines={1}>
                  {latestPlaceName ?? "去记录"}
                </Text>
              </View>
            </Card>
          </Pressable>
        </View>
      </View>

      <View className="gap-stack-tight">
        <View className="flex-row items-center justify-between gap-row">
          <Text variant="title" role="heading">
            我的合集
          </Text>
          <Pressable
            role="button"
            accessibilityLabel={collections.length > 0 ? `我的合集，${collections.length}` : "我的合集"}
            onPress={() => router.push("/collections")}
            hitSlop={8}
            className="min-h-11 flex-row items-center gap-0.5 active:opacity-70"
          >
            <Text variant="subheadline" className="font-semibold text-primary">
              全部
            </Text>
            <Chevron />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-gutter"
          contentContainerClassName="gap-3 px-gutter"
        >
          {collections.map((col) => (
            <Pressable
              key={col.collectionId}
              role="button"
              accessibilityLabel={`${col.name}，${col.pandaIds.length} 只熊猫`}
              onPress={() => router.push({ pathname: "/collections/[id]", params: { id: col.collectionId } })}
              className="flex-row items-center gap-3 rounded-group bg-card p-3 active:opacity-80"
              style={{ minWidth: 214, maxWidth: 256, borderCurve: "continuous" }}
            >
              <Mosaic pandaIds={col.pandaIds} size={COLLECTION_MOSAIC} />
              <View className="min-w-0 flex-1 gap-hair-gap">
                <Text variant="headline" numberOfLines={1}>
                  {col.name}
                </Text>
                <Text variant="footnote" className="text-muted-foreground tabular-nums">
                  {col.pandaIds.length > 0 ? `${col.pandaIds.length} 只熊猫` : "还没有熊猫"}
                </Text>
              </View>
            </Pressable>
          ))}
          <Pressable
            role="button"
            accessibilityLabel="新建合集"
            onPress={() => router.push("/collections")}
            className="items-center justify-center gap-1 rounded-group border border-dashed border-border px-4 py-3 active:opacity-75"
            style={{ width: 132, minHeight: 80, borderCurve: "continuous" }}
          >
            <Icon icon={Plus} size="body" tone="tint" strokeWidth={2} />
            <Text variant="footnote" className="font-medium text-muted-foreground">
              新建合集
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {milestonesOn || signedIn ? (
        <View className="gap-row">
          {milestonesOn ? (
            <Pressable
              role="button"
              accessibilityLabel={latestMilestone ? `里程碑，${latestMilestone.title}` : "里程碑"}
              onPress={() => router.push("/milestones")}
              className="flex-row items-center gap-row rounded-group bg-card px-inset py-3.5 active:opacity-80"
              style={{ borderCurve: "continuous" }}
            >
              {latestMilestone?.subject.kind === "panda" ? (
                <PandaThumb pandaId={latestMilestone.subject.id} name={latestMilestone.subject.name} size={MILESTONE_THUMB} />
              ) : (
                <Icon icon={Flag} size="title3" tone="tint" strokeWidth={2} />
              )}
              <View className="min-w-0 flex-1 gap-hair-gap">
                <View className="flex-row items-center gap-1.5">
                  <Icon icon={Flag} size="footnote" tone="tint" strokeWidth={2} />
                  <Text variant="headline" className="min-w-0 flex-1" numberOfLines={1}>
                    {latestMilestone ? `里程碑　${latestMilestone.title}` : "里程碑"}
                  </Text>
                </View>
                <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
                  {latestMilestone
                    ? `${latestMilestone.subject.name}　${yearMonthLabel(latestMilestone.date)}　共 ${milestones.length} 项记录`
                    : "认出或见过第一只熊猫就会记在这里"}
                </Text>
              </View>
              <Chevron />
            </Pressable>
          ) : null}
          {signedIn ? <YearReviewBanner /> : null}
        </View>
      ) : null}

      <ListSection>
        <ListCell
          label="通知与提醒"
          icon={Bell}
          meta={inbox.data ? `${inbox.data} 条未读` : undefined}
          href="/notifications"
        />
        <ListCell
          label="我的纠错"
          icon={FilePen}
          meta={formatCount(contributions.data)}
          href="/contributions"
        />
        <ListCell label="设置" icon={Settings} href="/settings" last />
      </ListSection>
    </View>
  );
}

export default function MeScreen() {
  const { state } = useSession();
  const insets = useSafeAreaInsets();
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  const top = Platform.OS === "android" ? insets.top + BARLESS_TOP : insets.top + 6;

  return (
    <>
      <StatusBarCover />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-section px-gutter"
        refreshControl={refreshControl}
        contentContainerStyle={[PAGE_COLUMN, { paddingTop: top, paddingBottom: bottom }]}
      >
        <Stack.Screen options={{ title: "我的", headerShown: false }} />
        {state.status === "loading" ? (
          <View className="gap-stack" accessibilityLabel="正在加载">
            <Skeleton className="h-14 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-group" />
            <View className="flex-row gap-3">
              <Skeleton className="h-24 flex-1 rounded-group" />
              <Skeleton className="h-24 flex-1 rounded-group" />
            </View>
            <Skeleton className="h-44 w-full rounded-group" />
          </View>
        ) : state.status === "unavailable" ? (
          <View className="gap-stack">
            <Card className="flex-row items-center gap-row rounded-group p-inset">
              <ProfileAvatar name={null} size={HEADER_AVATAR} quiet />
              <Text variant="subheadline" className="min-w-0 flex-1 text-muted-foreground">
                账号暂时不可用，请稍后再试。
              </Text>
            </Card>
            <ListSection>
              <ListCell label="设置" icon={Settings} href="/settings" last />
            </ListSection>
          </View>
        ) : (
          <BentoDashboard
            signedIn={state.status === "signedIn"}
            email={state.status === "signedIn" ? state.email : null}
          />
        )}
      </ScrollView>
    </>
  );
}
