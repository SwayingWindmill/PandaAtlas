import { router } from "expo-router";
import { Fragment, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Platform, Pressable, View } from "react-native";

import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Ellipsis, MapPin } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { Text } from "@/components/ui/text";
import { openPanda } from "@/features/pandas/panda-row";
import type { Evidence } from "@/features/timeline/timeline";
import { selectionHaptic } from "@/lib/haptics";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

import { type Memory, ownRecord } from "./on-this-day";

/** The row's photo, and where the separator under it starts: under the text, past the photo. */
const PHOTO = 56;
const SEPARATOR_INSET = { marginLeft: 16 + PHOTO + 12 } as const;
const STACKED_INSET = { marginLeft: 16 } as const;

/** "出处 上野动物园" for a published source, or where the fan's own record comes from. */
export function sourceLine(memory: Memory, source: Pick<Evidence, "publisher"> | undefined): string | null {
  if (source) return `出处 ${source.publisher}`;
  return ownRecord(memory);
}

/** 少显示这只 for a panda, 少显示这里 for a place. */
export function lessLabel(memory: Memory): string {
  return memory.subject.kind === "panda" ? "少显示这只" : "少显示这里";
}

function open(memory: Memory) {
  const { subject } = memory;
  if (subject.kind === "panda" && subject.slug) openPanda(subject.slug);
  else if (subject.kind === "place" && subject.slug) router.push({ pathname: "/places/[slug]", params: { slug: subject.slug } });
}

function Thumb({ memory }: { memory: Memory }) {
  if (memory.subject.kind === "panda") return <PandaThumb pandaId={memory.subject.id} name={memory.subject.name} size={PHOTO} />;
  // A place has no cover: its pin, on the same fill a panda without a photo gets.
  return (
    <View
      className="items-center justify-center rounded-control bg-secondary"
      style={{ width: PHOTO, height: PHOTO, borderCurve: "continuous" }}
    >
      <Icon icon={MapPin} size="title3" />
    </View>
  );
}

/**
 * 那年今天's memories as one inset group: the photo, the name, the sentence and where it comes from, and a
 * trailing ••• for 少显示 and 关闭, as Photos puts 减少展示 on a memory. iOS asks with the system action sheet;
 * elsewhere the two choices open under the row.
 */
export function MemoryGroup({
  memories,
  sources,
  onLess,
  onOff,
}: {
  memories: Memory[];
  sources: Map<string, Evidence>;
  onLess: (memory: Memory) => void;
  onOff: () => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  // At accessibility sizes, or in a window as narrow as 200% browser zoom, the photo goes above the words,
  // which then take the row's whole width.
  const stacked = useStacked();
  const inset = stacked ? STACKED_INSET : SEPARATOR_INSET;

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

  return (
    <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
      {memories.map((memory, index) => {
        const from = sourceLine(memory, sources.get(memory.key));
        const opened = menu === memory.key;
        const name = memory.subject.name;
        return (
          <Fragment key={memory.key}>
            <View className={cn("flex-row", stacked ? "items-start" : "items-center")}>
              <Pressable
                onPress={() => open(memory)}
                role="link"
                accessibilityLabel={[name, memory.text, from].filter(Boolean).join("，")}
                className={cn(
                  "min-h-11 min-w-0 flex-1 gap-row py-stack-tight pl-inset active:bg-accent",
                  stacked ? "items-start" : "flex-row items-center",
                )}
                style={{ borderCurve: "continuous" }}
              >
                <Thumb memory={memory} />
                <View className="min-w-0 flex-1 gap-hair-gap">
                  <Text variant="headline" numberOfLines={stacked ? undefined : 1}>
                    {name}
                  </Text>
                  <Text variant="subheadline">{memory.text}</Text>
                  {from ? (
                    <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
                      {from}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                onPress={() => more(memory)}
                role="button"
                accessibilityLabel={`更多，${name}`}
                accessibilityState={Platform.OS === "ios" ? undefined : { expanded: opened }}
                className="mr-hair-gap size-11 items-center justify-center rounded-pill active:bg-accent"
                style={{ borderCurve: "continuous" }}
              >
                <Icon icon={Ellipsis} tone="secondary" />
              </Pressable>
            </View>
            {opened ? (
              <View className="flex-row flex-wrap gap-stack-tight pb-stack-tight pr-inset" style={inset}>
                <Choice label={lessLabel(memory)} onPress={() => onLess(memory)} />
                <Choice label="关闭那年今天" onPress={onOff} />
              </View>
            ) : null}
            {index === memories.length - 1 ? null : <View className="bg-border" style={[{ height: HAIRLINE }, inset]} />}
          </Fragment>
        );
      })}
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

/** "已少显示宝力" with 撤销, in the place of what changed, until the fan leaves the screen. */
export function UndoLine({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-stack-tight px-inset" accessibilityLiveRegion="polite">
      <Text variant="footnote" className="text-muted-foreground">
        {message}
      </Text>
      <Pressable onPress={onUndo} role="button" accessibilityLabel={`撤销，${message}`} hitSlop={8} className="min-h-11 justify-center active:opacity-60">
        <Text variant="footnote" className="text-primary">
          撤销
        </Text>
      </Pressable>
    </View>
  );
}
