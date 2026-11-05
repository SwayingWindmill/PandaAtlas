import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { CalendarCheck, Eye, MapPin, Share } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Scrim } from "@/components/scrim";
import { ScreenState } from "@/components/screen-state";
import { StatTile } from "@/components/stat-tile";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { LitCard } from "@/features/book/lit-card";
import { localToday } from "@/features/engagement/seen";
import { shareCardImage } from "@/features/pandas/share-card";
import { useSession } from "@/features/session/session";
import { type YearReviewData, useYearReview } from "@/features/year-review/load";
import { type YearFirst, monthDot, parseYear } from "@/features/year-review/year-review";
import { usePandaCover } from "@/lib/covers";
import { cn } from "@/lib/utils";

// 年度回顾 (v4 `10-year-review`): the fan's own year. The first panda they met that year as the hero, what
// they saw, checked in and visited, check-ins by month, how much of the catalog they have lit, and the year's
// firsts. Only their records; a year with none says so.

const CHART = 96;

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The first panda met this year, full bleed, its name and the day over a scrim. */
function Hero({ data }: { data: YearReviewData }) {
  const first = data.review.first;
  const panda = first ? data.pandas.get(first.pandaId) : undefined;
  const photo = usePandaCover(first?.pandaId);
  if (!first || !panda) return null;
  return (
    <View
      className="overflow-hidden rounded-card bg-media-placeholder"
      style={{ aspectRatio: 16 / 10, borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`今年第一只，${panda.name}，${monthDot(first.date)}`}
    >
      {photo ? <Image source={photo} style={{ position: "absolute", inset: 0 }} contentFit="cover" accessible={false} /> : null}
      <Scrim id="year-review-hero" />
      <View className="mt-auto flex-row items-end justify-between gap-row p-inset">
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="footnote" className="font-semibold text-on-media">
            今年第一只
          </Text>
          <Text variant="title" className="text-on-media" numberOfLines={1}>
            {panda.name}
          </Text>
        </View>
        <Text variant="stat" className="text-on-media tabular-nums">
          {monthDot(first.date)}
        </Text>
      </View>
    </View>
  );
}

/** 每月打卡: twelve bars, the busiest month in `graphic`, the rest quiet. Read aloud as the busiest month. */
function Months({ months, busiest }: { months: number[]; busiest: number | null }) {
  const most = Math.max(1, ...months);
  return (
    <View
      className="gap-row rounded-group bg-card p-inset"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`每月打卡${busiest ? `，${busiest} 月最多，${months[busiest - 1]} 天` : ""}`}
    >
      <View className="flex-row items-center justify-between">
        <Text variant="subheadline" className="font-semibold">
          每月打卡
        </Text>
        {busiest ? (
          <Text variant="footnote" className="text-muted-foreground">
            {busiest} 月最多
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-end gap-1.5" style={{ height: CHART }}>
        {months.map((count, index) => (
          <View
            key={index}
            className={cn("flex-1", index + 1 === busiest ? "bg-graphic" : count > 0 ? "bg-tertiary-foreground/40" : "bg-secondary")}
            style={{ height: count > 0 ? Math.max(8, (count / most) * CHART) : 3, borderRadius: 4 }}
          />
        ))}
      </View>
      <View className="flex-row gap-1.5">
        {months.map((_, index) => (
          <Text key={index} variant="footnote" className="flex-1 text-center text-muted-foreground tabular-nums" numberOfLines={1}>
            {index + 1}
          </Text>
        ))}
      </View>
    </View>
  );
}

const FIRST_META: Record<YearFirst["kind"], string> = { recognized: "认出", seen: "见过", visit: "去过", checkin: "打卡" };

function firstTitle(item: YearFirst, data: YearReviewData): string {
  const panda = item.pandaId ? data.pandas.get(item.pandaId)?.name : undefined;
  const place = item.placeId ? data.placeNames.get(item.placeId) : undefined;
  if (item.kind === "recognized") return panda ? `认出${panda}` : "第一次认出熊猫";
  if (item.kind === "seen") return panda ? `见到${panda}` : "第一次见到熊猫";
  if (item.kind === "visit") return place ? `去了${place}` : "第一次去场馆";
  return "第一次打卡";
}

function Review({ data, year }: { data: YearReviewData; year: number }) {
  const { review } = data;
  const stacked = useStacked();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState<"idle" | "sharing" | "failed">("idle");
  const firsts: TimelineItem[] = review.firsts.map((item) => ({
    key: item.kind,
    date: monthDot(item.date),
    meta: FIRST_META[item.kind],
    title: firstTitle(item, data),
  }));

  async function share() {
    setSharing("sharing");
    try {
      await shareCardImage(card, `year-review-${year}`);
      setSharing("idle");
    } catch {
      setSharing("failed");
    }
  }

  return (
    <Animated.View entering={PAGE_ENTER} className="gap-section">
      <View ref={card} collapsable={false} className="gap-row bg-background">
        <Hero data={data} />
        <View className={stacked ? "gap-row" : "flex-row gap-row"}>
          <StatTile icon={Eye} label="见过" value={`${review.seen} 只`} />
          <StatTile icon={CalendarCheck} label="打卡" value={`${review.checkinDays} 天`} />
          <StatTile icon={MapPin} label="去过" value={`${review.places} 处`} />
        </View>
        <Months months={review.months} busiest={review.busiest} />
        <LitCard met={data.met} catalog={data.catalog} label="图鉴点亮" />
      </View>
      {firsts.length > 0 ? (
        <View className="gap-row">
          <Text variant="title" role="heading">
            第一次
          </Text>
          <View className="rounded-group bg-card p-inset" style={{ borderCurve: "continuous" }}>
            <Timeline items={firsts} newestFirst={false} />
          </View>
        </View>
      ) : null}
      <View className="gap-hair-gap">
        <Button size="lg" className="rounded-pill" onPress={() => void share()} disabled={sharing === "sharing"}>
          <Icon icon={Share} size="body" tone="onButton" />
          <Text>分享回顾</Text>
        </Button>
        {sharing === "failed" ? <Text className="text-center text-destructive">没能生成图片，请再试一次。</Text> : null}
      </View>
    </Animated.View>
  );
}

export default function YearReviewScreen() {
  const params = useLocalSearchParams<{ year?: string }>();
  const year = parseYear(param(params.year), localToday());
  const { state } = useSession();
  const { data, isError, refetch } = useYearReview(year);

  return (
    <Page title="年度回顾" dateline={String(year)}>
      {state.status === "signedOut" ? (
        <View className="gap-row">
          <ScreenState message="登录后，这里会回顾你这一年见过、认出和去过的熊猫。" />
          <Button onPress={() => router.push("/sign-in")}>
            <Text>登录</Text>
          </Button>
        </View>
      ) : isError ? (
        <LoadFailed message="年度回顾暂时打不开。" onRetry={() => void refetch()} />
      ) : !data ? (
        <View className="gap-row" accessibilityLabel="正在加载年度回顾">
          <Skeleton className="w-full rounded-card" style={{ aspectRatio: 16 / 10 }} />
          <Skeleton className="h-20 w-full rounded-group" />
          <Skeleton className="h-40 w-full rounded-group" />
        </View>
      ) : data.review.empty ? (
        <ScreenState message={`${year} 年你还没有记下见过、认出或去过的熊猫。`} />
      ) : (
        <Review data={data} year={year} />
      )}
    </Page>
  );
}
