import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useDeferredValue, useLayoutEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chevron, ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { ArrowLeftRight, ChevronRight, Network, Plus } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { ScreenState } from "@/components/screen-state";
import { Scrim } from "@/components/scrim";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import {
  type ArchiveCompareRow,
  type CompareKinship,
  type ComparePoint,
  type Comparison,
  type FeaturedComparePair,
  buildArchiveComparison,
  buildFeaturedComparePairs,
  comparePandas,
  summarizeCompareKinship,
} from "@/features/compare/compare";
import { comparisonsQueryOptions } from "@/features/discover/comparisons";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { LearningSources } from "@/features/learning/sources";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, listMeta, pandaIndexQueryOptions, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePandaCover } from "@/lib/covers";
import { nameInitial } from "@/lib/panda";
import { loadLineage } from "@/lib/public-data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { failedWithoutData } from "@/lib/query-failed";
import { PAGE_COLUMN, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

type SlotKey = "first" | "second";
type Pair = Record<SlotKey, PandaListItem | null>;

const SLOT_EMPTY_TITLE: Record<SlotKey, string> = { first: "选第一只", second: "选第二只" };
const SLOT_EMPTY_SUBTITLE: Record<SlotKey, string> = { first: "左侧档案位", second: "右侧档案位" };
const BROWSE_LIMIT = 20;
const DIPTYCH_HEIGHT = 148;
const SEAM_GAP = 2;

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function nextSlot(pair: Pair): SlotKey | null {
  if (!pair.first) return "first";
  if (!pair.second) return "second";
  return null;
}

function heroMeta(panda: PandaListItem): string {
  const sex = panda.sex === "female" ? "雌" : panda.sex === "male" ? "雄" : null;
  const where = panda.deceased ? "已离世" : panda.place;
  return [where, sex].filter(Boolean).join("　");
}

function isMutedCell(value: string): boolean {
  return value === "未记录" || value === "—";
}

function StageSlot({
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
      accessibilityLabel={`${SLOT_EMPTY_TITLE[slot]}，${panda ? panda.name : "未选"}`}
      accessibilityState={{ selected: active }}
      className={cn(
        "items-center justify-center gap-stack-tight px-4 py-6 active:opacity-80",
        stacked ? "self-stretch" : "min-w-0 flex-1",
        active ? "bg-highlight-soft" : "bg-card",
      )}
    >
      {panda ? (
        <PandaThumb pandaId={panda.id} name={panda.name} size={48} shape="round" />
      ) : (
        <Icon icon={Plus} size="body" tone={active ? "tint" : "secondary"} strokeWidth={2.25} />
      )}
      <View className="items-center gap-0.5 self-stretch">
        <Text
          variant="headline"
          className={cn("text-center", active ? "text-primary" : panda ? "text-foreground" : "text-muted-foreground")}
          numberOfLines={stacked ? undefined : 2}
        >
          {panda ? panda.name : SLOT_EMPTY_TITLE[slot]}
        </Text>
        <Text variant="footnote" className="text-center text-muted-foreground" numberOfLines={stacked ? undefined : 1}>
          {panda ? panda.place ?? "点击更换" : SLOT_EMPTY_SUBTITLE[slot]}
        </Text>
      </View>
    </Pressable>
  );
}

function SplitVsStage({
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
    <View className="overflow-hidden rounded-card border-hairline border-border bg-card" style={{ borderCurve: "continuous" }}>
      <View className={stacked ? "flex-col" : "flex-row"}>
        <StageSlot
          slot="first"
          panda={pair.first}
          active={picking === "first"}
          stacked={stacked}
          onPress={() => onSlot("first")}
        />
        <View className="bg-background" style={stacked ? { height: SEAM_GAP } : { width: SEAM_GAP }} />
        <StageSlot
          slot="second"
          panda={pair.second}
          active={picking === "second"}
          stacked={stacked}
          onPress={() => onSlot("second")}
        />
      </View>
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View className="rounded-pill bg-button px-2.5 py-0.5" style={{ borderCurve: "continuous" }}>
          <Text variant="footnote" role="none" className="font-bold text-primary-foreground">
            VS
          </Text>
        </View>
      </View>
    </View>
  );
}

function DiptychHalf({ panda }: { panda: PandaListItem }) {
  const cover = usePandaCover(panda.id);
  return (
    <View className="flex-1 items-center justify-center bg-media-placeholder">
      {cover ? (
        <RemoteImage source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />
      ) : (
        <Text variant="title" role="none" className="text-on-media/60">
          {nameInitial(panda.name)}
        </Text>
      )}
    </View>
  );
}

function FeaturedDiptychCard({ item, stacked }: { item: FeaturedComparePair; stacked: boolean }) {
  return (
    <PressScale
      role="button"
      accessibilityLabel={`比一比 ${item.a.name} 和 ${item.b.name}，${item.tag}，${item.subtitle}`}
      accessibilityHint="打开并排对照"
      onPress={() => router.push({ pathname: "/compare", params: { a: item.a.slug, b: item.b.slug } })}
    >
      <View className="overflow-hidden rounded-tile bg-media-placeholder" style={{ borderCurve: "continuous" }}>
        <View className="flex-row" style={{ height: stacked ? 184 : DIPTYCH_HEIGHT }}>
          <DiptychHalf panda={item.a} />
          <View className="bg-background" style={{ width: SEAM_GAP }} />
          <DiptychHalf panda={item.b} />
        </View>
        <Scrim id={`featured-compare-${item.key}`} height="72%" />
        <View className="absolute top-2.5 left-2.5 rounded-pill bg-glass-fallback px-2.5 py-0.5" style={{ borderCurve: "continuous" }}>
          <Text variant="footnote" role="none" className="font-semibold text-on-media" numberOfLines={1}>
            {item.tag}
          </Text>
        </View>
        <View className="absolute right-3 bottom-2.5 left-3 flex-row items-end justify-between gap-row">
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="headline" role="none" className="text-on-media" numberOfLines={1}>
              {`${item.a.name} & ${item.b.name}`}
            </Text>
            <Text variant="footnote" role="none" className="text-on-media/85" numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
          <Icon icon={ChevronRight} size="subhead" tone="onMedia" strokeWidth={2.25} />
        </View>
        <PhotoOutline radius={RADIUS.tile} />
      </View>
    </PressScale>
  );
}

function PickPair({
  pandas,
  preset,
  featured,
}: {
  pandas: PandaListItem[];
  preset: PandaListItem | null;
  featured: FeaturedComparePair[];
}) {
  const navigation = useNavigation();
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  const stacked = useStacked();
  const [pair, setPair] = useState<Pair>({ first: preset, second: null });
  const [picking, setPicking] = useState<SlotKey | null>(preset ? "second" : "first");
  const [query, setQuery] = useState("");
  const [autoFocusSearch, setAutoFocusSearch] = useState(false);
  const deferred = useDeferredValue(query);
  const { first, second } = pair;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "比一比",
      headerTitle: undefined,
      headerLargeTitleEnabled: false,
      headerBackVisible: true,
      headerShown: true,
    });
  }, [navigation]);

  const results = useMemo(() => searchPandas(pandas, deferred).slice(0, BROWSE_LIMIT), [pandas, deferred]);
  const filtering = deferred.trim().length > 0;

  function openSlot(slot: SlotKey) {
    setPicking(slot);
    setQuery("");
    setAutoFocusSearch(true);
  }

  function pick(panda: PandaListItem) {
    if (!picking) return;
    const next = { ...pair, [picking]: panda };
    setPair(next);
    setQuery("");
    setAutoFocusSearch(false);
    setPicking(nextSlot(next));
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-gutter pt-stack-tight"
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[PAGE_COLUMN, { paddingBottom: bottom }]}
    >
      <View className="gap-1">
        <Text variant="footnote" className="font-semibold text-primary">
          档案与外貌对照
        </Text>
        <Text variant="display" role="heading">
          并排比一比
        </Text>
      </View>

      <SplitVsStage pair={pair} picking={picking} onSlot={openSlot} />

      {first && second ? (
        first.slug === second.slug ? (
          <ScreenState message="选了同一只熊猫，换一只看看。" className="py-stack-tight" />
        ) : !picking ? (
          <Button
            onPress={() => router.push({ pathname: "/compare", params: { a: first.slug, b: second.slug } })}
            accessibilityHint="打开并排对照"
          >
            <Text className="text-center">{`比一比${first.name}和${second.name}`}</Text>
          </Button>
        ) : null
      ) : null}

      {picking ? (
        <View className="gap-stack">
          <SearchField
            value={query}
            onChange={setQuery}
            label="搜索要选的熊猫"
            placeholder="搜索全库任意大熊猫姓名或编号"
            autoFocus={autoFocusSearch}
          />
          {!filtering && featured.length > 0 ? (
            <View className="gap-row">
              <View className={stacked ? "gap-hair-gap" : "flex-row items-baseline justify-between gap-row"}>
                <Text variant="title" role="heading">
                  精选对照
                </Text>
                <Pressable
                  role="link"
                  accessibilityLabel="全部双胞胎"
                  onPress={() => router.push("/look-alikes")}
                  className="min-h-11 flex-row items-center gap-0.5 self-start active:opacity-60"
                >
                  <Text variant="subheadline" className="font-semibold text-primary">
                    全部双胞胎
                  </Text>
                  <Icon icon={ChevronRight} size="footnote" tone="tint" strokeWidth={2.25} />
                </Pressable>
              </View>
              <View className="gap-row">
                {featured.map((item) => (
                  <FeaturedDiptychCard key={item.key} item={item} stacked={stacked} />
                ))}
              </View>
            </View>
          ) : null}
          {results.length > 0 ? (
            <ListSection title={filtering ? undefined : `从这些熊猫里选（${SLOT_EMPTY_TITLE[picking]}）`}>
              {results.map((panda, index) => (
                <ListCell
                  key={panda.id}
                  label={panda.name}
                  detail={listMeta(panda) || undefined}
                  leading={<PandaThumb pandaId={panda.id} name={panda.name} size={36} shape="round" />}
                  onPress={() => pick(panda)}
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
      ) : null}
    </ScrollView>
  );
}

function DiptychHeroHalf({
  panda,
  side,
  stacked,
}: {
  panda: PandaListItem;
  side: "left" | "right";
  stacked: boolean;
}) {
  const meta = heroMeta(panda);
  const rightAligned = !stacked && side === "right";
  return (
    <PressScale
      onPress={() => openPanda(panda.slug)}
      role="link"
      accessibilityLabel={`${panda.name}${meta ? `，${meta}` : ""}`}
      accessibilityHint="打开它的资料"
      containerStyle={stacked ? undefined : { flex: 1, minWidth: 0 }}
    >
      <View className="bg-media-placeholder">
        <PandaPhoto pandaId={panda.id} label={panda.name} aspect={stacked ? "4/3" : "4/5"} rounded={false} decorative />
        <Scrim id={`compare-hero-${side}-${panda.id}`} height="55%" />
        <View className={cn("absolute right-3.5 bottom-3 left-3.5 gap-0.5", rightAligned ? "items-end" : "items-start")}>
          <Text variant="title" role="none" className={cn("text-on-media", rightAligned && "text-right")} numberOfLines={2}>
            {panda.name}
          </Text>
          {meta ? (
            <Text variant="footnote" role="none" className={cn("text-on-media/85", rightAligned && "text-right")} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
    </PressScale>
  );
}

function DiptychHero({ a, b }: { a: PandaListItem; b: PandaListItem }) {
  const stacked = useStacked();
  return (
    <View className="overflow-hidden rounded-card bg-media-placeholder" style={{ borderCurve: "continuous" }}>
      <View className={stacked ? "flex-col" : "flex-row"}>
        <DiptychHeroHalf panda={a} side="left" stacked={stacked} />
        <View className="bg-background" style={stacked ? { height: SEAM_GAP } : { width: SEAM_GAP }} />
        <DiptychHeroHalf panda={b} side="right" stacked={stacked} />
      </View>
      <View
        pointerEvents="box-none"
        className={cn(
          "absolute right-0 left-0 items-center",
          stacked ? "inset-0 justify-center" : "top-1.5",
        )}
      >
        <Pressable
          role="button"
          accessibilityLabel={`交换左右顺序，改为${b.name}在左、${a.name}在右`}
          onPress={() => router.replace({ pathname: "/compare", params: { a: b.slug, b: a.slug } })}
          className="min-h-11 min-w-11 items-center justify-center active:opacity-75"
        >
          <View className="rounded-pill bg-glass-fallback px-2.5 py-0.5" style={{ borderCurve: "continuous" }}>
            <Text variant="footnote" role="none" className="font-bold text-on-media">
              VS
            </Text>
          </View>
        </Pressable>
      </View>
      <PhotoOutline radius={RADIUS.card} />
    </View>
  );
}

function KinshipCallout({ kinship }: { kinship: CompareKinship }) {
  const stacked = useStacked();
  return (
    <Pressable
      role="link"
      accessibilityLabel={`${kinship.title}，${kinship.subtitle}`}
      onPress={() => router.push(kinship.href)}
      className="min-h-11 flex-row items-center gap-row rounded-group bg-card px-inset py-row active:bg-accent"
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={Network} size="subhead" tone="tint" strokeWidth={2} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="subheadline" className="font-semibold" numberOfLines={stacked ? undefined : 2}>
          {kinship.title}
        </Text>
        <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
          {kinship.subtitle}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
}

function ArchiveMatrix({ rows, a, b }: { rows: ArchiveCompareRow[]; a: PandaListItem; b: PandaListItem }) {
  const stacked = useStacked();
  return (
    <View className="gap-stack-tight">
      <Text variant="title" role="heading">
        核心档案对照
      </Text>
      <View>
        {rows.map((row, index) => {
          const last = index === rows.length - 1;
          const borderClass = last ? undefined : "border-b-hairline border-border";
          const spoken = `${row.label}，${a.name}：${row.aValue}，${b.name}：${row.bValue}${row.badge ? `，${row.badge}` : ""}`;
          if (stacked) {
            return (
              <View key={row.key} accessible accessibilityLabel={spoken} className={cn("gap-stack-tight py-row", borderClass)}>
                <View className="flex-row flex-wrap items-center justify-between gap-stack-tight">
                  <Text variant="footnote" className="font-semibold text-muted-foreground">
                    {row.label}
                  </Text>
                  {row.badge ? (
                    <View className="rounded-pill bg-highlight-soft px-2 py-0.5" style={{ borderCurve: "continuous" }}>
                      <Text variant="footnote" className="font-semibold text-primary tabular-nums">
                        {row.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View className="gap-0.5">
                  <Text variant="footnote" className="text-muted-foreground">
                    {a.name}
                  </Text>
                  <Text variant="headline" className={cn("tabular-nums", isMutedCell(row.aValue) && "text-tertiary-foreground")}>
                    {row.aValue}
                  </Text>
                </View>
                <View className="gap-0.5">
                  <Text variant="footnote" className="text-muted-foreground">
                    {b.name}
                  </Text>
                  <Text variant="headline" className={cn("tabular-nums", isMutedCell(row.bValue) && "text-tertiary-foreground")}>
                    {row.bValue}
                  </Text>
                </View>
              </View>
            );
          }
          return (
            <View
              key={row.key}
              accessible
              accessibilityLabel={spoken}
              className={cn("flex-row items-center gap-row py-row", borderClass)}
            >
              <View className="min-w-0 flex-1 items-end">
                <Text
                  variant="headline"
                  className={cn("text-right tabular-nums", isMutedCell(row.aValue) && "text-tertiary-foreground")}
                  numberOfLines={2}
                >
                  {row.aValue}
                </Text>
              </View>
              <View className="min-w-20 shrink-0 items-center gap-hair-gap">
                <Text variant="footnote" className="text-center text-muted-foreground">
                  {row.label}
                </Text>
                {row.badge ? (
                  <View className="rounded-pill bg-highlight-soft px-2 py-0.5" style={{ borderCurve: "continuous" }}>
                    <Text variant="footnote" className="text-center font-semibold text-primary tabular-nums">
                      {row.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className="min-w-0 flex-1 items-start">
                <Text
                  variant="headline"
                  className={cn("text-left tabular-nums", isMutedCell(row.bValue) && "text-tertiary-foreground")}
                  numberOfLines={2}
                >
                  {row.bValue}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PointRow({
  point,
  a,
  b,
  last,
}: {
  point: ComparePoint;
  a: PandaListItem;
  b: PandaListItem;
  last: boolean;
}) {
  const stacked = useStacked();
  const aText = point.a ?? "暂未记录";
  const bText = point.b ?? "暂未记录";
  return (
    <View
      accessible
      accessibilityLabel={`${point.label}。${a.name}：${aText}。${b.name}：${bText}`}
      className={cn("gap-stack-tight py-row", !last && "border-b-hairline border-border")}
    >
      <Text variant="footnote" className="font-semibold text-muted-foreground">
        {point.label}
      </Text>
      <View className={stacked ? "gap-stack-tight" : "flex-row gap-row"}>
        <View className={stacked ? "gap-0.5" : "min-w-0 flex-1 gap-0.5"}>
          {stacked ? (
            <Text variant="footnote" className="text-muted-foreground">
              {a.name}
            </Text>
          ) : null}
          <Text variant="subheadline" className={point.a ? undefined : "text-tertiary-foreground"}>
            {aText}
          </Text>
        </View>
        <View className={stacked ? "gap-0.5" : "min-w-0 flex-1 gap-0.5"}>
          {stacked ? (
            <Text variant="footnote" className="text-muted-foreground">
              {b.name}
            </Text>
          ) : null}
          <Text variant="subheadline" className={point.b ? undefined : "text-tertiary-foreground"}>
            {bText}
          </Text>
        </View>
      </View>
    </View>
  );
}

function AppearanceNotes({ comparison, a, b }: { comparison: Comparison; a: PandaListItem; b: PandaListItem }) {
  const stacked = useStacked();
  const hasNotes = comparison.points.length > 0 || comparison.hints.length > 0;
  const featureCount = comparison.points.length + comparison.hints.length;

  return (
    <View className="gap-stack-tight">
      <View className={stacked ? "gap-0.5" : "flex-row items-baseline justify-between gap-row"}>
        <Text variant="title" role="heading">
          外貌辨识
        </Text>
        {hasNotes ? (
          <Text variant="footnote" className="text-muted-foreground tabular-nums">
            {`已核对 ${featureCount} 项特征`}
          </Text>
        ) : null}
      </View>
      {hasNotes ? (
        <View>
          {comparison.points.map((point, index) => (
            <PointRow
              key={point.key}
              point={point}
              a={a}
              b={b}
              last={index === comparison.points.length - 1 && comparison.hints.length === 0}
            />
          ))}
          {comparison.hints.length > 0 ? (
            <View className="gap-stack-tight py-row">
              <Text variant="footnote" className="font-semibold text-muted-foreground">
                认脸挑战线索
              </Text>
              {comparison.hints.map((hint, index) => (
                <Text
                  key={hint.slug}
                  variant="subheadline"
                  className={cn(
                    index > 0 && "border-t-hairline border-border pt-stack-tight",
                  )}
                >
                  {hint.text}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Text variant="subheadline" className="text-muted-foreground">
          两位大熊猫的外貌辨识笔录暂未整理，可先对照上方谱系、年龄差与现居地，或点击照片查看各自档案与相册。
        </Text>
      )}
    </View>
  );
}

export default function CompareScreen() {
  const params = useLocalSearchParams<{ a: string; b: string }>();
  const navigation = useNavigation();
  const slugA = param(params.a);
  const slugB = param(params.b);
  const choosing = !slugA || !slugB;

  const { state: catalog, reload: reloadCatalog } = useLearningCatalog();
  const index = useQuery(pandaIndexQueryOptions());
  const comparisons = useQuery(comparisonsQueryOptions());
  const lineage = useQuery({
    queryKey: ["public", "lineage"],
    queryFn: loadLineage,
    staleTime: 300_000,
    networkMode: "always",
  });
  const { data: pandas, refetch: reloadPandas } = index;

  const a = pandas?.find((panda) => panda.slug === slugA);
  const b = pandas?.find((panda) => panda.slug === slugB);
  const showResult = Boolean(!choosing && pandas && catalog.status === "ready" && a && b && a.slug !== b.slug);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: showResult
        ? () => (
            <Pressable
              role="button"
              accessibilityLabel="换选"
              onPress={() => router.replace("/compare")}
              hitSlop={6}
              className="mr-1 min-h-11 flex-row items-center gap-hair-gap px-2 active:opacity-60"
            >
              <Icon icon={ArrowLeftRight} size="subhead" tone="tint" strokeWidth={2} />
              <Text variant="subheadline" className="font-semibold text-primary" numberOfLines={1}>
                换选
              </Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, showResult]);

  const featured = useMemo(() => {
    if (!pandas) return [];
    const challenges = catalog.status === "ready" ? catalog.catalog.challenges : [];
    return buildFeaturedComparePairs(pandas, comparisons.data ?? [], lineage.data ?? [], challenges);
  }, [pandas, catalog, comparisons.data, lineage.data]);

  if (failedWithoutData(index) || (!choosing && catalog.status === "failed")) {
    return (
      <Page title="比一比">
        <LoadFailed
          message="暂时打不开。"
          onRetry={() => {
            void reloadPandas();
            reloadCatalog();
          }}
        />
      </Page>
    );
  }
  if (!pandas || (!choosing && catalog.status === "loading")) {
    return (
      <Page title="比一比">
        {choosing ? (
          <View className="gap-stack" accessibilityLabel="正在加载">
            <Skeleton className="h-36 w-full rounded-card" />
            <Skeleton className="h-11 w-full rounded-control" />
          </View>
        ) : (
          <View className="gap-section" accessibilityLabel="正在加载">
            <Skeleton className="h-56 w-full rounded-card" />
            <Skeleton className="h-16 w-full rounded-group" />
            <Skeleton className="h-44 w-full rounded-group" />
          </View>
        )}
      </Page>
    );
  }
  if (choosing) {
    const preset = a ?? b ?? null;
    return <PickPair key={preset?.slug ?? "none"} pandas={pandas} preset={preset} featured={featured} />;
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
  const archiveRows = buildArchiveComparison(a, b);
  const kinship = lineage.data
    ? summarizeCompareKinship(a, b, lineage.data, pandas)
    : lineage.isError
      ? {
          linked: false,
          title: "查看双方亲缘关系",
          subtitle: "打开亲缘查询",
          stepsCount: 0,
          term: null,
          href: { pathname: "/relationship" as const, params: { a: a.slug, b: b.slug } },
        }
      : null;

  return (
    <Page title={`${a.name}和${b.name}`}>
      <Animated.View entering={PAGE_ENTER} className="gap-section-tight">
        <DiptychHero a={a} b={b} />
        {kinship ? <KinshipCallout kinship={kinship} /> : <Skeleton className="h-16 w-full rounded-group" />}
        <ArchiveMatrix rows={archiveRows} a={a} b={b} />
        <AppearanceNotes comparison={comparison} a={a} b={b} />
        {comparison.sources.length > 0 ? <LearningSources sources={comparison.sources} /> : null}
      </Animated.View>
    </Page>
  );
}
