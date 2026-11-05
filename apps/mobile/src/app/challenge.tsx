import { type Href, router } from "expo-router";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chevron, ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Check, Trophy } from "@/components/icons";
import { Page } from "@/components/page";
import { ProgressRing } from "@/components/progress-ring";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { PAGE_ENTER } from "@/design/motion";
import {
  type ChallengeState,
  TASK_ROUTES,
  daysLeft,
  fallbackTitle,
  monthKey,
  monthName,
  pastMonths,
  progress,
  setJoined,
  themeFor,
  toggleTask,
} from "@/features/challenges/challenge";
import { useMonthThemes } from "@/features/challenges/month-themes";
import { saveChallengeState, useChallengeState } from "@/features/challenges/prefs";
import { localToday } from "@/features/engagement/seen";
import { tapHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const DISC = component.stepper.disc;
const RAIL = component.timeline.rail;

/** The month's progress (v4 `11-monthly-challenge`): a large ring with done over total, and the days left. */
function ProgressCard({ done, total, left }: { done: number; total: number; left: number }) {
  return (
    <View
      className="flex-row items-center gap-section rounded-group bg-card p-section-tight"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`完成 ${done} 项，共 ${total} 项，本月还剩 ${left} 天`}
    >
      <ProgressRing value={total > 0 ? done / total : 0} size="large" accessibilityLabel={`完成 ${done} / ${total}`}>
        <Text role="none">
          <Text variant="figure">{done}</Text>
          <Text variant="subheadline" className="font-rounded font-semibold text-muted-foreground tabular-nums">
            {`/${total}`}
          </Text>
        </Text>
      </ProgressRing>
      <View className="gap-hair-gap">
        <Text variant="footnote" className="font-semibold text-muted-foreground">
          {done === total ? "本月完成" : "还剩"}
        </Text>
        {done === total ? null : (
          <Text role="none">
            <Text variant="stat">{left}</Text>
            <Text variant="footnote" className="font-semibold">
              {" 天"}
            </Text>
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * One task: its disc on a rail (an ink check once done, its number until then), the task, and a chevron to the
 * page that does it. The disc is the checkbox; the row opens the page.
 */
function TaskRow({
  number,
  label,
  href,
  on,
  first,
  last,
  railDone,
  onToggle,
}: {
  number: number;
  label: string;
  href: Href;
  on: boolean;
  first: boolean;
  last: boolean;
  /** The rail into this row is ink: the task before it is done. */
  railDone: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="flex-row items-stretch">
      <View className="items-center" style={{ width: 44 }}>
        <View className={cn("flex-1", first ? "opacity-0" : railDone ? "bg-foreground" : "bg-border")} style={{ width: RAIL }} />
        <Pressable
          role="checkbox"
          accessibilityState={{ checked: on }}
          accessibilityLabel={`${label}，${on ? "已完成" : "未完成"}`}
          hitSlop={10}
          onPress={() => {
            tapHaptic();
            onToggle();
          }}
          className={cn("items-center justify-center rounded-pill", on ? "bg-button" : "border-2 border-tertiary-foreground")}
          style={{ width: DISC, height: DISC }}
        >
          {on ? (
            <Icon icon={Check} size="footnote" tone="onButton" strokeWidth={3} />
          ) : (
            <Text variant="footnote" className="font-rounded font-semibold text-muted-foreground tabular-nums">
              {number}
            </Text>
          )}
        </Pressable>
        <View className={cn("flex-1", last ? "opacity-0" : on ? "bg-foreground" : "bg-border")} style={{ width: RAIL }} />
      </View>
      <Pressable
        role="link"
        accessibilityHint="打开对应页面"
        onPress={() => router.push(href)}
        className="min-h-13 min-w-0 flex-1 flex-row items-center gap-row pr-inset active:opacity-60"
      >
        <Text variant="body" className={cn("min-w-0 flex-1", on ? "text-muted-foreground" : "font-semibold")}>
          {label}
        </Text>
        {on ? null : <Chevron />}
      </Pressable>
    </View>
  );
}

/** 往期: a trophy per month joined before this one, ink when every task was done. */
function Past({ months }: { months: { month: string; complete: boolean }[] }) {
  return (
    <View className="gap-row">
      <Text variant="title" role="heading">
        往期
      </Text>
      <View className="flex-row flex-wrap">
        {months.map(({ month, complete }) => (
          <View
            key={month}
            className="w-1/4 items-center gap-hair-gap py-stack-tight"
            accessible
            accessibilityLabel={`${monthName(month)}挑战，${complete ? "完成" : "未完成"}`}
          >
            <Icon icon={Trophy} size="title3" tone={complete ? "label" : "tertiary"} />
            <Text variant="footnote" className={cn("font-semibold", complete ? "text-foreground" : "text-tertiary-foreground")}>
              {monthName(month)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** 月度挑战: opt-in, a month at a time, kept on this device. */
export default function ChallengeScreen() {
  const state = useChallengeState();
  const today = localToday();
  const month = monthKey(today);
  const themes = useMonthThemes();
  const theme = themeFor(month, themes);
  const title = theme.title ?? fallbackTitle(month);

  if (!state) {
    return (
      <Page title={title} dateline="月度挑战">
        <Skeleton className="h-40 rounded-group" />
      </Page>
    );
  }
  const joined = state.joined.includes(month);
  const save = (next: ChallengeState) => saveChallengeState(next);
  const { done, total } = progress(state, month, theme);
  const doneIds = state.done[month] ?? [];
  const past = pastMonths(state, month, themes);

  return (
    <Page title={title} dateline="月度挑战">
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        {theme.intro ? (
          <Text variant="subheadline" className="text-muted-foreground">
            {theme.intro}
          </Text>
        ) : null}
        {joined ? (
          <>
            <ProgressCard done={done} total={total} left={daysLeft(today)} />
            <View className="gap-row">
              <Text variant="title" role="heading">
                任务
              </Text>
              <View className="rounded-group bg-card py-stack-tight pl-1" style={{ borderCurve: "continuous" }}>
                {theme.tasks.map((task, index) => {
                  const route = TASK_ROUTES[task.kind];
                  return (
                    <TaskRow
                      key={task.id}
                      number={index + 1}
                      label={route.label}
                      href={route.href as Href}
                      on={doneIds.includes(task.id)}
                      first={index === 0}
                      last={index === theme.tasks.length - 1}
                      railDone={index > 0 && doneIds.includes(theme.tasks[index - 1]!.id)}
                      onToggle={() => save(toggleTask(state, month, task.id))}
                    />
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <View className="gap-row">
            <ScreenState message={`${monthName(month)}有 ${theme.tasks.length} 个小任务，做完一项就点一下圆圈。只记在这台设备上。`} />
            <Button size="lg" className="rounded-pill" onPress={() => save(setJoined(state, month, true))}>
              <Text>参加{title}</Text>
            </Button>
          </View>
        )}
        {past.length > 0 ? <Past months={past} /> : null}
        {joined ? (
          <ListSection footer="只存在这台设备上">
            <ListCell label="退出本月挑战" tone="tint" chevron={false} onPress={() => save(setJoined(state, month, false))} last />
          </ListSection>
        ) : null}
      </Animated.View>
    </Page>
  );
}
