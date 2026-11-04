import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, SwitchRow } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Check } from "@/components/icons";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import {
  type ChallengeState,
  fallbackTitle,
  monthKey,
  progress,
  setJoined,
  TASK_ROUTES,
  themeFor,
  toggleTask,
} from "@/features/challenges/challenge";
import { saveChallengeState, useChallengeState } from "@/features/challenges/prefs";
import { localToday } from "@/features/engagement/seen";
import { tapHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** An editorial slot still empty: visible in development only, so production shows nothing rather than a placeholder. */
function Slot({ name }: { name: string }) {
  if (!__DEV__) return null;
  return (
    <Text variant="footnote" className="text-tertiary-foreground">
      {`〔待编辑：${name}〕`}
    </Text>
  );
}

/** The month's progress as one bold tile, after Apple Fitness's monthly challenge badge: number first. */
function ProgressCard({ title, done, total }: { title: string; done: number; total: number }) {
  const finished = done === total;
  return (
    <View
      accessibilityLabel={`${title}，完成 ${done} / ${total}`}
      className="gap-stack-tight rounded-tile bg-primary p-stack"
      style={{ borderCurve: "continuous" }}
    >
      <Text variant="headline" className="text-primary-foreground">
        {title}
      </Text>
      <Text variant="display" className="tabular-nums text-primary-foreground">
        {`${done}/${total}`}
      </Text>
      <View className="h-2 overflow-hidden rounded-full bg-primary-foreground/20">
        <View className="h-full rounded-full bg-primary-foreground" style={{ width: `${(done / total) * 100}%` }} />
      </View>
      {finished ? (
        <Text variant="subheadline" className="text-primary-foreground">
          本月完成
        </Text>
      ) : null}
    </View>
  );
}

function CheckBox({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  const ink = useCSSVariable("--color-primary-foreground") as string | undefined;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        tapHaptic();
        onToggle();
      }}
      className="size-11 items-center justify-center"
    >
      <View
        className={cn(
          "size-6 items-center justify-center rounded-full border-2",
          on ? "border-primary bg-primary" : "border-muted-foreground",
        )}
      >
        {on ? <Icon icon={Check} size="footnote" color={ink} /> : null}
      </View>
    </Pressable>
  );
}

/** 月度主题挑战: opt-in, this month only, kept on this device. */
export default function ChallengeScreen() {
  const state = useChallengeState();
  const month = monthKey(localToday());
  const theme = themeFor(month);
  const title = theme.title ?? fallbackTitle(month);

  if (!state) {
    return (
      <Page title={title}>
        <Skeleton className="h-40 rounded-tile" />
      </Page>
    );
  }
  const joined = state.joined.includes(month);
  const save = (next: ChallengeState) => saveChallengeState(next);
  const { done, total } = progress(state, month);
  const doneIds = state.done[month] ?? [];

  return (
    <Page title={title}>
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        {theme.title === null ? <Slot name={`${month} 主题名`} /> : null}
        {theme.intro ? (
          <Text variant="subheadline" className="text-muted-foreground">
            {theme.intro}
          </Text>
        ) : (
          <Slot name={`${month} 一句话介绍`} />
        )}
        <ListSection footer="只存在这台设备上">
          <SwitchRow label="参加本月挑战" value={joined} onChange={(on) => save(setJoined(state, month, on))} />
        </ListSection>
        {joined ? (
          <>
            <ProgressCard title={title} done={done} total={total} />
            <ListSection title="任务">
              {theme.tasks.map((task, index) => {
                const route = TASK_ROUTES[task.kind];
                const on = doneIds.includes(task.id);
                return (
                  <ListCell
                    key={task.id}
                    label={route.label}
                    href={route.href as never}
                    role="link"
                    accessibilityHint="打开对应页面"
                    leading={
                      <CheckBox
                        on={on}
                        label={`${route.label}，${on ? "已完成" : "未完成"}`}
                        onToggle={() => save(toggleTask(state, month, task.id))}
                      />
                    }
                    last={index === theme.tasks.length - 1}
                  />
                );
              })}
            </ListSection>
          </>
        ) : null}
      </Animated.View>
    </Page>
  );
}
