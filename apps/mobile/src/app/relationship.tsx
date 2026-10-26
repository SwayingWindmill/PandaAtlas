import { useLocalSearchParams } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, listMeta, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { type Relationship, relate } from "@/features/relationship/relationship";
import { loadKinship } from "@/features/relationship/sources";
import { cn } from "@/lib/utils";

type Kinship = Awaited<ReturnType<typeof loadKinship>>;
type SlotKey = "first" | "second";

const SLOT_LABEL: Record<SlotKey, string> = { first: "第一只", second: "第二只" };

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
      className={cn(
        "flex-1 gap-0.5 rounded-lg border-hairline border-input p-4 active:bg-accent",
        active && "border-highlight-foreground bg-highlight-soft",
      )}
    >
      <Text variant="small" className="text-muted-foreground">
        {SLOT_LABEL[slot]}
      </Text>
      <Text className={cn("font-bold", !panda && "text-muted-foreground")} numberOfLines={1}>
        {panda ? panda.name : "选一只熊猫"}
      </Text>
    </Pressable>
  );
}

function Picker({ pandas, onPick }: { pandas: PandaListItem[]; onPick: (panda: PandaListItem) => void }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchPandas(pandas, deferred).slice(0, 20), [pandas, deferred]);
  return (
    <View className="gap-2">
      <SearchField value={query} onChange={setQuery} label="搜索要选的熊猫" autoFocus />
      <View>
        {results.map((panda, index) => {
          const meta = listMeta(panda);
          return (
            <Pressable
              key={panda.id}
              onPress={() => onPick(panda)}
              role="button"
              accessibilityLabel={`选${panda.name}`}
              className={cn(
                "gap-0.5 border-t-hairline border-border py-3 active:bg-accent",
                index === results.length - 1 && "border-b-hairline",
              )}
            >
              <Text className="font-bold">{panda.name}</Text>
              {meta ? <Text variant="muted">{meta}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
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
    return <Text className="text-muted-foreground">按公开的谱系记录，没有找到它们之间的亲缘关系。</Text>;
  }
  return (
    <View className="gap-4" accessibilityLiveRegion="polite">
      <Text variant="h2">
        {relationship.term
          ? `${second.name}是${first.name}的${relationship.term}`
          : `${second.name}和${first.name}有亲缘联系`}
      </Text>
      <View>
        <Text className="py-2 font-bold">{first.name}</Text>
        {relationship.steps.map((step) => {
          const panda = names.get(step.pandaId);
          const name = panda?.name ?? "未公开的熊猫";
          return (
            <Pressable
              key={step.pandaId}
              disabled={!panda}
              onPress={() => panda && openPanda(panda.slug)}
              role="button"
              accessibilityLabel={`${step.label}：${name}`}
              className="flex-row items-center gap-3 border-t-hairline border-border py-3 active:bg-accent"
            >
              <Text className="w-16 text-highlight-foreground">{`↓ ${step.label}`}</Text>
              <Text className="min-w-0 flex-1 font-bold" numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="muted">按公开的谱系记录推算，每一步都是一条父母与孩子的关系。</Text>
    </View>
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

  return (
    <Page label="查关系" title="两只熊猫是什么关系？" keyboardShouldPersistTaps="handled">
      {failed ? (
        <View className="items-start gap-3 rounded-lg bg-muted p-5">
          <Text>谱系暂时打不开。</Text>
          <Button
            onPress={() => {
              setFailed(false);
              load();
            }}
          >
            <Text>重试</Text>
          </Button>
        </View>
      ) : !kinship ? (
        <Skeleton className="h-40 w-full" accessibilityLabel="正在加载谱系" />
      ) : (
        <>
          <View className="flex-row gap-2">
            <Slot slot="first" panda={first} active={picking === "first"} onPress={() => setPicking("first")} />
            <Slot slot="second" panda={second} active={picking === "second"} onPress={() => setPicking("second")} />
          </View>
          {picking ? (
            <Picker key={picking} pandas={kinship.pandas} onPick={pick} />
          ) : first && second ? (
            first.id === second.id ? (
              <Text className="text-muted-foreground">选了同一只熊猫，换一只看看。</Text>
            ) : (
              <Result first={first} second={second} relationship={relationship} names={names} />
            )
          ) : null}
        </>
      )}
    </Page>
  );
}
