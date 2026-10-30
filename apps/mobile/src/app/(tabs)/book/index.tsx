import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { ICON_INSET } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Binoculars, CircleQuestionMark, type LucideIcon, Sunrise } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaTile } from "@/components/panda-tile";
import { PressScale } from "@/components/press-scale";
import { SectionHeader } from "@/components/section-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CONTENT_ENTER } from "@/design/motion";
import {
  type BookView,
  type MetThrough,
  buildBook,
  entryCaption,
  progressPercent,
  wayLabel,
} from "@/features/book/book";
import { localToday } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { useStoryPhotos } from "@/features/today/story-photos";
import { authedApi } from "@/lib/api";
import { HAIRLINE, RADIUS } from "@/lib/surface";

const GAP = 12;
const WAYS: { way: MetThrough; icon: LucideIcon; line: string }[] = [
  { way: "daily_panda", icon: Sunrise, line: "每日一猫猜中的熊猫" },
  { way: "guess_panda", icon: CircleQuestionMark, line: "猜熊猫答对的熊猫" },
  { way: "seen", icon: Binoculars, line: "去现场见过的熊猫" },
];
/** Tiles 图鉴 shows before the 今天的那只 tile closes the grid. */
const RECENT = 11;

async function loadBook(): Promise<BookView> {
  const [book, seen] = await Promise.all([
    authedApi.GET("/api/v2/me/panda-book"),
    authedApi.GET("/api/v2/me/seen-pandas"),
  ]);
  if (!book.data || !seen.data) throw new Error("Panda book unavailable");
  return buildBook(book.data, seen.data.items);
}

/** Three portrait tiles a row, as Photos lays out an album; two past a font scale of 1.35. */
function useGrid() {
  const { width, fontScale } = useWindowDimensions();
  const columns = fontScale > 1.35 ? 2 : 3;
  const column = Math.min(width, 700) - 32;
  return { columns, tile: Math.floor((column - GAP * (columns - 1)) / columns) };
}

/** Closes the grid: the way to add the next panda today. Same shape as a tile, so the grid stays even. */
function DailyTile({ width }: { width: number }) {
  return (
    <PressScale
      onPress={() => router.push("/daily")}
      role="button"
      accessibilityLabel="去猜今天的每日一猫"
      className="items-center justify-center gap-stack-tight bg-secondary p-row"
      style={{ width, aspectRatio: 4 / 5, borderRadius: RADIUS.tile, borderCurve: "continuous" }}
    >
      <Text variant="headline" className="text-center">
        今天的那只
      </Text>
      <Text variant="footnote" className="text-center text-primary">
        去猜每日一猫
      </Text>
    </PressScale>
  );
}

/** The ways a panda joins the 图鉴, as a stat block: three elevated tiles, a glyph and label over the count. */
function WayStats({ view }: { view: BookView }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.35;
  return (
    <View className={stacked ? "gap-row" : "flex-row gap-row"}>
      {WAYS.map(({ way, icon }) => (
        <View
          key={way}
          className="flex-1 gap-hair-gap rounded-tile bg-card p-row"
          style={{ borderCurve: "continuous" }}
          accessible
          accessibilityLabel={`${wayLabel(way)} ${view.byWay[way]} 只`}
        >
          <View className="flex-row items-center gap-hair-gap">
            <Icon icon={icon} size="footnote" />
            <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
              {wayLabel(way)}
            </Text>
          </View>
          <Text variant="stat" role="none">
            {String(view.byWay[way])}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SignedOut() {
  const { columns, tile } = useGrid();
  // Real pandas, softened: a glimpse of what the 图鉴 fills with, not a claim the fan has met them.
  const photos = useStoryPhotos(localToday(), columns * 2);
  return (
    <>
      <View
        className="flex-row flex-wrap"
        style={{ gap: GAP }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: columns * 2 }, (_, index) => (
          <View
            key={index}
            className="overflow-hidden bg-secondary"
            style={{ width: tile, aspectRatio: 4 / 5, borderRadius: RADIUS.tile, borderCurve: "continuous" }}
          >
            {photos[index] ? (
              <Image
                source={photos[index].url}
                style={{ flex: 1, opacity: 0.55 }}
                blurRadius={24}
                contentFit="cover"
                transition={200}
                accessible={false}
              />
            ) : null}
          </View>
        ))}
      </View>
      <View className="gap-row">
        <Text variant="title">登录后，这里会记下</Text>
        <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
          {WAYS.map(({ icon, line }, index) => (
            <View key={line}>
              <View className="min-h-11 flex-row items-center gap-row px-inset py-row">
                <Icon icon={icon} />
                <Text variant="body" className="min-w-0 flex-1">
                  {line}
                </Text>
              </View>
              {index < WAYS.length - 1 ? (
                <View className="bg-border" style={[{ height: HAIRLINE }, ICON_INSET]} />
              ) : null}
            </View>
          ))}
        </View>
      </View>
      <View className="gap-stack-tight">
        <Button onPress={() => router.push("/sign-in")}>
          <Text>登录</Text>
        </Button>
        <Button variant="plain" onPress={() => router.push("/daily")}>
          <Text>先去猜今天的每日一猫</Text>
        </Button>
      </View>
    </>
  );
}

function Loading() {
  const { columns, tile } = useGrid();
  return (
    <View className="gap-stack" accessibilityLabel="正在加载图鉴">
      <Skeleton className="h-10 w-32 rounded-control" />
      <Skeleton className="h-2 w-full rounded-full" />
      <View className="flex-row gap-row">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-20 flex-1 rounded-tile" />
        ))}
      </View>
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {Array.from({ length: columns * 2 }, (_, index) => (
          <Skeleton key={index} className="rounded-tile" style={{ width: tile, aspectRatio: 4 / 5 }} />
        ))}
      </View>
    </View>
  );
}

