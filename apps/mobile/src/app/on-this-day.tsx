import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { useStacked } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Segmented } from "@/components/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_ENTER } from "@/design/motion";
import { localToday, shortDay } from "@/features/engagement/seen";
import { useMilestonePrefs } from "@/features/milestones/prefs";
import { MemoryGroup, UndoLine } from "@/features/on-this-day/memory-group";
import { type Memory, type MemoryPrefs, visibleMemories } from "@/features/on-this-day/on-this-day";
import { setMemoryPrefs, showLess, useMemoryPrefs } from "@/features/on-this-day/prefs";
import { RANGES, type Range, rangeDays, sentenceOn, whenLine } from "@/features/on-this-day/range";
import { OnThisDaySettings } from "@/features/on-this-day/settings-section";
import { useMemories } from "@/features/on-this-day/use-memories";
import { WeekHero } from "@/features/today/week-hero";
import { weekMemory } from "@/features/today/week-memory";
import { tapHaptic } from "@/lib/haptics";

/**
 * 那年今天: the anniversaries of 本周 or 本月, the nearest public one as the photo card that heads 今天, then
 * every memory of the range in date order, each with its day and its sources, and the switches at the foot.
 * A panda that has died is remembered on its own page instead.
 */
export default function OnThisDayScreen() {
  const prefs = useMemoryPrefs();
  const milestones = useMilestonePrefs();
  const [range, setRange] = useState<Range>("week");
  const { days, sources, failed, reload } = useMemories((today) => rangeDays(today, range), range);
  const [undo, setUndo] = useState<{ message: string; before: MemoryPrefs } | null>(null);
  const { width } = useWindowDimensions();
  const stacked = useStacked();
  const today = localToday();
  const label = shortDay(today);

  const control = <Segmented value={range} options={RANGES} onChange={setRange} accessibilityLabel="看哪段日子" />;

  if (!days || !prefs || !milestones) {
    return (
      <Page title="那年今天" label={label}>
        <View className="gap-section">
          {control}
          {failed ? <LoadFailed message="那年今天暂时打不开。" onRetry={reload} /> : <OnThisDaySkeleton />}
        </View>
      </Page>
    );
  }

  function change(next: MemoryPrefs, message: string) {
    if (!prefs) return;
    tapHaptic();
    setUndo({ message, before: prefs });
    setMemoryPrefs(next);
  }
  const shown = days.map((day) => ({ date: day.date, memories: visibleMemories(day.memories, prefs, !milestones.off) }));
  const dayOf = new Map(shown.flatMap((day) => day.memories.map((memory) => [memory.key, day.date] as const)));
  const memories: Memory[] = shown.flatMap((day) => day.memories);
  const hero = weekMemory(shown, shown.length);
  const heroHeight = Math.round((Math.min(width, 700) - 32) * (stacked ? 1.2 : 0.62));

  return (
    <Page title="那年今天" label={label}>
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        {control}
        {undo ? (
          <UndoLine
            message={undo.message}
            onUndo={() => {
              tapHaptic();
              setMemoryPrefs(undo.before);
              setUndo(null);
            }}
          />
        ) : null}
        {hero ? <WeekHero hero={hero} height={heroHeight} /> : null}
        {memories.length === 0 ? (
          <ScreenState
            message={`${range === "week" ? "这一周" : "这个月剩下的日子里"}没有往年记下的事。有确切日期和出处的生日、满月、搬家和回国，会在那一天出现在这里。`}
          />
        ) : (
          <MemoryGroup
            memories={memories}
            sources={sources}
            when={(memory) => whenLine(memory, dayOf.get(memory.key) ?? today, today)}
            sentence={(memory) => sentenceOn(memory, dayOf.get(memory.key) ?? today, today)}
            onLess={(memory) => change(showLess(prefs, memory.subject.key), `已少显示${memory.subject.name}。`)}
            onOff={() => change({ ...prefs, off: true }, "今天页不再显示那年今天。")}
          />
        )}
        <OnThisDaySettings />
      </Animated.View>
    </Page>
  );
}

/** The hero and two memory rows, as the loaded page lays them out. */
function OnThisDaySkeleton() {
  return (
    <View className="gap-section" accessibilityLabel="正在加载那年今天">
      <Skeleton className="h-56 w-full rounded-card" />
      <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
        {[0, 1].map((row) => (
          <View key={row} className="flex-row items-center gap-row px-inset py-stack-tight">
            <Skeleton className="rounded-control" style={{ width: 56, height: 56 }} />
            <View className="flex-1 gap-stack-tight">
              <Skeleton className="h-5 w-1/3 rounded-control" />
              <Skeleton className="h-4 w-2/3 rounded-control" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
