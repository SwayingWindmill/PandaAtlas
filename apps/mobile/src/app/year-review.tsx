import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useSingleColumn } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { localToday } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { shareCardImage } from "@/features/pandas/share-card";
import { dayLabel } from "@/features/timeline/timeline";
import { useYearReview } from "@/features/year-review/load";
import { type YearReview, parseYear, reviewYears } from "@/features/year-review/year-review";

// 年度回顾: a year of the published record, app-wide or for one panda (?panda=slug), with a summary card to
// share. Only counts and names the record holds; no editorial sentence.

/** Rows shown before 还有 N 条. */
const LIST_LIMIT = 12;

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The share card: one bold colour field with a hero number over a 2×2 grid, after Spotify Wrapped's summary
 * card and Apple Fitness award tiles. Type comes from the token styles only, so a font change carries over.
 */
function SummaryCard({ review, name, cardRef }: { review: YearReview; name: string | null; cardRef: React.RefObject<ComponentRef<typeof View> | null> }) {
  const single = useSingleColumn();
  const title = `${name ?? "吱熊猫"} · ${review.year}`;
  const tiles = [
    { label: "出生", value: review.births.length },
    ...(name ? [] : [{ label: "生日", value: review.birthdays }]),
    { label: "搬家", value: review.moves.length - review.homecomings },
    { label: "回国", value: review.homecomings },
  ];
  const total = review.births.length + review.moves.length;
  return (
    <View
      ref={cardRef}
      collapsable={false}
      accessibilityLabel={`${title} 年度回顾：${tiles.map((tile) => `${tile.label} ${tile.value}`).join("，")}`}
      className="gap-stack overflow-hidden rounded-tile bg-primary p-stack"
      style={{ borderCurve: "continuous" }}
    >
      <Text variant="footnote" className="text-primary-foreground">
        {review.partial ? `年度回顾 · 截至${dayLabel(localToday())}` : "年度回顾"}
      </Text>
      <View className="gap-hair-gap">
        <Text variant="display" className="tabular-nums text-primary-foreground">
          {String(total)}
        </Text>
        <Text variant="subheadline" className="text-primary-foreground">
          件大事
        </Text>
        <Text variant="headline" className="text-primary-foreground">
          {title}
        </Text>
      </View>
      <View className={single ? "gap-stack-tight" : "flex-row flex-wrap gap-stack-tight"}>
        {tiles.map((tile) => (
          <View
            key={tile.label}
            className="gap-hair-gap rounded-control bg-primary-foreground/15 p-row"
            style={single ? undefined : { flexBasis: "45%", flexGrow: 1 }}
          >
            <Text variant="footnote" className="text-primary-foreground">
              {tile.label}
            </Text>
            <Text variant="stat" className="text-primary-foreground">
              {String(tile.value)}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="footnote" className="text-primary-foreground">
        吱熊猫
      </Text>
    </View>
  );
}

export default function YearReviewScreen() {
  const params = useLocalSearchParams<{ year?: string; panda?: string }>();
  const today = localToday();
  const slug = param(params.panda);
  const [year, setYear] = useState(() => parseYear(param(params.year), today));
  const { data, isError, refetch } = useYearReview(year, slug);
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState<"idle" | "sharing" | "failed">("idle");

  async function share() {
    setSharing("sharing");
    try {
      await shareCardImage(card, `year-review-${slug ?? "all"}-${year}`);
      setSharing("idle");
    } catch {
      setSharing("failed");
    }
  }

  return (
    <Page title="年度回顾" label={data?.panda ? data.panda.name : "吱熊猫"}>
      <Segmented
        value={String(year)}
        options={reviewYears(today).map((value) => ({ value: String(value), label: String(value) }))}
        onChange={(value) => setYear(Number(value))}
        accessibilityLabel="选择年份"
      />
      {isError ? (
        <LoadFailed message="年度回顾暂时打不开。" onRetry={() => void refetch()} />
      ) : !data ? (
        <View className="gap-stack" accessibilityLabel="正在加载年度回顾">
          <Skeleton className="h-56 w-full rounded-tile" />
          <Skeleton className="h-36 w-full rounded-group" />
        </View>
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          {data.review.empty ? (
            <ScreenState message={`${year} 年暂无记录`} />
          ) : (
            <View className="gap-stack">
              <SummaryCard review={data.review} name={data.panda?.name ?? null} cardRef={card} />
              <View className="flex-row flex-wrap gap-stack-tight">
                <Button onPress={() => void share()} disabled={sharing === "sharing"} accessibilityLabel="分享年度回顾图片">
                  <Text>分享图片</Text>
                </Button>
                {data.panda ? (
                  <Button variant="secondary" onPress={() => openPanda(data.panda!.slug)}>
                    <Text>看资料</Text>
                  </Button>
                ) : null}
              </View>
              {sharing === "failed" ? <Text className="text-destructive">没能生成图片，请再试一次。</Text> : null}
            </View>
          )}
          {data.review.births.length > 0 ? (
            <ListSection title={`${year} 年出生`}>
              {data.review.births.slice(0, LIST_LIMIT).map((panda, index, shown) => (
                <ListCell
                  key={panda.id}
                  label={panda.name}
                  detail={panda.birthDate && panda.birthDate.length >= 10 ? dayLabel(panda.birthDate) : undefined}
                  leading={<PandaThumb pandaId={panda.id} name={panda.name} size={44} shape="round" />}
                  onPress={() => openPanda(panda.slug)}
                  role="link"
                  last={index === shown.length - 1 && data.review.births.length <= LIST_LIMIT}
                />
              ))}
              {data.review.births.length > LIST_LIMIT ? (
                <ListCell label={`还有 ${data.review.births.length - LIST_LIMIT} 只`} tone="tint" href="/calendar" last />
              ) : null}
            </ListSection>
          ) : null}
          {data.review.moves.length > 0 ? (
            <ListSection title="搬家和回国">
              {data.review.moves.slice(0, LIST_LIMIT).map((move, index, shown) => (
                <ListCell
                  key={`${move.eventId}:${move.pandaId}`}
                  label={slug ? move.text : move.name}
                  detail={slug ? dayLabel(move.date) : `${dayLabel(move.date)} · ${move.text}`}
                  leading={slug ? undefined : <PandaThumb pandaId={move.pandaId} name={move.name} size={44} shape="round" />}
                  onPress={() => router.push({ pathname: "/pandas/[slug]/timeline", params: { slug: move.slug } })}
                  accessibilityHint="打开它的时间线"
                  last={index === shown.length - 1}
                />
              ))}
            </ListSection>
          ) : null}
        </Animated.View>
      )}
    </Page>
  );
}
