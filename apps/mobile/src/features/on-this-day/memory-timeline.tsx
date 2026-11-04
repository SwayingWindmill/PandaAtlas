import { Fragment, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Platform, Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { Baby, Cake, Eye, House, type LucideIcon, MapPin, Plane, ScanFace } from "@/components/icons";
import { SourceBadge } from "@/components/source-badge";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import type { Evidence } from "@/features/timeline/timeline";
import { selectionHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

import { Thumb, lessLabel, openMemory, sourceLine } from "./memory-group";
import type { Memory, MemoryKind } from "./on-this-day";
import { datePart, titleOn, yearsPart } from "./range";

const PHOTO = 40;
const DOT = 10;

const KIND_ICON: Partial<Record<MemoryKind, LucideIcon>> = {
  home: Plane,
  arrival: House,
  birthday: Cake,
  month: Baby,
  hundred: Baby,
  seen: Eye,
  recognized: ScanFace,
  visit: MapPin,
};

/**
 * The memories of 本周 or 本月 as one timeline card (v4 `14-on-this-day`): a rail with a dot per memory, the
 * nearest one tinted, the day and year with the kind's glyph and N 周年 over a bold line that says who it is
 * about, and the photo at the end. The sources follow under the card. 少显示 and 关闭 are a long press away
 * (the system action sheet on iOS, two choices under the row elsewhere) and an accessibility action.
 */
export function MemoryTimeline({
  memories,
  dayOf,
  today,
  sources,
  onLess,
  onOff,
}: {
  memories: Memory[];
  dayOf: Map<string, string>;
  today: string;
  sources: Map<string, Evidence>;
  onLess: (memory: Memory) => void;
  onOff: () => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const { rail } = component.timeline;

  function more(memory: Memory) {
    selectionHaptic();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: memory.subject.name, options: [lessLabel(memory), "关闭那年今天", "取消"], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) onLess(memory);
          if (index === 1) onOff();
        },
      );
      return;
    }
    const next = menu === memory.key ? null : memory.key;
    setMenu(next);
    if (next) AccessibilityInfo.announceForAccessibility(`${lessLabel(memory)}，关闭那年今天`);
  }

  const publishers = [...new Set(memories.flatMap((memory) => (sources.get(memory.key) ? [sources.get(memory.key)!.publisher] : [])))];

  return (
    <View className="gap-row">
      <View className="rounded-group bg-card px-inset py-inset" style={{ borderCurve: "continuous" }}>
        {memories.map((memory, index) => {
          const day = dayOf.get(memory.key) ?? today;
          const first = index === 0;
          const last = index === memories.length - 1;
          const title = titleOn(memory, day, today);
          const years = yearsPart(memory);
          const kind = KIND_ICON[memory.kind];
          const from = sourceLine(memory, sources.get(memory.key));
          const opened = menu === memory.key;
          return (
            <Fragment key={memory.key}>
              <Pressable
                onPress={() => openMemory(memory)}
                onLongPress={() => more(memory)}
                role="link"
                accessibilityLabel={[datePart(memory, day), years, title, from].filter(Boolean).join("，")}
                accessibilityHint="长按可以少显示或关闭那年今天"
                accessibilityActions={[{ name: "less", label: lessLabel(memory) }, { name: "off", label: "关闭那年今天" }]}
                onAccessibilityAction={(event) => (event.nativeEvent.actionName === "less" ? onLess(memory) : onOff())}
                className="flex-row gap-row active:opacity-70"
              >
                <View className="items-center" style={{ width: DOT * 2 }}>
                  <View className={cn("bg-border", first && "opacity-0")} style={{ width: rail, height: 6 }} />
                  <View
                    className={cn("rounded-pill", first ? "border-highlight-soft bg-graphic" : "bg-tertiary-foreground")}
                    style={first ? { width: DOT + 8, height: DOT + 8, borderWidth: 4 } : { width: DOT, height: DOT, marginVertical: 4 }}
                  />
                  <View className={cn("flex-1 bg-border", last && "opacity-0")} style={{ width: rail }} />
                </View>
                <View className={cn("min-w-0 flex-1 flex-row items-center gap-row", !last && "pb-stack")}>
                  <View className="min-w-0 flex-1 gap-hair-gap">
                    <View className="flex-row flex-wrap items-center gap-x-1.5">
                      <Text variant="footnote" className={cn("font-semibold tabular-nums", first ? "text-primary" : "text-muted-foreground")}>
                        {datePart(memory, day)}
                      </Text>
                      {kind ? <Icon icon={kind} size="footnote" /> : null}
                      {years ? (
                        <Text variant="footnote" className="text-muted-foreground">
                          {years}
                        </Text>
                      ) : null}
                    </View>
                    <Text variant="subheadline" className="font-semibold">
                      {title}
                    </Text>
                  </View>
                  <Thumb memory={memory} size={PHOTO} />
                </View>
              </Pressable>
              {opened ? (
                <View className="flex-row flex-wrap gap-stack-tight pb-stack" style={{ marginLeft: DOT * 2 + 12 }}>
                  <Choice label={lessLabel(memory)} onPress={() => onLess(memory)} />
                  <Choice label="关闭那年今天" onPress={onOff} />
                </View>
              ) : null}
            </Fragment>
          );
        })}
      </View>
      {publishers.length > 0 ? (
        <View className="flex-row flex-wrap gap-x-row gap-y-hair-gap px-inset">
          {publishers.map((publisher) => (
            <SourceBadge key={publisher} name={publisher} accessibilityLabel={`出处 ${publisher}`} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Choice({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      className="min-h-11 justify-center rounded-pill bg-secondary px-inset active:opacity-60"
      style={{ borderCurve: "continuous" }}
    >
      <Text variant="subheadline" className="text-primary">
        {label}
      </Text>
    </Pressable>
  );
}
