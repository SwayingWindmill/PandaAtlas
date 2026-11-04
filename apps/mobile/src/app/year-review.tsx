import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
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
import { loadProfile } from "@/features/pandas/profile";
import { shareCardImage } from "@/features/pandas/share-card";
import { dayLabel } from "@/features/timeline/timeline";
import { useYearReview } from "@/features/year-review/load";
import {
  type YearReview,
  parseYear,
  reviewYears,
} from "@/features/year-review/year-review";

// 年度回顾: a year of the published record, app-wide or for one panda (?panda=slug), with a summary card to
// share. Only counts and names the record holds; no editorial sentence.

/** Rows shown before 还有 N 条. */
const LIST_LIMIT = 12;

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The share card, in the approved 回忆封面 style of the birthday card: a full-bleed photo, one big number in the
 * accent, a single line of counts, and the photo credit. After Spotify Wrapped's summary card and Apple Fitness
 * award tiles: one number carries the card. Type comes from token variants only.
 */
function SummaryCard({
  review,
  name,
  photoSlug,
  cardRef,
}: {
  review: YearReview;
  name: string | null;
  photoSlug: string | null;
  cardRef: React.RefObject<ComponentRef<typeof View> | null>;
}) {
  const profile = useQuery({
    queryKey: ["year-review", "photo", photoSlug],
    queryFn: () => loadProfile(photoSlug as string),
    enabled: photoSlug !== null,
    staleTime: 300_000,
  });
  const photo = profile.data?.photos[0] ?? null;
  const title = `${name ?? "吱熊猫"} · ${review.year}`;
  const counts = [
    `出生 ${review.births.length}`,
    ...(name ? [] : [`生日 ${review.birthdays}`]),
    `搬家 ${review.moves.length - review.homecomings}`,
    `回国 ${review.homecomings}`,
  ].join(" · ");
  const total = review.births.length + review.moves.length;
  return (
    <View
      ref={cardRef}
      collapsable={false}
      accessibilityLabel={`${title} 年度回顾，${total} 件大事：${counts}`}
      className="overflow-hidden rounded-tile bg-media-placeholder"
      style={{ aspectRatio: 4 / 5, borderCurve: "continuous" }}
    >
      {photo ? (
        <Image
          source={photo.url}
          style={{ position: "absolute", inset: 0 }}
          contentFit="cover"
          accessible={false}
        />
      ) : null}
      <View className="mt-auto gap-stack-tight bg-black/55 p-stack">
        <Text variant="footnote" className="text-on-media">
          {review.partial
            ? `年度回顾 · 截至${dayLabel(localToday())}`
            : "年度回顾"}
        </Text>
        <Text variant="display" className="tabular-nums text-warm">
          {String(total)}
        </Text>
        <Text variant="headline" className="text-on-media">
          {title}
        </Text>
        <Text variant="subheadline" className="text-on-media">
          {counts}
        </Text>
        {photo?.credit ? (
          <Text variant="footnote" className="text-on-media" numberOfLines={1}>
            {photo.credit}
          </Text>
        ) : null}
      </View>
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
        options={reviewYears(today).map((value) => ({
          value: String(value),
          label: String(value),
        }))}
        onChange={(value) => setYear(Number(value))}
        accessibilityLabel="选择年份"
      />
      {isError ? (
        <LoadFailed
          message="年度回顾暂时打不开。"
          onRetry={() => void refetch()}
        />
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
              <SummaryCard
                review={data.review}
                name={data.panda?.name ?? null}
                photoSlug={
                  data.panda?.slug ?? data.review.births[0]?.slug ?? null
                }
                cardRef={card}
              />
              <View className="flex-row flex-wrap gap-stack-tight">
                <Button
                  onPress={() => void share()}
                  disabled={sharing === "sharing"}
                  accessibilityLabel="分享年度回顾图片"
                >
                  <Text>分享图片</Text>
                </Button>
                {data.panda ? (
                  <Button
                    variant="secondary"
                    onPress={() => openPanda(data.panda!.slug)}
                  >
                    <Text>看资料</Text>
                  </Button>
                ) : null}
              </View>
              {sharing === "failed" ? (
                <Text className="text-destructive">
                  没能生成图片，请再试一次。
                </Text>
              ) : null}
            </View>
          )}
          {data.review.births.length > 0 ? (
            <ListSection title={`${year} 年出生`}>
              {data.review.births
                .slice(0, LIST_LIMIT)
                .map((panda, index, shown) => (
                  <ListCell
                    key={panda.id}
                    label={panda.name}
                    detail={
                      panda.birthDate && panda.birthDate.length >= 10
                        ? dayLabel(panda.birthDate)
                        : undefined
                    }
                    leading={
                      <PandaThumb
                        pandaId={panda.id}
                        name={panda.name}
                        size={44}
                        shape="round"
                      />
                    }
                    onPress={() => openPanda(panda.slug)}
                    role="link"
                    last={
                      index === shown.length - 1 &&
                      data.review.births.length <= LIST_LIMIT
                    }
                  />
                ))}
              {data.review.births.length > LIST_LIMIT ? (
                <ListCell
                  label={`还有 ${data.review.births.length - LIST_LIMIT} 只`}
                  tone="tint"
                  href="/calendar"
                  last
                />
              ) : null}
            </ListSection>
          ) : null}
          {data.review.moves.length > 0 ? (
            <ListSection title="搬家和回国">
              {data.review.moves
                .slice(0, LIST_LIMIT)
                .map((move, index, shown) => (
                  <ListCell
                    key={`${move.eventId}:${move.pandaId}`}
                    label={slug ? move.text : move.name}
                    detail={
                      slug
                        ? dayLabel(move.date)
                        : `${dayLabel(move.date)} · ${move.text}`
                    }
                    leading={
                      slug ? undefined : (
                        <PandaThumb
                          pandaId={move.pandaId}
                          name={move.name}
                          size={44}
                          shape="round"
                        />
                      )
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/pandas/[slug]/timeline",
                        params: { slug: move.slug },
                      })
                    }
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
