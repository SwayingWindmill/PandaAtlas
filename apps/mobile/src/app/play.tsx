import { useQuery } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chevron, useSingleColumn, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Flame, Play } from "@/components/icons";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { ProgressRing } from "@/components/progress-ring";
import { RemoteImage } from "@/components/remote-image";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import type { GameEntry } from "@/features/book/book";
import { fallbackTitle, monthKey, progress, themeFor } from "@/features/challenges/challenge";
import { useMonthThemes } from "@/features/challenges/month-themes";
import { useChallengeState } from "@/features/challenges/prefs";
import { type LookAlikePair, lookAlikePairs } from "@/features/compare/look-alikes";
import { type DailyPandaState, loadDailyPanda } from "@/features/daily-panda/daily-panda";
import { loadGuestGames } from "@/features/engagement/guest-store";
import { localToday } from "@/features/engagement/seen";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { loadPandaIndex } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { type StoryPhoto, useStoryPhotos } from "@/features/today/story-photos";
import { authedApi } from "@/lib/api";
import { loadLineage } from "@/lib/public-data";
import { RADIUS } from "@/lib/surface";
import { IOS, useIOSColors } from "@/lib/theme";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";
import { cn } from "@/lib/utils";

const GAP = 12;
const TWIN_AVATAR = 40;

async function loadSignedInGames(): Promise<GameEntry[]> {
  try {
    const { data } = await authedApi.GET("/api/v2/me/panda-book");
    return data?.items ?? [];
  } catch {
    return [];
  }
}

function toLocalDay(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return localToday(parsed);
}

function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
}

function collectDailyDates(games: readonly GameEntry[], daily: DailyPandaState | null | undefined): Set<string> {
  const dates = new Set<string>();
  for (const game of games) {
    if (game.firstGame !== "daily_panda") continue;
    const day = toLocalDay(game.firstMetAt);
    if (day) dates.add(day);
  }
  if (daily?.finished) {
    dates.add(daily.puzzleDate);
  }
  return dates;
}

