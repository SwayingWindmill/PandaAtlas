import { useQuery } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { type ComponentProps, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/chip";
import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { type LucideIcon, Network, ScanFace } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { BARLESS_TOP, ROOT_TITLE_IN_COLUMN } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { fameSlugs, wellKnownPandas } from "@/features/onboarding/suggestions";
import { buildFindChips, matchesFindChip } from "@/features/pandas/find-filter";
import { useSpecialChips } from "@/features/pandas/special-chips";
import { PandaRow } from "@/features/pandas/panda-row";
import { POPULAR_SHOWN, usePopularPandas } from "@/features/pandas/popular";
import { pandaIndexQueryOptions, searchPandas } from "@/features/pandas/pandas";
import { RecentSearches, RecentViews } from "@/features/pandas/recent-blocks";
import { recordSearch } from "@/features/pandas/recent";
import { SearchField } from "@/features/pandas/search-field";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { PAGE_COLUMN } from "@/lib/surface";
import { cn } from "@/lib/utils";

/**
 * iOS searches from the system search bar under the large title, which the bar and its Liquid Glass
 * own; Android and the web keep the in-page field.
 */
const SYSTEM_SEARCH = Platform.OS === "ios";
type SearchBarRef = NonNullable<ComponentProps<typeof Stack.SearchBar>["ref"]>;

function FindToolCard({
  href,
  icon,
  title,
  subtitle,
  stacked,
}: {
  href: "/relationship" | "/learn";
  icon: LucideIcon;
  title: string;
  subtitle: string;
  stacked: boolean;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={() => router.push(href)}
      className={cn(
        "min-h-11 flex-row items-center gap-2.5 rounded-group bg-card px-3 py-3 active:opacity-75",
        !stacked && "min-w-0 flex-1",
      )}
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={icon} size="body" tone="tint" strokeWidth={2} />
      <View className="min-w-0 flex-1 gap-hair-gap">
        <Text variant="headline" numberOfLines={stacked ? undefined : 2}>
          {title}
        </Text>
        <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
          {subtitle}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
}

/** Focused discovery shortcuts without repeating the Map tab. */
function FindTools() {
  const stacked = useStacked();
  return (
    <View className={stacked ? "gap-2.5" : "flex-row gap-2.5"}>
      <FindToolCard href="/relationship" icon={Network} title="查关系" subtitle="谱系亲缘链" stacked={stacked} />
      <FindToolCard href="/learn" icon={ScanFace} title="认脸图鉴" subtitle="眼斑与脸型" stacked={stacked} />
    </View>
  );
}

export default function FindScreen() {
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  const insets = useSafeAreaInsets();
  // Android has no bar on a tab root, so the column clears the status bar itself.
  const top = Platform.OS === "android" ? insets.top + BARLESS_TOP : 0;
  const { data: pandas, isError: failed, refetch } = useQuery(pandaIndexQueryOptions());
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [area, setArea] = useState("全部");
  const special = useSpecialChips();
  const chips = useMemo(() => (pandas ? buildFindChips(pandas, special) : []), [pandas, special]);
  const { rows: popular } = usePopularPandas(pandas);
  const results = useMemo(() => {
    const found = pandas ? searchPandas(pandas, deferredQuery, fameSlugs(popular)) : [];
    return found.filter((panda) => matchesFindChip(panda, area, special));
  }, [pandas, deferredQuery, popular, area, special]);
  const browsing = !deferredQuery.trim() && area === "全部";
  const searchBarRef: SearchBarRef = useRef(null);
  const noResultRows = useMemo(
    () => (popular.length > 0 ? popular : wellKnownPandas(pandas ?? []).slice(0, POPULAR_SHOWN)),
    [popular, pandas],
  );
  const rememberSearch = useCallback(() => void recordSearch(query), [query]);
  function pickSearch(text: string) {
    setQuery(text);
    searchBarRef.current?.setText(text);
  }

  const searchBar = SYSTEM_SEARCH ? (
    <Stack.SearchBar
      ref={searchBarRef}
      placement="stacked"
      hideWhenScrolling={false}
      obscureBackground={false}
      placeholder="名字、拼音或场馆"
      autoCapitalize="none"
      onChangeText={(event) => setQuery(event.nativeEvent.text)}
      onCancelButtonPress={() => setQuery("")}
    />
  ) : null;

  // The list is the screen's root scroll view, so the system bars track it directly: on iOS 26 the
  // tab bar stays expanded (`minimizeBehavior="never"`) while the navigation bar's scroll-edge effect follows it.
  if (pandas) {
    return (
      <>
        {searchBar}
        <StatusBarCover />
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <PandaRow
              item={item}
              first={index === 0}
              last={index === results.length - 1}
              highlight={deferredQuery}
              onOpen={rememberSearch}
            />
          )}
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-gutter"
          refreshControl={refreshControl}
          contentContainerStyle={[PAGE_COLUMN, { paddingTop: top, paddingBottom: bottom }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="gap-stack pb-row">
              {ROOT_TITLE_IN_COLUMN ? <Text variant="display">找熊猫</Text> : null}
              {SYSTEM_SEARCH ? null : <SearchField value={query} onChange={setQuery} placeholder="名字、拼音或场馆" />}
              {chips.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="-mx-gutter"
                  contentContainerClassName="gap-stack-tight px-gutter"
                  accessibilityLabel="按地方看"
                >
                  {["全部", ...chips].map((chip) => (
                    <Chip key={chip} label={chip} appearance="ink" selected={area === chip} onPress={() => setArea(chip)} />
                  ))}
                </ScrollView>
              ) : null}
              {browsing ? <RecentViews pandas={pandas} /> : null}
              {browsing ? <RecentSearches onPick={pickSearch} /> : null}
              {browsing ? <FindTools /> : null}
              {results.length > 0 ? (
                <SectionHeader
                  title={browsing ? "全部熊猫" : area !== "全部" && !deferredQuery.trim() ? area : "搜索结果"}
                  count={`${results.length} 只`}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View className="items-center gap-stack-tight py-page">
              <Text variant="headline">
                {deferredQuery.trim() ? `没有找到「${deferredQuery.trim()}」` : "这里还没有熊猫"}
              </Text>
              <Text variant="subheadline" className="text-center text-muted-foreground">
                {deferredQuery.trim()
                  ? area === "全部"
                    ? "试试拼音首字母，比如 fb；或换一个场馆名。"
                    : "试试选「全部」，或换一个地区。"
                  : "试试熊猫的名字，或换一个地方。"}
              </Text>
              {deferredQuery.trim() && noResultRows.length > 0 ? (
                <View className="mt-stack w-full gap-stack-tight">
                  <SectionHeader title="大家常看" />
                  {noResultRows.map((item, index) => (
                    <PandaRow key={item.id} item={item} first={index === 0} last={index === noResultRows.length - 1} />
                  ))}
                </View>
              ) : null}
            </View>
          }
        />
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
