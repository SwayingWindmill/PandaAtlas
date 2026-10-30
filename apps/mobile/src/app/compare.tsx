import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useStacked } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { type ComparePoint, type Comparison, comparePandas, missingLine } from "@/features/compare/compare";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { LearningSources } from "@/features/learning/sources";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { type Pair, PairSlots, PandaPicker, type SlotKey, nextSlot } from "@/features/pandas/pair-picker";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { HAIRLINE, RADIUS } from "@/lib/surface";

// 比一比: two pandas side by side, with only the distinguishing points 文献与写作 has written and sourced.
// Without a pair in the link (from 找熊猫), the page first asks for two pandas; the user picks both, nothing is suggested.

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function facts(panda: PandaListItem): string[] {
  return [
    panda.sex === "male" ? "雄" : panda.sex === "female" ? "雌" : null,
    panda.birthDate ? `${panda.birthDate.slice(0, 4)} 年出生` : null,
    panda.deceased ? "已离世" : panda.place,
  ].filter((value): value is string => Boolean(value));
}

function Side({ panda }: { panda: PandaListItem }) {
  return (
    <PressScale
      onPress={() => openPanda(panda.slug)}
      role="link"
      accessibilityLabel={`${panda.name}，${facts(panda).join("，")}`}
      accessibilityHint="打开它的资料"
      containerStyle={{ flex: 1 }}
      className="gap-stack-tight"
    >
      <View className="overflow-hidden rounded-tile" style={{ borderCurve: "continuous" }}>
        <PandaPhoto pandaId={panda.id} label={panda.name} aspect="4/5" rounded={false} decorative />
        <PhotoOutline radius={RADIUS.tile} />
      </View>
      <Text variant="headline" numberOfLines={2}>
        {panda.name}
      </Text>
      {facts(panda).map((fact) => (
        <Text key={fact} variant="footnote" className="text-muted-foreground">
          {fact}
        </Text>
      ))}
    </PressScale>
  );
}

function PointText({ text, name, stacked }: { text: string | null; name: string; stacked: boolean }) {
  return (
    <View className={stacked ? "gap-0.5" : "flex-1"}>
      {stacked ? (
        <Text variant="footnote" className="text-muted-foreground">
          {name}
        </Text>
      ) : null}
      <Text variant="body" className={text ? undefined : "text-muted-foreground"}>
        {text ?? "还没写"}
      </Text>
    </View>
  );
}

function Point({ point, a, b, last }: { point: ComparePoint; a: PandaListItem; b: PandaListItem; last: boolean }) {
  const stacked = useStacked();
  return (
    <View accessible accessibilityLabel={`${point.label}。${a.name}：${point.a ?? "还没写"}。${b.name}：${point.b ?? "还没写"}`}>
      <View className="gap-stack-tight px-4 py-row">
        <Text variant="footnote" className="font-semibold text-muted-foreground">
          {point.label}
        </Text>
        <View className={stacked ? "gap-stack-tight" : "flex-row gap-row"}>
          <PointText text={point.a} name={a.name} stacked={stacked} />
          <PointText text={point.b} name={b.name} stacked={stacked} />
        </View>
      </View>
      {last ? null : <View className="ml-4 bg-border" style={{ height: HAIRLINE }} />}
    </View>
  );
}

/** Column names for the side-by-side layout, so a point still reads once the photos have scrolled away. */
function Columns({ a, b }: { a: PandaListItem; b: PandaListItem }) {
  const stacked = useStacked();
  if (stacked) return null;
  return (
    <View className="flex-row gap-row px-4 pt-row" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[a, b].map((panda) => (
        <Text key={panda.slug} variant="footnote" className="flex-1 font-semibold" numberOfLines={2}>
          {panda.name}
        </Text>
      ))}
    </View>
  );
}

function Missing({ comparison }: { comparison: Comparison }) {
  if (comparison.missing.length === 0) return null;
  return (
    <View className="gap-stack-tight">
      {comparison.missing.map((item) => (
        <Text key={item.pandaSlug} variant="footnote" className="text-muted-foreground">
          {missingLine(item)}
        </Text>
      ))}
    </View>
  );
}

