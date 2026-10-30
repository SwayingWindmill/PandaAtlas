import { useLocalSearchParams } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chevron, ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { PawPrint } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, listMeta, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { type Relationship, relate } from "@/features/relationship/relationship";
import { loadKinship } from "@/features/relationship/sources";
import { cn } from "@/lib/utils";

type Kinship = Awaited<ReturnType<typeof loadKinship>>;
type SlotKey = "first" | "second";

const SLOT_LABEL: Record<SlotKey, string> = { first: "第一只", second: "第二只" };
const AVATAR = 56;
/** In the chain, the line runs down the middle of the 44pt avatars. */
const CHAIN_AVATAR = 44;
const LINE = { width: 2, marginLeft: CHAIN_AVATAR / 2 - 1 } as const;

/** One of the two pandas being compared: a portrait, or an empty ring until one is chosen. */
function Slot({
  slot,
  panda,
  active,
  onPress,
}: {
  slot: SlotKey;
  panda: PandaListItem | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={`${SLOT_LABEL[slot]}，${panda ? panda.name : "未选"}`}
      accessibilityState={{ selected: active }}
      className={cn(
        "min-w-0 flex-1 items-center gap-stack-tight rounded-tile border-2 bg-card px-row py-inset active:bg-accent",
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
      <View className="items-center gap-hair-gap self-stretch">
        <Text variant="footnote" className="text-muted-foreground">
          {SLOT_LABEL[slot]}
        </Text>
        <Text variant="headline" className={cn("text-center", !panda && "text-muted-foreground")} numberOfLines={2}>
          {panda ? panda.name : "选一只熊猫"}
        </Text>
      </View>
    </Pressable>
  );
}

function Picker({ pandas, onPick }: { pandas: PandaListItem[]; onPick: (panda: PandaListItem) => void }) {
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

/** A panda in the chain: its avatar on the line, the name beside it, and a tap opens it. */
function ChainPanda({ panda, name, label }: { panda: PandaListItem | undefined; name: string; label: string }) {
  return (
    <Pressable
      disabled={!panda}
      onPress={() => panda && openPanda(panda.slug)}
      role="button"
      accessibilityLabel={label}
      className="min-h-11 flex-row items-center gap-row rounded-control active:bg-accent"
    >
      {panda ? (
        <PandaThumb pandaId={panda.id} name={panda.name} size={CHAIN_AVATAR} shape="round" />
      ) : (
        <View className="rounded-full bg-secondary" style={{ width: CHAIN_AVATAR, height: CHAIN_AVATAR }} />
      )}
      <Text variant="headline" className={cn("min-w-0 flex-1", !panda && "text-muted-foreground")} numberOfLines={2}>
        {name}
      </Text>
      {panda ? <Chevron /> : null}
    </Pressable>
  );
}

function Result({
  first,
  second,
  relationship,
  names,
}: {
  first: PandaListItem;
  second: PandaListItem;
  relationship: Relationship | null;
  names: Map<string, PandaListItem>;
}) {
  if (!relationship) {
    return <ScreenState message="按公开的谱系记录，没有找到它们之间的亲缘关系。" className="py-stack" />;
  }
  return (
    <Animated.View entering={PAGE_ENTER} className="gap-stack" accessibilityLiveRegion="polite">
      <Text variant="title">
        {relationship.term
          ? `${second.name}是${first.name}的${relationship.term}`
          : `${second.name}和${first.name}有亲缘联系`}
      </Text>
      <View className="rounded-card bg-card p-inset" style={{ borderCurve: "continuous" }}>
        <ChainPanda panda={first} name={first.name} label={first.name} />
        {relationship.steps.map((step) => {
          const panda = names.get(step.pandaId);
          const name = panda?.name ?? "未公开的熊猫";
          return (
            <View key={step.pandaId}>
              {/* The link between two pandas: a line down from the one above, named by the step. */}
              <View className="min-h-9 flex-row items-center gap-row" accessible={false}>
                <View className="self-stretch rounded-full bg-border" style={LINE} />
                <Text variant="footnote" className="text-muted-foreground" style={{ marginLeft: CHAIN_AVATAR / 2 - 1 }}>
                  {step.label}
                </Text>
              </View>
              <ChainPanda panda={panda} name={name} label={`${step.label}：${name}`} />
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

export default function RelationshipScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [kinship, setKinship] = useState<Kinship | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Record<SlotKey, PandaListItem | null>>({ first: null, second: null });
  const [picking, setPicking] = useState<SlotKey | null>(null);

  const load = useCallback(() => {
    loadKinship()
      .then((loaded) => {
        setKinship(loaded);
        const preset = from ? (loaded.pandas.find((panda) => panda.slug === from) ?? null) : null;
        setPicked((current) => ({ ...current, first: current.first ?? preset }));
        setPicking((current) => current ?? (preset ? "second" : "first"));
      })
      .catch(() => setFailed(true));
  }, [from]);
  useEffect(load, [load]);

  const names = useMemo(() => new Map(kinship?.pandas.map((panda) => [panda.id, panda])), [kinship]);
  const { first, second } = picked;
  const relationship = useMemo(
    () => (kinship && first && second ? relate(kinship.graph, names, first.id, second.id) : null),
    [kinship, names, first, second],
  );

  function pick(panda: PandaListItem) {
    if (!picking) return;
    const next = { ...picked, [picking]: panda };
    setPicked(next);
    setPicking(next.first ? (next.second ? null : "second") : "first");
  }

  function retry() {
    setFailed(false);
    load();
  }

  return (
    <Page label="选两只熊猫，按公开的谱系找出它们的关系。" title="查关系" keyboardShouldPersistTaps="handled">
      {failed ? (
        <LoadFailed message="谱系暂时打不开。" onRetry={retry} />
      ) : !kinship ? (
        <View className="gap-stack" accessibilityLabel="正在加载谱系">
          <View className="flex-row gap-row">
            <Skeleton className="h-36 flex-1 rounded-tile" />
            <Skeleton className="h-36 flex-1 rounded-tile" />
          </View>
          <Skeleton className="h-11 w-full rounded-control" />
        </View>
      ) : (
        <>
          <View className="flex-row items-center gap-stack-tight">
            <Slot slot="first" panda={first} active={picking === "first"} onPress={() => setPicking("first")} />
            <Text variant="subheadline" className="text-muted-foreground" accessible={false}>
              和
            </Text>
            <Slot slot="second" panda={second} active={picking === "second"} onPress={() => setPicking("second")} />
          </View>
          {picking ? (
            <Picker key={picking} pandas={kinship.pandas} onPick={pick} />
          ) : first && second ? (
            first.id === second.id ? (
              <ScreenState message="选了同一只熊猫，换一只看看。" className="py-stack" />
            ) : (
              <Result first={first} second={second} relationship={relationship} names={names} />
            )
          ) : null}
        </>
      )}
    </Page>
  );
}
