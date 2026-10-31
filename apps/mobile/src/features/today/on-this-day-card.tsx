import { useState } from "react";
import { View } from "react-native";

import { SectionHeader } from "@/components/section-header";
import { MemoryGroup, UndoLine } from "@/features/on-this-day/memory-group";
import { type Memory, type MemoryPrefs, pickForCard, visibleMemories } from "@/features/on-this-day/on-this-day";
import { useMilestonePrefs } from "@/features/milestones/prefs";
import { setMemoryPrefs, showLess, useMemoryPrefs } from "@/features/on-this-day/prefs";
import { useMemories } from "@/features/on-this-day/use-memories";
import { tapHaptic } from "@/lib/haptics";

/** Memories the card shows; the rest are on the 那年今天 page. */
const SHOWN = 3;

interface Undo {
  message: string;
  before: MemoryPrefs;
}

/**
 * 那年今天 on 今天: up to three things that happened on this day in an earlier year, from records with a
 * date to the day. It is there only on a day that has one, and says nothing otherwise. A panda that has died
 * is not remembered here (DECEASED_POLICY). 少显示 and 关闭 take effect at once, with 撤销 under the heading, where the eye already is.
 */
export function OnThisDayCard() {
  const prefs = useMemoryPrefs();
  const milestones = useMilestonePrefs();
  const { memories, sources } = useMemories();
  const [undo, setUndo] = useState<Undo | null>(null);

  if (!prefs || !milestones || !memories) return null;

  function change(next: MemoryPrefs, message: string) {
    if (!prefs) return;
    tapHaptic();
    setUndo({ message, before: prefs });
    setMemoryPrefs(next);
  }
  const undoLine = undo ? (
    <UndoLine
      message={undo.message}
      onUndo={() => {
        tapHaptic();
        setMemoryPrefs(undo.before);
        setUndo(null);
      }}
    />
  ) : null;

  if (prefs.off) return undoLine;
  const shown = visibleMemories(memories, prefs, !milestones.off);
  if (shown.length === 0) return undoLine;
  const more = shown.length > SHOWN;

  return (
    <View className="gap-row">
      <SectionHeader
        title="那年今天"
        action={more ? { label: "全部", href: "/on-this-day", accessibilityLabel: `那年今天全部 ${shown.length} 条` } : undefined}
      />
      {undoLine}
      <MemoryGroup
        memories={pickForCard(shown, SHOWN)}
        sources={sources}
        onLess={(memory: Memory) => change(showLess(prefs, memory.subject.key), `已少显示${memory.subject.name}。`)}
        onOff={() => change({ ...prefs, off: true }, "已关闭那年今天，可以在设置里重新打开。")}
      />
    </View>
  );
}