/** Keyed by account, so another fan signing in on this device starts from a fresh load. */
function SignedIn() {
  const { tile } = useGrid();
  const [view, setView] = useState<BookView | null>(null);
  const [pandas, setPandas] = useState<Map<string, PandaListItem>>(new Map());
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    Promise.all([loadBook(), loadPandaIndex()])
      .then(([book, index]) => {
        setView(book);
        setPandas(new Map(index.map((panda) => [panda.id, panda])));
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) {
    return (
      <LoadFailed
        message="图鉴暂时打不开。"
        onRetry={() => {
          setFailed(false);
          load();
        }}
      />
    );
  }
  if (!view) return <Loading />;

  const percent = progressPercent(view);
  return (
    <Animated.View entering={CONTENT_ENTER} className="gap-section">
      <View className="gap-row">
        <View className="flex-row items-baseline gap-stack-tight">
          <Text variant="display" className="tabular-nums">
            {String(view.knownCount)}
          </Text>
          <Text variant="subheadline" className="min-w-0 flex-1 text-muted-foreground">
            {`只已认识，共收录 ${view.publishedCount} 只`}
          </Text>
        </View>
        <View
          className="h-1.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          accessibilityLabel={`已认识 ${view.knownCount} 只，占 ${view.publishedCount} 只的 ${percent}%`}
        >
          <View className="h-1.5 rounded-full bg-foreground" style={{ width: `${percent}%` }} />
        </View>
        <WayStats view={view} />
      </View>
      <View className="gap-row">
        <SectionHeader title="最近认识的" />
        {view.recent.length === 0 ? (
          <Text variant="subheadline" className="text-muted-foreground">
            还没有认识的熊猫。猜中每日一猫、猜熊猫答对，或去现场记下见过，它就会来到这里。
          </Text>
        ) : null}
        <View className="flex-row flex-wrap" style={{ gap: GAP }}>
          {view.recent.slice(0, RECENT).map((entry) => {
            const panda = pandas.get(entry.pandaId);
            const name = panda?.name ?? "熊猫";
            return (
              <PandaTile
                key={entry.pandaId}
                pandaId={entry.pandaId}
                name={name}
                caption={entryCaption(entry)}
                width={tile}
                onPress={() => panda && openPanda(panda.slug)}
                accessibilityLabel={`${name}，${entryCaption(entry)}`}
              />
            );
          })}
          <DailyTile width={tile} />
        </View>
      </View>
    </Animated.View>
  );
}

export default function BookScreen() {
  const { state } = useSession();
  return (
    <Page title="图鉴" back={false}>
      {state.status === "signedIn" ? <SignedIn key={state.accountId} /> : null}
      {state.status === "signedOut" ? <SignedOut /> : null}
      {state.status === "loading" ? <Loading /> : null}
      {state.status === "unavailable" ? (
        <Text variant="subheadline" className="text-muted-foreground">
          账号暂时不可用，请稍后再试。
        </Text>
      ) : null}
    </Page>
  );
}
