import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chevron } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { type Pair, PairSlots, PandaPicker, type SlotKey, nextSlot } from "@/features/pandas/pair-picker";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem } from "@/features/pandas/pandas";
import { type Relationship, relate } from "@/features/relationship/relationship";
import { loadKinship } from "@/features/relationship/sources";
import { cn } from "@/lib/utils";

/** In the chain, the line runs down the middle of the 44pt avatars. */
const CHAIN_AVATAR = 44;
const LINE = { width: 2, marginLeft: CHAIN_AVATAR / 2 - 1 } as const;

/** A panda in the chain: its avatar on the line, the name beside it, and a tap opens it. */
function ChainPanda({
  panda,
  name,
  label,
  onOpen,
}: {
  panda: PandaListItem | undefined;
  name: string;
  label: string;
  onOpen: (slug: string) => void;
}) {
  return (
    <Pressable
      disabled={!panda}
      onPress={() => panda && onOpen(panda.slug)}
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
  onOpen,
}: {
  first: PandaListItem;
  second: PandaListItem;
  relationship: Relationship | null;
  names: Map<string, PandaListItem>;
  onOpen: (slug: string) => void;
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
        <ChainPanda panda={first} name={first.name} label={first.name} onOpen={onOpen} />
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
              <ChainPanda panda={panda} name={name} label={`${step.label}：${name}`} onOpen={onOpen} />
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

/**
 * Pick two pandas and read how the published lineage links them. `from` starts the first slot on a panda.
 * Shown as its own screen and in the 家谱's sheet, which passes `onOpen` to leave the sheet first and
 * `onFamily` to re-centre its tree on the second panda.
 */
export function RelationshipContent({
  from,
  onOpen = openPanda,
  onFamily,
}: {
  from?: string;
  onOpen?: (slug: string) => void;
  onFamily?: (panda: PandaListItem) => void;
}) {
  const { data: kinship, isError, refetch } = useQuery({
    queryKey: ["public", "kinship"],
    queryFn: loadKinship,
    staleTime: 300_000,
    networkMode: "always",
  });
  const [chosen, setChosen] = useState<Pair>({ first: null, second: null });
  // undefined until the fan picks a slot themselves.
  const [chosenSlot, setChosenSlot] = useState<SlotKey | null | undefined>(undefined);

  // `from` fills the first slot until the fan picks another, and the picker then opens on the second.
  const preset = kinship && from ? (kinship.pandas.find((panda) => panda.slug === from) ?? null) : null;
  const picked: Pair = { first: chosen.first ?? preset, second: chosen.second };
  const picking = chosenSlot !== undefined ? chosenSlot : preset ? "second" : "first";

  const names = useMemo(() => new Map(kinship?.pandas.map((panda) => [panda.id, panda])), [kinship]);
  const { first, second } = picked;
  const relationship = useMemo(
    () => (kinship && first && second ? relate(kinship.graph, names, first.id, second.id) : null),
    [kinship, names, first, second],
  );

  function pick(panda: PandaListItem) {
    if (!picking) return;
    const next = { ...picked, [picking]: panda };
    setChosen(next);
    setChosenSlot(nextSlot(next));
  }

  if (isError && !kinship) return <LoadFailed message="谱系暂时打不开。" onRetry={() => void refetch()} />;
  if (!kinship) {
    return (
      <View className="gap-stack" accessibilityLabel="正在加载谱系">
        <View className="flex-row gap-row">
          <Skeleton className="h-36 flex-1 rounded-tile" />
          <Skeleton className="h-36 flex-1 rounded-tile" />
        </View>
        <Skeleton className="h-11 w-full rounded-control" />
      </View>
    );
  }
  return (
    <>
      <PairSlots pair={picked} picking={picking} onSlot={setChosenSlot} />
      {picking ? (
        <PandaPicker key={picking} pandas={kinship.pandas} onPick={pick} />
      ) : first && second ? (
        first.id === second.id ? (
          <ScreenState message="选了同一只熊猫，换一只看看。" className="py-stack" />
        ) : (
          <>
            <Result first={first} second={second} relationship={relationship} names={names} onOpen={onOpen} />
            <View className="flex-row flex-wrap gap-row">
              <Button variant="secondary" onPress={() => setChosen({ first: second, second: first })}>
                <Text>交换熊猫</Text>
              </Button>
              {/* The sheet's tree already shows `from`, so only another panda gets a family to move to. */}
              {onFamily && second.slug !== from ? (
                <Button variant="secondary" onPress={() => onFamily(second)}>
                  <Text>{`看${second.name}的家族`}</Text>
                </Button>
              ) : null}
            </View>
          </>
        )
      ) : null}
    </>
  );
}
