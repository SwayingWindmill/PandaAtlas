import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { CalendarDays, CalendarHeart, Check, ChevronLeft, ChevronRight } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { dayHeading, monthGrid, shiftMonth } from "@/features/calendar/calendar";
import {
  type CheckinDayMark,
  type CheckinFailure,
  type CheckinSummary,
  CheckinError,
  cancelLeave,
  cancellable,
  dayKey,
  dayMark,
  leaveLeftIn,
  loadCheckins,
  rulesNote,
  takeLeave,
  upcomingLeave,
  visitsIn,
} from "@/features/checkin/checkin";
import { DayCircle, LegendItem, useDayCircle } from "@/features/checkin/day-mark";
import { useSession } from "@/features/session/session";
import { selectionHaptic, successHaptic } from "@/lib/haptics";
import { HAIRLINE } from "@/lib/surface";

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];
/** A day's circle: 36pt inside a 48pt-tall cell, as the 熊猫日历 grid draws one. */
const DAY_CIRCLE = 36;

const MARK_WORD: Record<CheckinDayMark, string> = {
  visit: "来过",
  leave: "请假",
  retro: "可以补请",
  plannable: "可以请假",
  none: "",
};

const FAILURE_COPY: Record<CheckinFailure, string> = {
  quotaUsed: "这个月的假已经用完了。",
  dayClosed: "这一天已经不能改了。",
  failed: "没能保存，请再试一次。",
};

function MonthButton({ to, direction, onPress }: { to: number; direction: "back" | "forward"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={`${direction === "back" ? "上个月" : "下个月"}，${to}月`}
      hitSlop={4}
      className="size-11 items-center justify-center rounded-full bg-secondary active:bg-accent"
    >
      <Icon icon={direction === "back" ? ChevronLeft : ChevronRight} size="body" tone="tint" strokeWidth={2.25} />
    </Pressable>
  );
}