function computeDailyStreak(dates: ReadonlySet<string>, today: string): number {
  const yesterday = shiftDay(today, -1);
  const anchor = dates.has(today) ? today : dates.has(yesterday) ? yesterday : null;
  if (!anchor) return 0;
  let streak = 0;
  let cursor = anchor;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

function pickFeaturedLookAlike(
  pairs: readonly LookAlikePair[],
  coveredIds: ReadonlySet<string>,
): LookAlikePair | null {
  if (pairs.length === 0) return null;
  return (
    pairs.find((pair) => pair.kind === "twins" && coveredIds.has(pair.a.id) && coveredIds.has(pair.b.id)) ??
    pairs.find((pair) => coveredIds.has(pair.a.id) && coveredIds.has(pair.b.id)) ??
    pairs.find((pair) => pair.kind === "twins" && (coveredIds.has(pair.a.id) || coveredIds.has(pair.b.id))) ??
    pairs.find((pair) => coveredIds.has(pair.a.id) || coveredIds.has(pair.b.id)) ??
    pairs[0]!
  );
}

function SpotlightHero({
  photo,
  doneToday,
  streak,
  stacked,
}: {
  photo: StoryPhoto | undefined;
  doneToday: boolean;
  streak: number;
  stacked: boolean;
}) {
  const statusLabel = doneToday ? "今日主线　已完成" : "今日主线　待猜测";
  const ctaLabel = doneToday ? "查看" : "开始";
  const subtitle = doneToday ? "今日线索已全部揭晓，点击查看战绩" : "从 4 条体貌与栖息地线索猜今日主角";
  const spoken = [
    "每日一猫",
    doneToday ? "今日已完成" : "今日待猜测",
    streak > 0 ? `连猜 ${streak} 天` : null,
    subtitle,
  ]
    .filter(Boolean)
    .join("，");

  return (
    <PressScale role="button" accessibilityLabel={spoken} onPress={() => router.push("/daily")}>
      <View
        className="overflow-hidden rounded-card bg-media-placeholder"
        style={{ borderCurve: "continuous", ...(stacked ? { minHeight: 220 } : { aspectRatio: 16 / 10 }) }}
      >
        {photo ? (
          <RemoteImage
            source={photo.url}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : null}
        <Scrim id="play-daily-hero" height="68%" />
        <View className={cn("justify-between gap-stack p-inset", !stacked && "flex-1")}>
          <View className="flex-row flex-wrap items-center justify-between gap-stack-tight">
            <View className="rounded-pill bg-primary px-3 py-1" style={{ borderCurve: "continuous" }}>
              <Text variant="footnote" className="font-semibold text-primary-foreground">
                {statusLabel}
              </Text>
            </View>
            {streak > 0 ? (
              <View
                className="flex-row items-center gap-hair-gap rounded-pill bg-glass-fallback px-3 py-1"
                style={{ borderCurve: "continuous" }}
              >
                <Icon icon={Flame} size="footnote" tone="onMedia" strokeWidth={2} />
                <Text variant="footnote" className="font-semibold text-on-media tabular-nums">
                  {`连猜 ${streak} 天`}
                </Text>
              </View>
            ) : null}
          </View>

          <View className={stacked ? "gap-row" : "flex-row items-end justify-between gap-row"}>
            <View className={cn("gap-hair-gap", !stacked && "min-w-0 flex-1")}>
              <Text variant="title" role="none" className="text-on-media">
                每日一猫
              </Text>
              <Text variant="footnote" className="text-on-media/85" numberOfLines={stacked ? undefined : 2}>
                {subtitle}
              </Text>
            </View>
            <View
              aria-hidden
              className={cn("flex-row items-center gap-hair-gap rounded-pill bg-on-media px-3.5 py-2", stacked && "self-start")}
              style={{ borderCurve: "continuous" }}
            >
              <Icon icon={Play} size="footnote" color={IOS.light.label} strokeWidth={2.2} />
              <Text variant="footnote" className="font-semibold" style={{ color: IOS.light.label }}>
                {ctaLabel}
              </Text>
            </View>
          </View>
        </View>
        <PhotoOutline radius={RADIUS.card} />
      </View>
    </PressScale>
  );
}

function ChallengeTile({
  id,
  title,
  subtitle,
  badge,
  photo,
  href,
  accessibilityLabel,
  single,
  stacked,
}: {
  id: string;
  title: string;
  subtitle: string;
  badge: string | null;
  photo: StoryPhoto | undefined;
  href: Href;
  accessibilityLabel: string;
  single: boolean;
  stacked: boolean;
}) {
  return (
    <PressScale
      role="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => router.push(href)}
      containerStyle={single ? undefined : { flex: 1 }}
    >
      <View
        className="overflow-hidden rounded-tile bg-media-placeholder"
        style={{ borderCurve: "continuous", ...(stacked ? { minHeight: 152 } : { aspectRatio: 1.05 }) }}
      >
        {photo ? (
          <RemoteImage
            source={photo.url}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : null}
        <Scrim id={`play-card-${id}`} height="65%" />
        <View className={cn("justify-between gap-stack p-3.5", !stacked && "flex-1")}>
          {badge ? (
            <View className="self-start rounded-pill bg-glass-fallback px-2.5 py-1" style={{ borderCurve: "continuous" }}>
              <Text variant="footnote" className="font-semibold text-on-media tabular-nums">
                {badge}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View className="gap-hair-gap">
            <Text variant="headline" role="none" className="font-bold text-on-media" numberOfLines={stacked ? undefined : 1}>
              {title}
            </Text>
            <Text variant="footnote" className="text-on-media/85" numberOfLines={stacked ? undefined : 2}>
              {subtitle}
            </Text>
          </View>
        </View>
        <PhotoOutline radius={RADIUS.tile} />
      </View>
    </PressScale>
  );
}

export default function PlayScreen() {
  const colors = useIOSColors();
  const stacked = useStacked();
  const single = useSingleColumn();
  const today = localToday();
  const month = monthKey(today);
  const { state: session } = useSession();

  const photos = useStoryPhotos(`play:${today}`, 3);

  const dailyQuery = useQuery({
    queryKey: ["explore", "daily-panda", today],
    queryFn: () => loadDailyPanda().catch(() => null),
    staleTime: 60_000,
  });

  const gamesQuery = useQuery({
    queryKey:
      session.status === "signedIn"
        ? ["explore", "panda-book", session.accountId]
        : ["explore", "guest-games"],
    queryFn: () => (session.status === "signedIn" ? loadSignedInGames() : loadGuestGames()),
    enabled: session.status === "signedIn" || session.status === "signedOut",
    staleTime: 60_000,
    networkMode: "always",
  });

  const { state: catalogState } = useLearningCatalog();
  const challengeState = useChallengeState();
  const themes = useMonthThemes();

  const lookAlikesQuery = useQuery({
    queryKey: ["look-alikes", "base"],
    queryFn: async () => {
      const [pandas, links] = await Promise.all([loadPandaIndex(), loadLineage()]);
      return { pandas, links };
    },
    staleTime: 300_000,
    networkMode: "always",
  });

  useRefetchOnFocus(dailyQuery.refetch);
  useRefetchOnFocus(gamesQuery.refetch, session.status === "signedIn" || session.status === "signedOut");

  const games = gamesQuery.data;
  const recognizedCount = useMemo(() => new Set((games ?? []).map((item) => item.pandaId)).size, [games]);
  const dailyDates = useMemo(() => collectDailyDates(games ?? [], dailyQuery.data), [games, dailyQuery.data]);
  const dailyDoneToday = Boolean(dailyQuery.data?.finished || dailyDates.has(today));
  const dailyStreak = useMemo(() => computeDailyStreak(dailyDates, today), [dailyDates, today]);

  const faceChallengeCount = catalogState.status === "ready" ? catalogState.catalog.challenges.length : 0;

  const theme = useMemo(() => themeFor(month, themes), [month, themes]);
  const themeTitle = theme.title ?? fallbackTitle(month);
  const { done, total } = challengeState
    ? progress(challengeState, month, theme)
    : { done: 0, total: theme.tasks.length };
  const remaining = Math.max(0, total - done);
  const monthNumber = Number(month.slice(5, 7));
  const monthlySubtitle =
    remaining === 0 && total > 0
      ? `已完成全部任务，解锁 ${monthNumber} 月纪念徽章`
      : `再完成 ${remaining} 项解锁 ${monthNumber} 月纪念徽章`;

  const { pairs, featuredPair } = useMemo(() => {
    if (!lookAlikesQuery.data) return { pairs: [] as LookAlikePair[], featuredPair: null as LookAlikePair | null };
    const challenges = catalogState.status === "ready" ? catalogState.catalog.challenges : [];
    const built = lookAlikePairs(lookAlikesQuery.data.pandas, lookAlikesQuery.data.links, challenges);
    const coveredIds = new Set(lookAlikesQuery.data.pandas.filter((panda) => panda.hasFullBleedCover).map((panda) => panda.id));
    return { pairs: built, featuredPair: pickFeaturedLookAlike(built, coveredIds) };
  }, [lookAlikesQuery.data, catalogState]);

  const secondPair = featuredPair ? pairs.find((pair) => pair.key !== featuredPair.key) : undefined;
  const lookAlikeSubtitle = featuredPair
    ? secondPair
      ? `${featuredPair.a.name} & ${featuredPair.b.name}、${secondPair.a.name} & ${secondPair.b.name} 等 ${pairs.length} 对辨识`
      : `${featuredPair.a.name} & ${featuredPair.b.name}　${pairs.length} 对辨识`
    : "查看双胞胎与相似大熊猫辨识";

  return (
    <Page title="趣味挑战" dateline="每日猜谜与主题收集">
      <Animated.View entering={PAGE_ENTER} className="gap-stack">
        <SpotlightHero photo={photos[0]} doneToday={dailyDoneToday} streak={dailyStreak} stacked={stacked} />

        <View className={single ? "gap-row" : "flex-row gap-row"} style={{ gap: GAP }}>
          <ChallengeTile
            id="guess"
            title="猜熊猫"
            subtitle="写真四选一识猫"
            badge={recognizedCount > 0 ? `已认出 ${recognizedCount} 只` : "看图识猫"}
            photo={photos[1]}
            href="/guess"
            accessibilityLabel={`猜熊猫，${recognizedCount > 0 ? `已认出 ${recognizedCount} 只` : "看图识猫"}，写真四选一识猫`}
            single={single}
            stacked={stacked}
          />
          <ChallengeTile
            id="faces"
            title="认脸挑战"
            subtitle="分辨眼斑与耳形"
            badge={faceChallengeCount > 0 ? `${faceChallengeCount} 组挑战` : null}
            photo={photos[2]}
            href="/learn/challenge"
            accessibilityLabel={`认脸挑战${faceChallengeCount > 0 ? `，${faceChallengeCount} 组挑战` : ""}，分辨眼斑与耳形`}
            single={single}
            stacked={stacked}
          />
        </View>

        <PressScale
          role="button"
          accessibilityLabel={`月度挑战　${themeTitle}，已完成 ${done} 项，共 ${total} 项，${monthlySubtitle}`}
          onPress={() => router.push("/challenge")}
        >
          <View
            className="rounded-group border-hairline border-border bg-card p-inset"
            style={{ borderCurve: "continuous" }}
          >
            {stacked ? (
              <View className="gap-row">
                <View className="flex-row items-center justify-between gap-row">
                  <ProgressRing
                    size="small"
                    value={total > 0 ? done / total : 0}
                    label={`${done}/${total}`}
                    accessibilityLabel={`月度挑战进度 ${done}/${total}`}
                  />
                  <Chevron />
                </View>
                <View className="gap-hair-gap">
                  <Text variant="footnote" className="font-semibold text-primary">
                    本月主题收集
                  </Text>
                  <Text variant="headline">{`月度挑战　${themeTitle}`}</Text>
                  <Text variant="footnote" className="text-muted-foreground tabular-nums">
                    {monthlySubtitle}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-row">
                <ProgressRing
                  size="small"
                  value={total > 0 ? done / total : 0}
                  label={`${done}/${total}`}
                  accessibilityLabel={`月度挑战进度 ${done}/${total}`}
                />
                <View className="min-w-0 flex-1 gap-hair-gap">
                  <Text variant="footnote" className="font-semibold text-primary">
                    本月主题收集
                  </Text>
                  <Text variant="headline" numberOfLines={1}>
                    {`月度挑战　${themeTitle}`}
                  </Text>
                  <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
                    {monthlySubtitle}
                  </Text>
                </View>
                <Chevron />
              </View>
            )}
          </View>
        </PressScale>

        <Pressable
          role="link"
          accessibilityLabel={`双胞胎与撞脸对照，${lookAlikeSubtitle}`}
          onPress={() => router.push("/look-alikes")}
          className={cn(
            "border-t-hairline border-border py-inset active:opacity-70",
            stacked ? "gap-row" : "flex-row items-center gap-row",
          )}
        >
          {stacked ? (
            <>
              <View className="flex-row items-center justify-between gap-row">
                {featuredPair ? (
                  <View
                    className="flex-row items-center"
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                  >
                    {[featuredPair.a, featuredPair.b].map((panda, index) => (
                      <View
                        key={panda.id}
                        className="rounded-full"
                        style={{
                          marginLeft: index === 0 ? 0 : -12,
                          borderWidth: 2,
                          borderColor: colors.background,
                        }}
                      >
                        <PandaThumb pandaId={panda.id} name={panda.name} size={TWIN_AVATAR} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View />
                )}
                <Chevron />
              </View>
              <View className="gap-hair-gap">
                <Text variant="headline">双胞胎与撞脸对照</Text>
                <Text variant="footnote" className="text-muted-foreground tabular-nums">
                  {lookAlikeSubtitle}
                </Text>
              </View>
            </>
          ) : (
            <>
              {featuredPair ? (
                <View
                  className="flex-row items-center"
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                >
                  {[featuredPair.a, featuredPair.b].map((panda, index) => (
                    <View
                      key={panda.id}
                      className="rounded-full"
                      style={{
                        marginLeft: index === 0 ? 0 : -12,
                        borderWidth: 2,
                        borderColor: colors.background,
                      }}
                    >
                      <PandaThumb pandaId={panda.id} name={panda.name} size={TWIN_AVATAR} />
                    </View>
                  ))}
                </View>
              ) : null}
              <View className="min-w-0 flex-1 gap-hair-gap">
                <Text variant="headline" numberOfLines={1}>
                  双胞胎与撞脸对照
                </Text>
                <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
                  {lookAlikeSubtitle}
                </Text>
              </View>
              <Chevron />
            </>
          )}
        </Pressable>
      </Animated.View>
    </Page>
  );
}
