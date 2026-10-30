import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { localToday, shortDay } from "@/features/engagement/seen";
import { MemoryGroup, UndoLine } from "@/features/on-this-day/memory-group";
import { GROUPS, type MemoryPrefs, visibleMemories } from "@/features/on-this-day/on-this-day";
import { useMilestonePrefs } from "@/features/milestones/prefs";
import { setMemoryPrefs, showLess, useMemoryPrefs } from "@/features/on-this-day/prefs";
import { OnThisDaySettings } from "@/features/on-this-day/settings-section";
import { useMemories } from "@/features/on-this-day/use-memories";
import { tapHaptic } from "@/lib/haptics";

/**
 * 那年今天: everything the card on 今天 has for this day, grouped as 你的记录, 回国, 来到新家, 满月和百天 and 生日,
 * with its switches at the foot. A panda that has died is remembered on its own page instead.
 */
export default function OnThisDayScreen() {
  const prefs = useMemoryPrefs();
  const milestones = useMilestonePrefs();
  const { memories, sources, failed, reload } = useMemories();
  const [undo, setUndo] = useState<{ message: string; before: MemoryPrefs } | null>(null);
  const day = shortDay(localToday());

  if (!memories || !prefs || !milestones) {
    return (
      <Page title="那年今天" label={day}>
        {failed ? <LoadFailed message="那年今天暂时打不开。" onRetry={reload} /> : <OnThisDaySkeleton />}
      </Page>
    );
  }

  function change(next: MemoryPrefs, message: string) {
    if (!prefs) return;
    tapHaptic();
    setUndo({ message, before: prefs });
    setMemoryPrefs(next);
  }
  const shown = visibleMemories(memories, prefs, !milestones.off);

  return (
    <Page title="那年今天" label={day}>
      <Animated.View entering={PAGE_ENTER} className="gap-section">
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
        {shown.length === 0 ? (
          <ScreenState message="往年的今天没有记下的事。有确切日期和出处的生日、满月、搬家和回国，会在那一天出现在这里。" />
        ) : (
          GROUPS.map((group) => {
            const items = shown.filter((memory) => group.kinds.includes(memory.kind));
            if (items.length === 0) return null;
            return (
              <View key={group.title} className="gap-1.5">
                <Text variant="footnote" role="heading" className="px-inset text-muted-foreground">
                  {group.title}
                </Text>
                <MemoryGroup
                  memories={items}
                  sources={sources}
                  onLess={(memory) => change(showLess(prefs, memory.subject.key), `已少显示${memory.subject.name}。`)}
                  onOff={() => change({ ...prefs, off: true }, "今天页不再显示那年今天。")}
                />
              </View>
            );
          })
        )}
        <OnThisDaySettings />
      </Animated.View>
    </Page>
  );
}

/** A header and two memory rows, as the loaded page lays them out. */
function OnThisDaySkeleton() {
  return (
    <View className="gap-1.5" accessibilityLabel="正在加载那年今天">
      <Skeleton className="mx-inset h-4 w-24 rounded-control" />
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
