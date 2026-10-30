import { useDeferredValue, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { PawPrint } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Text } from "@/components/ui/text";
import { type PandaListItem, listMeta, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { cn } from "@/lib/utils";

// Choosing two pandas, shared by 查关系 and 比一比: two slots side by side, and a searchable list under the
// slot being filled. The list is the plain index in its own order; nothing is suggested for the user.

export type SlotKey = "first" | "second";
export type Pair = Record<SlotKey, PandaListItem | null>;

const SLOT_LABEL: Record<SlotKey, string> = { first: "第一只", second: "第二只" };
const AVATAR = 56;

/** The slot to fill after a pick: the first empty one, or none once both are chosen. */
export function nextSlot(pair: Pair): SlotKey | null {
  if (!pair.first) return "first";
  if (!pair.second) return "second";
  return null;
}

/** One of the two pandas: a portrait, or an empty ring until one is chosen. */
function Slot({
  slot,
  panda,
  active,
  stacked,
  onPress,
}: {
  slot: SlotKey;
  panda: PandaListItem | null;
  active: boolean;
  stacked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={`${SLOT_LABEL[slot]}，${panda ? panda.name : "未选"}`}
      accessibilityState={{ selected: active }}
      className={cn(
        "min-w-0 items-center gap-stack-tight rounded-tile border-2 bg-card px-row py-inset active:bg-accent",
        stacked ? "flex-row self-stretch" : "flex-1",
        active ? "border-primary" : "border-card",
      )}
      style={{ borderCurve: "continuous" }}
    >
      {panda ? (
        <PandaThumb pandaId={panda.id} name={panda.name} size={AVATAR} shape="round" />
      ) : (
        <View
          className="items-center justify-center rounded-full bg-secondary"
          style={{ width: AVATAR, height: AVATAR }}
        >
          <Icon icon={PawPrint} tone="secondary" />
        </View>
      )}
      <View className={cn("gap-hair-gap", stacked ? "min-w-0 flex-1" : "items-center self-stretch")}>
        <Text variant="footnote" className="text-muted-foreground">
          {SLOT_LABEL[slot]}
        </Text>
        <Text
          variant="headline"
          className={cn(!stacked && "text-center", !panda && "text-muted-foreground")}
          numberOfLines={stacked ? undefined : 2}
        >
          {panda ? panda.name : "选一只熊猫"}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The two slots with 和 between them; tapping a slot makes it the one the list fills. At accessibility text
 * sizes the slots stack, portrait beside the name, so neither label is cut.
 */
export function PairSlots({
  pair,
  picking,
  onSlot,
}: {
  pair: Pair;
  picking: SlotKey | null;
  onSlot: (slot: SlotKey) => void;
}) {
  const stacked = useStacked();
  return (
    <View className={cn("items-center gap-stack-tight", !stacked && "flex-row")}>
      <Slot
        slot="first"
        panda={pair.first}
        active={picking === "first"}
        stacked={stacked}
        onPress={() => onSlot("first")}
      />
      <Text variant="subheadline" className="text-muted-foreground" accessible={false}>
        和
      </Text>
      <Slot
        slot="second"
        panda={pair.second}
        active={picking === "second"}
        stacked={stacked}
        onPress={() => onSlot("second")}
      />
    </View>
  );
}

/** Search and a list of the first matches; a row chooses, so it has no chevron. */
export function PandaPicker({ pandas, onPick }: { pandas: PandaListItem[]; onPick: (panda: PandaListItem) => void }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchPandas(pandas, deferred).slice(0, 20), [pandas, deferred]);
  return (
    <View className="gap-stack">
      <SearchField value={query} onChange={setQuery} label="搜索要选的熊猫" autoFocus />
      {results.length > 0 ? (
        <ListSection title={deferred ? undefined : "从这些熊猫里选，或搜名字"}>
          {results.map((panda, index) => (
            <ListCell
              key={panda.id}
              label={panda.name}
              detail={listMeta(panda) || undefined}
              leading={<PandaThumb pandaId={panda.id} name={panda.name} size={36} shape="round" />}
              onPress={() => onPick(panda)}
              accessibilityLabel={`选${panda.name}`}
              chevron={false}
              last={index === results.length - 1}
            />
          ))}
        </ListSection>
      ) : (
        <ScreenState message="没有找到这只熊猫。" className="py-stack" />
      )}
    </View>
  );
}
