import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, ChipRow } from "@/components/chip";
import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { ArrowLeftRight } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { NO_WEB_BAR_TITLE } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  type IdentifyTraitId,
  buildIdentifyProfiles,
  buildIdentifyTraitGroups,
  buildIdentifyVenues,
  buildLivingPool,
  filterIdentifyPool,
  formatCandidateMeta,
  orderVenueOptions,
  rankIdentifyCandidates,
  resolveInitialVenueSlug,
  toggleCompareSlug,
  toggleIdentifyTrait,
} from "@/features/identify/identify";
import type { CatalogFaceGuide } from "@/features/learning/catalog";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { mapViewQueryOptions } from "@/features/map/load";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { fetchLineage } from "@/lib/public-data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { failedWithoutData } from "@/lib/query-failed";
import { PAGE_COLUMN } from "@/lib/surface";
import { cn } from "@/lib/utils";

const EMPTY_PANDAS: PandaListItem[] = [];
const EMPTY_FACE_GUIDES: CatalogFaceGuide[] = [];

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function IdentifyHeader({ subtitle }: { subtitle?: string }) {
  return (
    <View className="gap-1">
      <Text variant="display">现场认熊</Text>
      {subtitle ? (
        <Text variant="subheadline" className="text-muted-foreground">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Multi-access Key panda identification screen: filter by venue & traits offline, then hand off Top-2 to /compare. */
export default function IdentifyScreen() {
  const params = useLocalSearchParams<{ institution?: string }>();
  const initialInstitution = param(params.institution);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const stacked = useStacked();
  const refreshControl = usePullToRefresh();

  const index = useQuery(pandaIndexQueryOptions());
  const mapView = useQuery(mapViewQueryOptions());
  const lineage = useQuery({
    queryKey: ["public", "lineage"],
    queryFn: fetchLineage,
    staleTime: 300_000,
    networkMode: "always",
  });
  const { state: catalog } = useLearningCatalog();
  const faceGuides = catalog.status === "ready" ? catalog.catalog.faceGuides : null;

  const [venueChoice, setVenueChoice] = useState<{
    forInstitution: string | undefined;
    slug: string | null;
  } | null>(null);
  const [selectedTraits, setSelectedTraits] = useState<IdentifyTraitId[]>([]);
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "",
      headerLargeTitleEnabled: false,
      headerBackVisible: true,
      headerShown: true,
      ...NO_WEB_BAR_TITLE,
    });
  }, [navigation]);

  const pandas = index.data ?? null;
  const livingPool = useMemo(() => (pandas ? buildLivingPool(pandas) : EMPTY_PANDAS), [pandas]);
  const livingSlugSet = useMemo(() => new Set(livingPool.map((panda) => panda.slug)), [livingPool]);
  const venues = useMemo(
    () => buildIdentifyVenues(livingPool, mapView.data?.items ?? []),
    [livingPool, mapView.data?.items],
  );
  const resolvedInitialVenue = useMemo(
    () => resolveInitialVenueSlug(venues, initialInstitution),
    [venues, initialInstitution],
  );
  const hasVenueOverride = venueChoice !== null && venueChoice.forInstitution === initialInstitution;
  const selectedVenueSlug = hasVenueOverride ? venueChoice.slug : resolvedInitialVenue;
  const orderedVenues = useMemo(
    () => orderVenueOptions(venues, selectedVenueSlug),
    [venues, selectedVenueSlug],
  );
  const activePool = useMemo(
    () => filterIdentifyPool(livingPool, venues, selectedVenueSlug),
    [livingPool, venues, selectedVenueSlug],
  );
  const profiles = useMemo(
    () => buildIdentifyProfiles(pandas ?? EMPTY_PANDAS, lineage.data ?? [], faceGuides ?? EMPTY_FACE_GUIDES),
    [pandas, lineage.data, faceGuides],
  );
  const traitGroups = useMemo(
    () => buildIdentifyTraitGroups(activePool, profiles),
    [activePool, profiles],
  );
  const activeTraits = useMemo(() => {
    const available = new Set(traitGroups.flatMap((group) => group.options.map((option) => option.id)));
    return selectedTraits.filter((id) => available.has(id));
  }, [traitGroups, selectedTraits]);
  const ranked = useMemo(
    () => rankIdentifyCandidates(activePool, profiles, activeTraits),
    [activePool, profiles, activeTraits],
  );

  const activeComparePandas = useMemo(() => {
    const bySlug = new Map(livingPool.map((panda) => [panda.slug, panda]));
    return compareSlugs
      .map((slug) => bySlug.get(slug))
      .filter((panda): panda is NonNullable<typeof panda> => Boolean(panda))
      .slice(0, 2);
  }, [livingPool, compareSlugs]);
  const activeCompareSlugSet = useMemo(
    () => new Set(activeComparePandas.map((panda) => panda.slug)),
    [activeComparePandas],
  );

  function selectVenue(slug: string | null) {
    setVenueChoice({ forInstitution: initialInstitution, slug });
    setExpanded(false);
  }

  function handleToggleTrait(traitId: IdentifyTraitId) {
    setSelectedTraits((prev) => toggleIdentifyTrait(prev, traitId));
    setExpanded(false);
  }

  function resetTraits() {
    setSelectedTraits([]);
    setExpanded(false);
  }

  function handleToggleCompare(slug: string) {
    setCompareSlugs((prev) =>
      toggleCompareSlug(
        prev.filter((item) => livingSlugSet.has(item)),
        slug,
      ),
    );
  }

  function openPairCompare(slugA: string, slugB: string) {
    router.push({ pathname: "/compare", params: { a: slugA, b: slugB } });
  }

  const waitingForVenue = Boolean(
    initialInstitution && !hasVenueOverride && !mapView.data && !mapView.isError && mapView.isPending,
  );
  const venueLoadFailed = Boolean(
    initialInstitution && !hasVenueOverride && !mapView.data && mapView.isError && !mapView.isFetching,
  );

  if (failedWithoutData(index)) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-stack px-gutter py-stack"
        contentContainerStyle={PAGE_COLUMN}
      >
        <IdentifyHeader />
        <LoadFailed message="熊猫档案暂时打不开。" onRetry={() => void index.refetch()} />
      </ScrollView>
    );
  }

  if (venueLoadFailed) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-stack px-gutter py-stack"
        contentContainerStyle={PAGE_COLUMN}
      >
        <IdentifyHeader />
        <LoadFailed
          message="该场馆数据暂未缓存，无法直接按场馆筛选。"
          onRetry={() => void mapView.refetch()}
        />
        <Button variant="secondary" onPress={() => selectVenue(null)}>
          <Text>改为浏览全部熊猫</Text>
        </Button>
      </ScrollView>
    );
  }

  if (!pandas || waitingForVenue) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-stack px-gutter py-stack"
        contentContainerStyle={PAGE_COLUMN}
      >
        <IdentifyHeader />
        <View className="gap-3" accessibilityLabel="正在加载">
          <Skeleton className="h-10 w-full rounded-control" />
          <Skeleton className="h-24 w-full rounded-group" />
          <Skeleton className="h-24 w-full rounded-group" />
        </View>
      </ScrollView>
    );
  }

  const displayed = expanded ? ranked.candidates : ranked.top3;
  const hiddenCount = ranked.candidates.length - displayed.length;
  const readyCompare = activeComparePandas.length === 2;
  const footerLabel = readyCompare
    ? `双图比一比：${activeComparePandas[0]!.name} 和 ${activeComparePandas[1]!.name}`
    : activeComparePandas.length === 1
      ? `再选 1 只，与${activeComparePandas[0]!.name}双图对比`
      : "勾选任意 2 只进入双图对比";

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 px-gutter pt-stack-tight pb-6"
        refreshControl={refreshControl}
        contentContainerStyle={PAGE_COLUMN}
      >
        <IdentifyHeader subtitle="先选现在在哪，再点选看到的特征" />

        <View className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text variant="footnote" className="font-semibold text-muted-foreground">
              1　先选现在在哪
            </Text>
            <Text variant="footnote" className="text-muted-foreground tabular-nums">
              {`候选 ${ranked.poolCount} 只`}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-gutter"
            contentContainerClassName="gap-stack-tight px-gutter"
            accessibilityLabel="选择场馆"
          >
            <Chip
              label="全部"
              appearance="ink"
              selected={selectedVenueSlug === null}
              onPress={() => selectVenue(null)}
            />
            {orderedVenues.map((venue) => (
              <Chip
                key={venue.slug}
                label={venue.name}
                appearance="ink"
                selected={selectedVenueSlug === venue.slug}
                onPress={() => selectVenue(venue.slug)}
              />
            ))}
          </ScrollView>
        </View>

        {traitGroups.length > 0 ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="footnote" className="min-w-0 flex-1 font-semibold text-muted-foreground">
                2　点选看到的特征（多选软匹配）
              </Text>
              {activeTraits.length > 0 ? (
                <Pressable
                  role="button"
                  accessibilityLabel="重置特征筛选"
                  onPress={resetTraits}
                  hitSlop={8}
                  className="min-h-11 shrink-0 justify-center active:opacity-60"
                >
                  <Text variant="footnote" className="font-semibold text-primary">
                    重置
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {traitGroups.map((group) => (
              <View key={group.id} className="gap-1.5">
                <Text variant="footnote" className="text-muted-foreground">
                  {group.label}
                </Text>
                <ChipRow>
                  {group.options.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.label}
                      appearance="tint"
                      selected={activeTraits.includes(option.id)}
                      onPress={() => handleToggleTrait(option.id)}
                    />
                  ))}
                </ChipRow>
              </View>
            ))}
          </View>
        ) : null}

        <View className="gap-2.5">
          <View className={stacked ? "gap-1" : "flex-row items-baseline justify-between gap-row"}>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text variant="title">最像的 Top-3 候选</Text>
              <Text variant="footnote" className="text-muted-foreground tabular-nums">
                {activeTraits.length > 0 ? `已选 ${activeTraits.length} 项特征` : "未选特征，按默认排序"}
              </Text>
            </View>
            {ranked.top3.length >= 2 ? (
              <Pressable
                role="button"
                accessibilityLabel="对比前两名"
                onPress={() => openPairCompare(ranked.top3[0]!.panda.slug, ranked.top3[1]!.panda.slug)}
                hitSlop={8}
                className="min-h-11 shrink-0 flex-row items-center gap-1 self-start active:opacity-60"
              >
                <Icon icon={ArrowLeftRight} size="footnote" tone="tint" strokeWidth={2} />
                <Text variant="subheadline" className="font-semibold text-primary">
                  对比前两名
                </Text>
              </Pressable>
            ) : null}
          </View>

          {displayed.length === 0 ? (
            <ScreenState
              message="当前条件暂无可匹配的在世熊猫，试试切回全部场馆。"
              actionLabel={selectedVenueSlug !== null ? "切回全部场馆" : undefined}
              onAction={selectedVenueSlug !== null ? () => selectVenue(null) : undefined}
            />
          ) : (
            <View className="gap-2">
              {displayed.map((candidate, index) => {
                const { panda, matchedTraits, faceSummary } = candidate;
                const checked = activeCompareSlugSet.has(panda.slug);
                const meta = formatCandidateMeta(panda);
                const badge =
                  activeTraits.length > 0
                    ? `命中 ${matchedTraits.length}/${activeTraits.length}`
                    : `第 ${index + 1} 顺位`;
                const highlight = index === 0 && matchedTraits.length > 0;

                return (
                  <View
                    key={panda.id}
                    className="flex-row items-center gap-3 rounded-group border-hairline border-border bg-card p-3"
                    style={{ borderCurve: "continuous" }}
                  >
                    <Pressable
                      role="link"
                      accessibilityLabel={`${panda.name}，${badge}${meta ? `，${meta}` : ""}`}
                      onPress={() => openPanda(panda.slug)}
                      className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-75"
                    >
                      <PandaThumb pandaId={panda.id} name={panda.name} size={56} shape="round" />
                      <View className="min-w-0 flex-1 gap-1">
                        <View className="flex-row items-baseline justify-between gap-2">
                          <Text variant="headline" className="min-w-0 flex-1" numberOfLines={stacked ? undefined : 1}>
                            {panda.name}
                          </Text>
                          <Text
                            variant="footnote"
                            className={cn(
                              "shrink-0 font-semibold tabular-nums",
                              highlight ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {badge}
                          </Text>
                        </View>
                        {meta ? (
                          <Text
                            variant="footnote"
                            className="text-muted-foreground tabular-nums"
                            numberOfLines={stacked ? undefined : 1}
                          >
                            {meta}
                          </Text>
                        ) : null}
                        {matchedTraits.length > 0 ? (
                          <View className="flex-row flex-wrap gap-1 pt-0.5">
                            {matchedTraits.map((trait) => (
                              <View
                                key={trait.id}
                                className="rounded-pill bg-highlight-soft px-2 py-0.5"
                                style={{ borderCurve: "continuous" }}
                              >
                                <Text variant="footnote" className="font-semibold text-primary">
                                  {trait.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : faceSummary ? (
                          <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                            {faceSummary}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>

                    <Pressable
                      role="button"
                      accessibilityLabel={checked ? `取消对比${panda.name}` : `加入对比${panda.name}`}
                      accessibilityState={{ selected: checked }}
                      onPress={() => handleToggleCompare(panda.slug)}
                      className={cn(
                        "min-h-11 shrink-0 justify-center rounded-pill border-hairline px-3 active:opacity-75",
                        checked ? "border-primary bg-primary" : "border-border bg-background",
                      )}
                      style={{ borderCurve: "continuous" }}
                    >
                      <Text
                        variant="footnote"
                        className={cn(
                          "font-semibold",
                          checked ? "text-primary-foreground" : "text-foreground",
                        )}
                      >
                        {checked ? "已选对比" : "加对比"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {ranked.candidates.length > 3 ? (
            <Pressable
              role="button"
              accessibilityLabel={expanded ? "只看 Top-3 候选" : `展开其余 ${hiddenCount} 只候选`}
              onPress={() => setExpanded((prev) => !prev)}
              className="min-h-11 items-center justify-center rounded-group border-hairline border-border bg-card px-4 py-2.5 active:opacity-75"
              style={{ borderCurve: "continuous" }}
            >
              <Text variant="subheadline" className="font-semibold text-primary tabular-nums">
                {expanded ? "只看 Top-3 候选" : `展开其余 ${hiddenCount} 只候选`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View
        className="border-t-hairline border-border bg-background px-gutter pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View style={PAGE_COLUMN}>
          <Button
            variant={readyCompare ? "default" : "secondary"}
            disabled={!readyCompare}
            accessibilityLabel={footerLabel}
            className={stacked ? "h-auto min-h-12 py-2.5" : undefined}
            onPress={() => {
              if (!readyCompare) return;
              openPairCompare(activeComparePandas[0]!.slug, activeComparePandas[1]!.slug);
            }}
          >
            <Icon
              icon={ArrowLeftRight}
              size="subhead"
              tone={readyCompare ? "onButton" : "secondary"}
              strokeWidth={2}
            />
            <Text
              numberOfLines={stacked ? undefined : 1}
              className={cn("min-w-0 shrink text-center", stacked && "whitespace-normal")}
            >
              {footerLabel}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
