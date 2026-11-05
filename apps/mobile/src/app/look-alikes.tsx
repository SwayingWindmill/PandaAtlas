import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chevron } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Segmented } from "@/components/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { LOOK_ALIKE_NOTES, type LookAlikePair, lookAlikePairs } from "@/features/compare/look-alikes";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { loadPandaIndex } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";
import { loadLineage } from "@/lib/public-data";

const GAP = 2;

/** One half of a pair card: the panda's cover, or its first character on the placeholder. */
function Half({ panda }: { panda: LookAlikePair["a"] }) {
  const photo = usePandaCover(panda.id);
  return (
    <View className="flex-1 items-center justify-center bg-media-placeholder" style={{ aspectRatio: 3 / 2 }}>
      {photo ? (
        <Image source={photo} style={{ position: "absolute", inset: 0 }} contentFit="cover" accessible={false} />
      ) : (
        <Text variant="title" className="text-muted-foreground">
          {panda.name.slice(0, 1)}
        </Text>
      )}
    </View>
  );
}

/**
 * A pair as one card (v4 `12-twins`): the two photos side by side, the names joined by &, the birthday for
 * twins or the written note for a pair, and a chevron to 比一比.
 */
function PairCard({ pair }: { pair: LookAlikePair }) {
  const note = LOOK_ALIKE_NOTES[pair.key];
  const detail = pair.kind === "twins" && pair.a.birthDate ? `${pair.a.birthDate.replaceAll("-", ".")} 出生` : note;
  return (
    <Pressable
      role="link"
      accessibilityLabel={`对比${pair.a.name}和${pair.b.name}${detail ? `，${detail}` : ""}`}
      onPress={() => router.push({ pathname: "/compare", params: { a: pair.a.slug, b: pair.b.slug } })}
      className="overflow-hidden rounded-group bg-card active:opacity-80"
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row" style={{ gap: GAP }}>
        <Half panda={pair.a} />
        <Half panda={pair.b} />
      </View>
      <View className="flex-row items-center gap-row px-inset py-stack-tight">
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline" numberOfLines={1}>
            {pair.a.name}
            <Text variant="headline" className="text-tertiary-foreground">
              {" & "}
            </Text>
            {pair.b.name}
          </Text>
          {detail ? (
            <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Chevron />
      </View>
    </Pressable>
  );
}

const KINDS = [
  { value: "twins", label: "双胞胎" },
  { value: "challenge", label: "像的熊猫" },
] as const;

/** 双胞胎和像的熊猫: only pairs the published data already puts together. Each row opens 比一比. */
export default function LookAlikesScreen() {
  const data = useQuery({
    queryKey: ["look-alikes", "base"],
    queryFn: async () => {
      const [pandas, links] = await Promise.all([loadPandaIndex(), loadLineage()]);
      return { pandas, links };
    },
  });
  const catalog = useLearningCatalog();

  if (data.isError || catalog.state.status === "failed") {
    return (
      <Page title="双胞胎">
        <LoadFailed
          message="没加载出来"
          onRetry={() => {
            void data.refetch();
            catalog.reload();
          }}
        />
      </Page>
    );
  }
  if (!data.data || catalog.state.status === "loading") {
    return (
      <Page title="双胞胎">
        <Skeleton className="h-60 rounded-group" />
      </Page>
    );
  }
  const pairs = lookAlikePairs(data.data.pandas, data.data.links, catalog.state.catalog.challenges);
  return <Pairs pairs={pairs} />;
}

function Pairs({ pairs }: { pairs: LookAlikePair[] }) {
  const kinds = KINDS.filter((kind) => pairs.some((pair) => pair.kind === kind.value));
  const [kind, setKind] = useState<LookAlikePair["kind"]>(kinds[0]?.value ?? "twins");
  const shown = pairs.filter((pair) => pair.kind === kind);
  return (
    <Page title="双胞胎">
      <Animated.View entering={PAGE_ENTER} className="gap-row">
        {pairs.length === 0 ? <ScreenState message="暂无" /> : null}
        {kinds.length > 1 ? (
          <Segmented value={kind} options={kinds} onChange={(value) => setKind(value as LookAlikePair["kind"])} accessibilityLabel="双胞胎或像的熊猫" />
        ) : null}
        {shown.map((pair) => (
          <PairCard key={pair.key} pair={pair} />
        ))}
      </Animated.View>
    </Page>
  );
}
