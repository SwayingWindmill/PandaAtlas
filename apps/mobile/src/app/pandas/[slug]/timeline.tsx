import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { type PandaTimeline, loadTimeline } from "@/features/timeline/load";
import type { Milestone, MilestoneSource } from "@/features/timeline/timeline";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** The date column: wide enough for "12月31日" at the default size. */
const DATE_WIDTH = 64;

function correct(slug: string) {
  router.push({ pathname: "/pandas/[slug]/correct", params: { slug } });
}

export default function TimelineScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [timeline, setTimeline] = useState<PandaTimeline | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadTimeline(slug)
      .then(setTimeline)
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  if (!timeline) {
    return (
      <Page title="时间线">
        {failed ? <LoadFailed message="时间线暂时打不开。" onRetry={retry} /> : <TimelineSkeleton />}
      </Page>
    );
  }

  if (timeline.count === 0) {
    return (
      <Page title={`${timeline.name}的时间线`}>
        <ScreenState
          message={`${timeline.name}的经历还没有带出处的记录。知道它在哪出生、搬过几次家？`}
          actionLabel="告诉我们"
          onAction={() => correct(timeline.slug)}
        />
      </Page>
    );
  }

  return (
    <Page title={`${timeline.name}的时间线`} label={timeline.summary ?? undefined}>
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        {timeline.years.map((year) => (
          <ListSection key={year.year} title={year.age ? `${year.year} · ${year.age}` : year.year}>
            {year.milestones.map((milestone, index) => (
              <MilestoneRow key={milestone.id} milestone={milestone} last={index === year.milestones.length - 1} />
            ))}
          </ListSection>
        ))}
        {timeline.undated.length > 0 ? (
          <ListSection title="日期不详">
            {timeline.undated.map((milestone, index) => (
              <MilestoneRow key={milestone.id} milestone={milestone} last={index === timeline.undated.length - 1} />
            ))}
          </ListSection>
        ) : null}
        <ListSection footer="只收已经发生、有公开资料的事。点出处可以看原文。">
          <ListCell label="少了什么或写错了？告诉我们" tone="tint" onPress={() => correct(timeline.slug)} last />
        </ListSection>
      </Animated.View>
    </Page>
  );
}

/** One milestone: its day in the left column, what happened, then where that is written down. */
function MilestoneRow({ milestone, last }: { milestone: Milestone; last: boolean }) {
  const stacked = useStacked();
  const day = milestone.dayLabel || "这一年";
  return (
    <View>
      <View className={cn("gap-3 px-4 py-3", stacked ? "items-start" : "flex-row")}>
        {milestone.date ? (
          <Text
            variant="subheadline"
            className="text-muted-foreground"
            style={stacked ? undefined : { width: DATE_WIDTH, fontVariant: ["tabular-nums"] }}
          >
            {day}
          </Text>
        ) : null}
        <View className={cn("min-w-0 gap-1", stacked ? "self-stretch" : "flex-1")}>
          <Text variant="body">{milestone.text}</Text>
          {milestone.note ? (
            <Text variant="footnote" className="text-muted-foreground">
              {milestone.note}
            </Text>
          ) : null}
          {milestone.sources.length > 0 ? (
            milestone.sources.map((source) => <SourceLink key={source.id} source={source} />)
          ) : milestone.note ? null : (
            <Text variant="footnote" className="text-muted-foreground">
              暂无出处
            </Text>
          )}
        </View>
      </View>
      {last ? null : <View className="ml-4 bg-border" style={{ height: HAIRLINE }} />}
    </View>
  );
}

/** "出处 Giant Panda FAQs · Smithsonian…": the title tells two sources from one publisher apart, so it leads. */
function SourceLink({ source }: { source: MilestoneSource }) {
  const stacked = useStacked();
  return (
    <Pressable
      role="link"
      accessibilityLabel={`出处：${source.title}，${source.publisher}`}
      accessibilityHint="在浏览器中打开"
      onPress={() => void WebBrowser.openBrowserAsync(source.url)}
      hitSlop={{ top: 6, bottom: 6 }}
      className="self-stretch active:opacity-60"
    >
      <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
        {"出处 "}
        <Text variant="footnote" className="text-primary">
          {source.title}
        </Text>
        {` · ${source.publisher}`}
      </Text>
    </Pressable>
  );
}

/** Two year groups of milestone rows, laid out as the loaded page is. */
function TimelineSkeleton() {
  return (
    <View className="gap-section" accessibilityLabel="正在加载时间线">
      {[3, 2].map((rows, group) => (
        <View key={group} className="gap-1.5">
          <Skeleton className="mx-4 h-4 w-24 rounded-control" />
          <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
            {Array.from({ length: rows }, (_, row) => (
              <View key={row} className="flex-row gap-3 px-4 py-3">
                <Skeleton className="h-4 rounded-control" style={{ width: DATE_WIDTH }} />
                <View className="flex-1 gap-2">
                  <Skeleton className="h-5 w-3/4 rounded-control" />
                  <Skeleton className="h-3.5 w-1/2 rounded-control" />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