function Points({ comparison, a, b }: { comparison: Comparison; a: PandaListItem; b: PandaListItem }) {
  if (comparison.state === "pending") {
    return (
      <View className="gap-row rounded-group bg-card px-4 py-4" style={{ borderCurve: "continuous" }}>
        <Text variant="headline">区分要点还在整理</Text>
        <Text variant="footnote" className="text-muted-foreground">
          还缺这些，补上就会显示在这里：
        </Text>
        <Missing comparison={comparison} />
        <Text variant="footnote" className="text-muted-foreground">
          每一条都附公开出处。
        </Text>
      </View>
    );
  }
  return (
    <View className="gap-row">
      {comparison.points.length > 0 ? (
        <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
          <Columns a={a} b={b} />
          {comparison.points.map((point, index) => (
            <Point key={point.key} point={point} a={a} b={b} last={index === comparison.points.length - 1} />
          ))}
        </View>
      ) : null}
      {comparison.hints.length > 0 ? (
        <View className="gap-stack-tight rounded-group bg-card px-4 py-row" style={{ borderCurve: "continuous" }}>
          <Text variant="footnote" className="font-semibold text-muted-foreground">
            认脸挑战里的提示
          </Text>
          {comparison.hints.map((hint, index) => (
            <View key={hint.slug} className="gap-stack-tight">
              {index > 0 ? <View className="bg-border" style={{ height: HAIRLINE }} /> : null}
              <Text variant="body">{hint.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {comparison.missing.length > 0 ? (
        <View className="gap-stack-tight px-4">
          <Text variant="footnote" className="text-muted-foreground">
            还在整理：
          </Text>
          <Missing comparison={comparison} />
        </View>
      ) : null}
    </View>
  );
}

type Load = { status: "loading" } | { status: "ready"; pandas: PandaListItem[] } | { status: "failed" };

/** The two slots and the panda list; once both are chosen and differ, one button opens the comparison. */
function PickPair({ pandas, preset }: { pandas: PandaListItem[]; preset: PandaListItem | null }) {
  const [pair, setPair] = useState<Pair>({ first: preset, second: null });
  const [picking, setPicking] = useState<SlotKey | null>(preset ? "second" : "first");
  const { first, second } = pair;

  function pick(panda: PandaListItem) {
    if (!picking) return;
    const next = { ...pair, [picking]: panda };
    setPair(next);
    setPicking(nextSlot(next));
  }

  return (
    <Page label="选两只熊猫，并排看区分要点。" title="比一比" keyboardShouldPersistTaps="handled">
      <PairSlots pair={pair} picking={picking} onSlot={setPicking} />
      {picking ? (
        <PandaPicker key={picking} pandas={pandas} onPick={pick} />
      ) : first && second ? (
        first.slug === second.slug ? (
          <ScreenState message="选了同一只熊猫，换一只看看。" className="py-stack" />
        ) : (
          <Button
            onPress={() => router.push({ pathname: "/compare", params: { a: first.slug, b: second.slug } })}
            accessibilityHint="打开并排对比"
          >
            <Text className="text-center">{`比一比${first.name}和${second.name}`}</Text>
          </Button>
        )
      ) : null}
    </Page>
  );
}

export default function CompareScreen() {
  const params = useLocalSearchParams<{ a: string; b: string }>();
  const slugA = param(params.a);
  const slugB = param(params.b);
  // A link with both pandas compares them; one with none or only one asks for the pair first.
  const choosing = !slugA || !slugB;
  const { state: catalog, reload: reloadCatalog } = useLearningCatalog();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const loadPandas = useCallback(() => {
    loadPandaIndex()
      .then((pandas) => setLoad({ status: "ready", pandas }))
      .catch(() => setLoad({ status: "failed" }));
  }, []);
  useEffect(loadPandas, [loadPandas]);

  if (load.status === "failed" || (!choosing && catalog.status === "failed")) {
    return (
      <Page title="比一比">
        <LoadFailed
          message="暂时打不开。"
          onRetry={() => {
            setLoad({ status: "loading" });
            loadPandas();
            reloadCatalog();
          }}
        />
      </Page>
    );
  }
  if (load.status === "loading" || (!choosing && catalog.status === "loading")) {
    return (
      <Page title="比一比">
        {choosing ? (
          <View className="gap-stack" accessibilityLabel="正在加载">
            <View className="flex-row gap-row">
              <Skeleton className="h-36 flex-1 rounded-tile" />
              <Skeleton className="h-36 flex-1 rounded-tile" />
            </View>
            <Skeleton className="h-11 w-full rounded-control" />
          </View>
        ) : (
          <>
            <View className="flex-row gap-row" accessibilityLabel="正在加载">
              <Skeleton className="flex-1 rounded-tile" style={{ aspectRatio: 4 / 5 }} />
              <Skeleton className="flex-1 rounded-tile" style={{ aspectRatio: 4 / 5 }} />
            </View>
            <Skeleton className="h-32 w-full rounded-group" />
          </>
        )}
      </Page>
    );
  }
  const a = load.pandas.find((panda) => panda.slug === slugA);
  const b = load.pandas.find((panda) => panda.slug === slugB);
  if (choosing) {
    return <PickPair pandas={load.pandas} preset={a ?? b ?? null} />;
  }
  if (!a || !b || a.slug === b.slug || catalog.status !== "ready") {
    return (
      <Page title="比一比">
        <ScreenState
          message="没找到要比的两只熊猫。"
          actionLabel="重新选两只"
          onAction={() => router.replace("/compare")}
        />
      </Page>
    );
  }
  const comparison = comparePandas(catalog.catalog, a, b);
  return (
    <Page label="比一比" title={`${a.name}和${b.name}`}>
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        <View className="flex-row gap-row">
          <Side panda={a} />
          <Side panda={b} />
        </View>
        <View className="gap-row">
          <Text variant="title" role="heading">
            区分要点
          </Text>
          <Points comparison={comparison} a={a} b={b} />
        </View>
        <LearningSources sources={comparison.sources} />
      </Animated.View>
    </Page>
  );
}