function MonthCard({
  summary,
  busy,
  onDay,
}: {
  summary: CheckinSummary;
  busy: boolean;
  onDay: (day: string, mark: CheckinDayMark) => void;
}) {
  const [{ year, month }, setMonth] = useState({
    year: Number(summary.today.slice(0, 4)),
    month: Number(summary.today.slice(5, 7)),
  });
  const monthKey = dayKey(year, month, 1).slice(0, 7);
  const visits = visitsIn(summary, monthKey);
  const showsRetro = summary.retroDay?.startsWith(monthKey) ?? false;
  const stacked = useStacked();
  const circle = useDayCircle(DAY_CIRCLE);
  const back = shiftMonth(year, month, -1);
  const forward = shiftMonth(year, month, 1);
  return (
    <View className="gap-stack rounded-card bg-card px-row pt-inset pb-row" style={{ borderCurve: "continuous" }}>
      <View className={stacked ? "gap-row px-hair-gap" : "flex-row items-center gap-row px-hair-gap"}>
        <View className="min-w-0 flex-1">
          <Text variant="title" className="tabular-nums">{`${year}年${month}月`}</Text>
          <Text variant="footnote" className="text-muted-foreground tabular-nums">
            {visits > 0 ? `来过 ${visits} 天` : "这个月还没有记录"}
          </Text>
        </View>
        <View className="flex-row gap-row">
          <MonthButton to={back.month} direction="back" onPress={() => setMonth(back)} />
          <MonthButton to={forward.month} direction="forward" onPress={() => setMonth(forward)} />
        </View>
      </View>
      <View className="gap-hair-gap" onLayout={circle.onLayout}>
        <View className="flex-row">
          {WEEK.map((weekday) => (
            <Text key={weekday} variant="footnote" className="flex-1 text-center text-muted-foreground" accessible={false}>
              {weekday}
            </Text>
          ))}
        </View>
        {monthGrid(year, month).map((week, row) => (
          <View key={row} className="flex-row">
            {week.map((day, column) => {
              if (day === null) return <View key={column} className="min-h-12 flex-1" />;
              const date = dayKey(year, month, day);
              const mark = dayMark(summary, date);
              const tappable = mark === "retro" || mark === "plannable" || cancellable(summary, date);
              const isToday = date === summary.today;
              const word = MARK_WORD[mark];
              return (
                <Pressable
                  key={column}
                  disabled={!tappable || busy}
                  onPress={() => onDay(date, mark)}
                  role="button"
                  accessibilityLabel={`${month}月${day}日${isToday ? "，今天" : ""}${word ? `，${word}` : ""}`}
                  accessibilityHint={
                    mark === "retro" ? "轻点补请这一天" : mark === "plannable" ? "轻点请假" : tappable ? "轻点取消请假" : undefined
                  }
                  accessibilityState={{ disabled: !tappable || busy }}
                  className="min-h-12 flex-1 items-center justify-center active:opacity-60"
                >
                  <DayCircle mark={mark} size={circle.size} label={String(day)} today={isToday} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-row gap-y-hair-gap px-hair-gap">
        <LegendItem mark="visit" label="来过" />
        <LegendItem mark="leave" label="请假" />
        {showsRetro ? <LegendItem mark="retro" label="可以补请" /> : null}
      </View>
    </View>
  );
}

/** A coming day off: the date, and 取消 as a tinted action at the trailing edge (it moves under the date at large text). */
function LeaveRow({ day, busy, last, onCancel }: { day: string; busy: boolean; last: boolean; onCancel: () => void }) {
  const stacked = useStacked();
  const cancel = (
    <Pressable
      onPress={onCancel}
      disabled={busy}
      role="button"
      accessibilityLabel={`取消${dayHeading(day)}的假`}
      className={stacked ? "min-h-11 justify-center self-start active:opacity-60" : "min-h-11 justify-center px-inset active:opacity-60"}
    >
      <Text variant="body" className="text-primary">
        取消
      </Text>
    </Pressable>
  );
  return (
    <View>
      <View className={stacked ? "min-h-11 gap-hair-gap px-inset py-stack-tight" : "min-h-11 flex-row items-center pl-inset"}>
        <Text variant="body" className={stacked ? undefined : "min-w-0 flex-1 py-row"}>
          {`${dayHeading(day)}　请假`}
        </Text>
        {cancel}
      </View>
      {last ? null : <View className="ml-inset bg-border" style={{ height: HAIRLINE }} />}
    </View>
  );
}

function LeaveSection({
  summary,
  busy,
  onCancel,
  onRetro,
}: {
  summary: CheckinSummary;
  busy: boolean;
  onCancel: (day: string) => void;
  onRetro: (day: string) => void;
}) {
  const coming = upcomingLeave(summary);
  const left = leaveLeftIn(summary, summary.today.slice(0, 7));
  const rows: { key: string; node: (last: boolean) => ReactNode }[] = [
    {
      key: "left",
      node: (last) => <ListCell label="本月还能请" meta={`${left} 天`} last={last} />,
    },
    ...(summary.retroDay
      ? [
          {
            key: "retro",
            node: (last: boolean) => (
              <ListCell
                label={`补请 ${dayHeading(summary.retroDay!)}`}
                tone="tint"
                onPress={busy ? undefined : () => onRetro(summary.retroDay!)}
                last={last}
              />
            ),
          },
        ]
      : []),
    ...coming.map((day) => ({
      key: day,
      node: (last: boolean) => <LeaveRow day={day} busy={busy} last={last} onCancel={() => onCancel(day)} />,
    })),
  ];
  return (
    <ListSection title="请假" footer={`${rulesNote(summary.rules)}点日历上今天和以后的日子就能请假，再点一次取消。`}>
      {rows.map((row, index) => (
        <View key={row.key}>{row.node(index === rows.length - 1)}</View>
      ))}
    </ListSection>
  );
}

export default function CheckinScreen() {
  const { state: session } = useSession();
  const signedIn = session.status === "signedIn";
  const [summary, setSummary] = useState<CheckinSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<CheckinFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const stacked = useStacked();

  const load = useCallback(() => {
    if (!signedIn) return;
    setFailed(false);
    loadCheckins()
      .then(setSummary)
      .catch(() => setFailed(true));
  }, [signedIn]);
  useFocusEffect(load);

  async function change(work: () => Promise<CheckinSummary>, haptic: () => void, done: string) {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      setSummary(await work());
      setNotice(done);
      haptic();
    } catch (error) {
      setProblem(error instanceof CheckinError ? error.failure : "failed");
    } finally {
      setBusy(false);
    }
  }

  function onDay(day: string, mark: CheckinDayMark) {
    if (!summary) return;
    if (cancellable(summary, day)) void change(() => cancelLeave(day), selectionHaptic, `${dayHeading(day)}的假取消了。`);
    else if (mark === "retro" || mark === "plannable") {
      void change(() => takeLeave(day), successHaptic, `${dayHeading(day)}请好假了。`);
    }
  }

  if (session.status === "unavailable") {
    return (
      <Page title="每日打卡">
        <ScreenState message="账号暂时不可用，请稍后再试。" />
      </Page>
    );
  }

  if (session.status === "signedOut") {
    return (
      <Page title="每日打卡">
        <ScreenState
          message="登录后，每天打开每日一猫就会记下一天。"
          actionLabel="登录"
          onAction={() => router.push("/sign-in")}
        />
      </Page>
    );
  }

  return (
    <Page title="每日打卡">
      {failed ? (
        <LoadFailed message="每日打卡暂时打不开。" onRetry={load} />
      ) : summary === null ? (
        <View className="gap-section" accessibilityLabel="正在加载每日打卡">
          <View className="flex-row gap-row">
            <Skeleton className="h-20 flex-1 rounded-tile" />
            <Skeleton className="h-20 flex-1 rounded-tile" />
          </View>
          <Skeleton className="h-96 w-full rounded-card" />
        </View>
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <View className="gap-row">
            <View className={stacked ? "gap-row" : "flex-row gap-row"}>
              <StatTile icon={CalendarHeart} label="累计来过" value={`${summary.totalVisitDays.toLocaleString("zh-CN")} 天`} />
              <StatTile icon={CalendarDays} label="本月来过" value={`${summary.thisMonth.visitDays} 天`} />
            </View>
            {summary.visitedToday ? (
              <View className="flex-row items-center justify-center gap-hair-gap" accessibilityLiveRegion="polite">
                <Icon icon={Check} size="footnote" tone="tint" />
                <Text variant="footnote" className="text-primary">
                  今天来过了
                </Text>
              </View>
            ) : (
              <View className="gap-hair-gap">
                <Button variant="tinted" onPress={() => router.push("/daily")}>
                  <Text>去看每日一猫</Text>
                </Button>
                <Text variant="footnote" className="text-center text-muted-foreground">
                  打开每日一猫，今天就算来过
                </Text>
              </View>
            )}
          </View>
          <MonthCard summary={summary} busy={busy} onDay={onDay} />
          {problem || notice ? (
            <Text
              variant="footnote"
              className={problem ? "px-inset text-destructive" : "px-inset text-muted-foreground"}
              accessibilityLiveRegion="polite"
            >
              {problem ? FAILURE_COPY[problem] : notice}
            </Text>
          ) : null}
          <LeaveSection
            summary={summary}
            busy={busy}
            onCancel={(day) => void change(() => cancelLeave(day), selectionHaptic, `${dayHeading(day)}的假取消了。`)}
            onRetro={(day) => void change(() => takeLeave(day), successHaptic, `${dayHeading(day)}补请好了。`)}
          />
        </Animated.View>
      )}
    </Page>
  );
}
