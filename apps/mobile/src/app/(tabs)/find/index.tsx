import { useQuery } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { type ComponentProps, type ReactNode, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/chip";
import { Chevron, SectionTitle, useSingleColumn, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Landmark, LayoutGrid, List, ScanFace, Waypoints } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { BARLESS_TOP, ROOT_TITLE_IN_COLUMN } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { PressScale } from "@/components/press-scale";
import { SectionHeader } from "@/components/section-header";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { useFollowed } from "@/features/engagement/favorites";
import { useSeenIds } from "@/features/engagement/use-seen-ids";
import { pickStarStrip } from "@/features/explore/gallery-filter";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { mapViewQueryOptions } from "@/features/map/load";
import { fameSlugs, wellKnownPandas } from "@/features/onboarding/suggestions";
import {
  buildFindChips,
  type FindVenueMatch,
  filterPandasMulti,
  hasActiveFindFilter,
  matchFindVenues,
  toggleFindChip,
} from "@/features/pandas/find-filter";
import { FindGalleryCard } from "@/features/pandas/find-gallery-card";
import { highlightParts } from "@/features/pandas/highlight";
import { PandaRow } from "@/features/pandas/panda-row";
import { type PandaListItem, pandaIndexQueryOptions, searchPandas } from "@/features/pandas/pandas";
import { POPULAR_SHOWN, usePopularPandas } from "@/features/pandas/popular";
import { RecentSearches, RecentViews } from "@/features/pandas/recent-blocks";
import { recordSearch } from "@/features/pandas/recent";
import { SearchField } from "@/features/pandas/search-field";
import { useSpecialChips } from "@/features/pandas/special-chips";
import { venueStatusColorOf } from "@/features/viewing/venue-live-card";
import { buildVenueLiveSnapshot } from "@/features/viewing/venue-live";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { selectionHaptic } from "@/lib/haptics";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { PAGE_COLUMN, pageColumn } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * iOS searches from the system search bar under the large title, which the bar and its Liquid Glass
 * own; Android and the web keep the in-page field.
 */
const SYSTEM_SEARCH = Platform.OS === "ios";
const PAGE_SIZE = 24;
const VENUE_PREVIEW_COUNT = 3;
const GRID_GAP = semantic.spacing.row.value;
type SearchBarRef = NonNullable<ComponentProps<typeof Stack.SearchBar>["ref"]>;
type FindViewMode = "gallery" | "list";

function FindToolCard({
  href,
  title,
  subtitle,
  stacked,
  fullWidth = false,
  visual,
}: {
  href: "/identify" | "/relationship" | "/learn";
  title: string;
  subtitle: string;
  stacked: boolean;
  fullWidth?: boolean;
  visual: ReactNode;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={() => router.push(href)}
      className={cn(
        "min-h-11 flex-row items-center gap-2.5 rounded-group bg-card px-3 py-3 active:opacity-75",
        !stacked && !fullWidth && "min-w-0 flex-1",
      )}
      style={{ borderCurve: "continuous" }}
    >
      <View className="min-w-0 flex-1 gap-hair-gap">
        <Text variant="headline" numberOfLines={stacked ? undefined : 2}>
          {title}
        </Text>
        <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
          {subtitle}
        </Text>
      </View>
      {visual}
    </Pressable>
  );
}

/** Focused discovery shortcuts with live covered panda previews when available. */
function FindTools({ pandas, popular }: { pandas: readonly PandaListItem[]; popular: readonly PandaListItem[] }) {
  const stacked = useStacked();
  const coveredTools = useMemo(() => {
    const coveredPandas = pandas.filter((panda) => panda.hasFullBleedCover);
    const coveredPopular = popular.filter((panda) => panda.hasFullBleedCover);
    return pickStarStrip(coveredPandas, coveredPopular, 3);
  }, [pandas, popular]);
  const pair = coveredTools.length >= 2 ? coveredTools.slice(0, 2) : null;
  const faceTile = coveredTools[2] ?? coveredTools[0] ?? null;

  return (
    <View className="gap-2.5">
      <FindToolCard
        href="/identify"
        title="现场认熊"
        subtitle="按场馆与特征快速筛出候选，支持离线双图对比"
        stacked={stacked}
        fullWidth
        visual={
          <View className="shrink-0 flex-row items-center gap-1" aria-hidden>
            <Icon icon={ScanFace} size="body" tone="tint" strokeWidth={2} />
            <Chevron />
          </View>
        }
      />
      <View className={stacked ? "gap-2.5" : "flex-row gap-2.5"}>
        <FindToolCard
          href="/relationship"
          title="查关系"
          subtitle="谱系亲缘链"
          stacked={stacked}
          visual={
            pair ? (
              <View className="shrink-0 flex-row items-center" aria-hidden>
                <PandaThumb pandaId={pair[0]!.id} name={pair[0]!.name} size={28} shape="round" />
                <View className="h-0.5 w-2.5 bg-primary" />
                <PandaThumb pandaId={pair[1]!.id} name={pair[1]!.name} size={28} shape="round" />
              </View>
            ) : (
              <Icon icon={Waypoints} size="body" tone="tint" strokeWidth={2} />
            )
          }
        />
        <FindToolCard
          href="/learn"
          title="认脸图鉴"
          subtitle="眼斑与脸型"
          stacked={stacked}
          visual={
            faceTile ? (
              <View className="shrink-0" style={{ transform: [{ rotate: "-4deg" }] }} aria-hidden>
                <PandaThumb pandaId={faceTile.id} name={faceTile.name} size={34} shape="tile" />
              </View>
            ) : (
              <Icon icon={ScanFace} size="body" tone="tint" strokeWidth={2} />
            )
          }
        />
      </View>
    </View>
  );
}

function MatchedVenueCard({
  venue,
  query,
  now,
  stacked,
  onOpen,
}: {
  venue: FindVenueMatch;
  query: string;
  now: Date;
  stacked: boolean;
  onOpen: () => void;
}) {
  const colors = useIOSColors();
  const snapshot = buildVenueLiveSnapshot(venue.slug, venue.liveCamUrl, now);
  const statusColor = snapshot ? venueStatusColorOf(snapshot.status, colors) : null;
  const nameParts = highlightParts(venue.name, query);
  const metaItems = [
    venue.countryLabel,
    venue.residentCount > 0 ? `${venue.residentCount} 只在馆` : venue.kindLabel,
  ].filter((value): value is string => Boolean(value));
  const metaText = metaItems.join("　");
  const spoken = [
    venue.name,
    snapshot ? `当地 ${snapshot.localTime}，${snapshot.statusLabel}` : null,
    metaItems.join("，") || null,
  ]
    .filter(Boolean)
    .join("，");

  return (
    <PressScale
      role="link"
      accessibilityLabel={spoken}
      onPress={() => {
        onOpen();
        router.push({ pathname: "/institutions/[slug]", params: { slug: venue.slug } });
      }}
      className="flex-row items-center gap-row rounded-group bg-card px-inset py-row"
      style={{ borderCurve: "continuous" }}
    >
      {venue.leadPanda ? (
        <PandaThumb pandaId={venue.leadPanda.id} name={venue.leadPanda.name} size={52} shape="tile" />
      ) : (
        <View className="items-center justify-center" style={{ width: 52, height: 52 }} aria-hidden>
          <Icon icon={Landmark} size="body" tone="secondary" />
        </View>
      )}
      <View className="min-w-0 flex-1 gap-hair-gap">
        <Text variant="headline" numberOfLines={stacked ? undefined : 2}>
          {nameParts
            ? nameParts.map((part, index) =>
                part.hit ? (
                  <Text key={index} variant="headline" className="text-primary">
                    {part.text}
                  </Text>
                ) : (
                  part.text
                ),
              )
            : venue.name}
        </Text>
        {snapshot || metaText ? (
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
            {snapshot && statusColor ? (
              <View className="flex-row items-center gap-1.5">
                <View className="size-2 rounded-pill" style={{ backgroundColor: statusColor }} />
                <Text variant="footnote" className="font-semibold tabular-nums" style={{ color: statusColor }}>
                  {`当地 ${snapshot.localTime}　${snapshot.statusLabel}`}
                </Text>
              </View>
            ) : null}
            {metaText ? (
              <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={stacked ? undefined : 1}>
                {metaText}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {stacked ? null : <Chevron />}
    </PressScale>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: FindViewMode;
  onChange: (next: FindViewMode) => void;
}) {
  return (
    <View role="radiogroup" accessibilityLabel="展示方式" className="shrink-0 flex-row items-center rounded-pill bg-secondary p-0.5">
      {(
        [
          { key: "gallery" as const, label: "画廊", icon: LayoutGrid },
          { key: "list" as const, label: "列表", icon: List },
        ] as const
      ).map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            role="radio"
            aria-checked={selected}
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label}模式`}
            onPress={() => onChange(option.key)}
            className="-my-1.5 min-h-11 justify-center active:opacity-75"
          >
            <View className={cn("min-h-8 flex-row items-center gap-1 rounded-pill px-2.5 py-1", selected && "bg-background")}>
              <Icon icon={option.icon} size="footnote" tone={selected ? "label" : "secondary"} strokeWidth={2} />
              <Text variant="footnote" className={cn("font-semibold", selected ? "text-foreground" : "text-muted-foreground")}>
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function FindScreen() {
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const stacked = useStacked();
  const singleColumn = useSingleColumn();
  // Android has no bar on a tab root, so the column clears the status bar itself.
  const top = Platform.OS === "android" ? insets.top + BARLESS_TOP : 0;

  const { data: pandas, isError: failed, refetch } = useQuery(pandaIndexQueryOptions());
  const { data: institutions } = useQuery(institutionListQueryOptions());
  const { data: mapView } = useQuery(mapViewQueryOptions());
  const seenIds = useSeenIds();
  const followedIds = useFollowed();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<FindViewMode>("gallery");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [venuesExpanded, setVenuesExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const special = useSpecialChips();
  const chips = useMemo(() => (pandas ? buildFindChips(pandas, special) : []), [pandas, special]);
  const activeChips = useMemo(() => selectedChips.filter((chip) => chips.includes(chip)), [selectedChips, chips]);
  const hasFilter = hasActiveFindFilter(activeChips);
  const trimmedQuery = deferredQuery.trim();
  const searching = trimmedQuery.length > 0;
  const browsing = !searching && !hasFilter;

  const { rows: popular } = usePopularPandas(pandas);
  const matchedVenues = useMemo(
    () => (searching && institutions ? matchFindVenues(institutions, mapView?.items, trimmedQuery) : []),
    [searching, institutions, mapView?.items, trimmedQuery],
  );
  const results = useMemo(() => {
    const found = pandas ? searchPandas(pandas, deferredQuery, fameSlugs(popular)) : [];
    return filterPandasMulti(found, activeChips, special);
  }, [pandas, deferredQuery, popular, activeChips, special]);

  const orderedResults = useMemo(() => {
    if (viewMode === "list") return results;
    const covered: PandaListItem[] = [];
    const coverless: PandaListItem[] = [];
    for (const item of results) {
      if (item.hasFullBleedCover) covered.push(item);
      else coverless.push(item);
    }
    return [...covered, ...coverless];
  }, [results, viewMode]);

  const visibleItems = useMemo(() => orderedResults.slice(0, visibleLimit), [orderedResults, visibleLimit]);
  const coveredVisible = useMemo(
    () => (viewMode === "gallery" ? visibleItems.filter((item) => item.hasFullBleedCover) : []),
    [viewMode, visibleItems],
  );
  const coverlessVisible = useMemo(
    () => (viewMode === "gallery" ? visibleItems.filter((item) => !item.hasFullBleedCover) : visibleItems),
    [viewMode, visibleItems],
  );
  const remainingCount = orderedResults.length - visibleItems.length;

  const galleryColumns = singleColumn ? 1 : 2;
  const cardWidth = Math.floor((pageColumn(width) - GRID_GAP * (galleryColumns - 1)) / galleryColumns);

  const searchBarRef: SearchBarRef = useRef(null);
  const noResultRows = useMemo(
    () => (popular.length > 0 ? popular : wellKnownPandas(pandas ?? []).slice(0, POPULAR_SHOWN)),
    [popular, pandas],
  );
  const rememberSearch = useCallback(() => void recordSearch(query), [query]);

  function updateQuery(text: string) {
    setQuery(text);
    setVisibleLimit(PAGE_SIZE);
    setVenuesExpanded(false);
  }

  function pickSearch(text: string) {
    updateQuery(text);
    searchBarRef.current?.setText(text);
  }

  function handleChipPress(chip: string) {
    setSelectedChips((prev) => toggleFindChip(prev, chip));
    setVisibleLimit(PAGE_SIZE);
  }

  function resetFilters() {
    setSelectedChips([]);
    setVisibleLimit(PAGE_SIZE);
  }

  function changeViewMode(next: FindViewMode) {
    if (next === viewMode) return;
    selectionHaptic();
    setViewMode(next);
    setVisibleLimit(PAGE_SIZE);
  }

  const searchBar = SYSTEM_SEARCH ? (
    <Stack.SearchBar
      ref={searchBarRef}
      placement="stacked"
      hideWhenScrolling={false}
      obscureBackground={false}
      placeholder="名字、拼音、场馆或谱系号"
      autoCapitalize="none"
      onChangeText={(event) => updateQuery(event.nativeEvent.text)}
      onCancelButtonPress={() => updateQuery("")}
    />
  ) : null;

  if (pandas) {
    const shownVenues = venuesExpanded ? matchedVenues : matchedVenues.slice(0, VENUE_PREVIEW_COUNT);
    const hiddenVenues = matchedVenues.length - shownVenues.length;
    const resultsTitle = searching ? "匹配大熊猫" : hasFilter ? "符合条件" : "全部熊猫";

    return (
      <>
        {searchBar}
        <StatusBarCover />
        <ScrollView
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-gutter"
          refreshControl={refreshControl}
          contentContainerStyle={[PAGE_COLUMN, { paddingTop: top, paddingBottom: bottom }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-stack">
            {ROOT_TITLE_IN_COLUMN ? (
              <View className="flex-row items-baseline justify-between gap-row">
                <Text variant="display">找熊猫</Text>
                <Text variant="footnote" className="text-muted-foreground tabular-nums">
                  {searching ? "聚合搜索" : `已收录 ${pandas.length} 只`}
                </Text>
              </View>
            ) : null}

            {SYSTEM_SEARCH ? null : (
              <SearchField value={query} onChange={updateQuery} placeholder="名字、拼音、场馆或谱系号" />
            )}

            {chips.length > 0 ? (
              <View className="flex-row items-center gap-row">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className={hasFilter ? "-ml-gutter min-w-0 flex-1" : "-mx-gutter min-w-0 flex-1"}
                  contentContainerClassName={
                    hasFilter ? "gap-stack-tight pl-gutter pr-stack-tight" : "gap-stack-tight px-gutter"
                  }
                  accessibilityLabel="筛选条件"
                >
                  <Chip label="全部" appearance="ink" selected={!hasFilter} onPress={resetFilters} />
                  {chips.map((chip) => (
                    <Chip
                      key={chip}
                      label={chip}
                      appearance="ink"
                      selected={activeChips.includes(chip)}
                      onPress={() => handleChipPress(chip)}
                    />
                  ))}
                </ScrollView>
                {hasFilter ? (
                  <Pressable
                    role="button"
                    accessibilityLabel="重置筛选"
                    onPress={resetFilters}
                    hitSlop={8}
                    className="min-h-11 shrink-0 justify-center active:opacity-60"
                  >
                    <Text variant="subheadline" className="font-semibold text-primary">
                      重置
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {browsing ? <RecentViews pandas={pandas} /> : null}
            {browsing ? <RecentSearches onPick={pickSearch} /> : null}
            {browsing ? <FindTools pandas={pandas} popular={popular} /> : null}

            {searching && matchedVenues.length > 0 ? (
              <View className="gap-stack-tight">
                <SectionHeader title="匹配场馆" count={`${matchedVenues.length} 处`} />
                <View className="gap-stack-tight">
                  {shownVenues.map((venue) => (
                    <MatchedVenueCard
                      key={venue.slug}
                      venue={venue}
                      query={trimmedQuery}
                      now={now}
                      stacked={stacked}
                      onOpen={rememberSearch}
                    />
                  ))}
                </View>
                {matchedVenues.length > VENUE_PREVIEW_COUNT ? (
                  <Pressable
                    role="button"
                    accessibilityLabel={venuesExpanded ? "收起部分场馆" : `展开其余 ${hiddenVenues} 处场馆`}
                    onPress={() => setVenuesExpanded((prev) => !prev)}
                    className="min-h-11 items-center justify-center rounded-group border-hairline border-border bg-card px-4 py-2 active:opacity-75"
                    style={{ borderCurve: "continuous" }}
                  >
                    <Text variant="subheadline" className="font-semibold text-primary tabular-nums">
                      {venuesExpanded ? "收起部分场馆" : `展开其余 ${hiddenVenues} 处场馆`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {results.length > 0 ? (
              <View className="gap-row">
                <View className={cn("gap-row", stacked ? "items-start" : "flex-row items-center justify-between")}>
                  <Text variant="title" className={cn(!stacked && "min-w-0 flex-1")} numberOfLines={stacked ? undefined : 2}>
                    {resultsTitle}
                    <Text variant="body" className="font-normal text-muted-foreground tabular-nums">
                      {`　${results.length} 只`}
                    </Text>
                  </Text>
                  <ViewModeToggle value={viewMode} onChange={changeViewMode} />
                </View>

                {coveredVisible.length > 0 ? (
                  <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
                    {coveredVisible.map((item) => (
                      <FindGalleryCard
                        key={item.id}
                        item={item}
                        width={cardWidth}
                        singleColumn={singleColumn}
                        seen={Boolean(seenIds?.has(item.id))}
                        followed={Boolean(followedIds?.has(item.id))}
                        onOpen={rememberSearch}
                      />
                    ))}
                  </View>
                ) : null}

                {coverlessVisible.length > 0 ? (
                  <View className="gap-1.5">
                    {coveredVisible.length > 0 ? <SectionTitle title="更多大熊猫" /> : null}
                    <View>
                      {coverlessVisible.map((item, index) => (
                        <PandaRow
                          key={item.id}
                          item={item}
                          first={index === 0}
                          last={index === coverlessVisible.length - 1}
                          highlight={deferredQuery}
                          onOpen={rememberSearch}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {remainingCount > 0 ? (
                  <Pressable
                    role="button"
                    accessibilityLabel={`显示更多，还有 ${remainingCount} 只`}
                    onPress={() => setVisibleLimit((limit) => limit + PAGE_SIZE)}
                    className="min-h-11 flex-row items-center justify-center rounded-group border-hairline border-border bg-card px-4 py-2.5 active:opacity-75"
                    style={{ borderCurve: "continuous" }}
                  >
                    <Text variant="subheadline" className="font-semibold text-primary tabular-nums">
                      {`显示更多（还有 ${remainingCount} 只）`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View className="items-center gap-stack-tight py-page">
                <Text variant="headline">
                  {searching ? `没有找到「${trimmedQuery}」相关的大熊猫` : "没有找到符合条件的熊猫"}
                </Text>
                <Text variant="subheadline" className="text-center text-muted-foreground">
                  {searching
                    ? hasFilter
                      ? "试试点按「全部」清除筛选，或换一个名字与谱系号。"
                      : "试试拼音首字母（如 fb），或场馆名与谱系号。"
                    : "试试取消部分筛选条件，或点按「全部」查看全部熊猫。"}
                </Text>
                {hasFilter ? (
                  <Pressable
                    role="button"
                    accessibilityLabel="重置筛选条件"
                    onPress={resetFilters}
                    className="mt-1 min-h-11 justify-center rounded-pill bg-highlight-soft px-5 active:opacity-75"
                  >
                    <Text variant="subheadline" className="font-semibold text-primary">
                      重置筛选
                    </Text>
                  </Pressable>
                ) : null}
                {searching && matchedVenues.length === 0 && noResultRows.length > 0 ? (
                  <View className="mt-stack w-full gap-stack-tight">
                    <SectionHeader title="大家常看" />
                    <View>
                      {noResultRows.map((item, index) => (
                        <PandaRow key={item.id} item={item} first={index === 0} last={index === noResultRows.length - 1} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
      </>
    );
  }

  // Before the list is there, the loading and failure states scroll the same way, with the web title of their own.
  return (
    <>
      {searchBar}
      <StatusBarCover />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[PAGE_COLUMN, { paddingTop: top, paddingBottom: bottom }]}
      >
        {ROOT_TITLE_IN_COLUMN ? (
          <Text variant="display" className="px-gutter">
            找熊猫
          </Text>
        ) : null}
        {failed ? (
          <LoadFailed message="熊猫列表暂时打不开。" onRetry={() => void refetch()} className="mx-gutter" />
        ) : (
          <View className="gap-row px-gutter pt-row" accessibilityLabel="正在加载熊猫列表">
            {SYSTEM_SEARCH ? null : <Skeleton className="h-11 rounded-control" />}
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <View key={key} className="flex-row items-center gap-row">
                <Skeleton className="size-11 rounded-full" />
                <View className="flex-1 gap-stack-tight">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-3 w-40 rounded-full" />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}
