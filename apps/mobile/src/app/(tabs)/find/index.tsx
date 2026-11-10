import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useDeferredValue, useMemo, useState } from "react";
import { FlatList, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/chip";
import { LoadFailed } from "@/components/load-failed";
import { BARLESS_TOP, ROOT_TITLE_IN_COLUMN } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { areaChips } from "@/features/pandas/areas";
import { SPECIAL_CHIPS, type SpecialChips, isSpecialChip, useSpecialChips } from "@/features/pandas/special-chips";
import { PandaRow } from "@/features/pandas/panda-row";
import { usePopularPandas } from "@/features/pandas/popular";
import { pandaIndexQueryOptions, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";

/**
 * 在中国 and 在海外 first, then each area in China that has a panda. Overseas cities stay under 在海外,
 * so the row stays short.
 */
function findChips(pandas: { area: string | null }[], special: SpecialChips): string[] {
  const areas = areaChips(pandas);
  const china = areas.filter((area) => area !== "海外");
  return [
    ...(china.length > 0 ? ["在中国"] : []),
    ...(areas.includes("海外") ? ["在海外"] : []),
    ...SPECIAL_CHIPS.filter((chip) => special[chip].size > 0),
    ...china,
  ];
}

function inChip(panda: { area: string | null; slug: string }, chip: string, special: SpecialChips): boolean {
  const { area } = panda;
  if (chip === "全部") return true;
  if (isSpecialChip(chip)) return special[chip].has(panda.slug);
  if (chip === "在海外") return area === "海外";
  if (chip === "在中国") return area !== null && area !== "海外";
  return area === chip;
}
/**
 * iOS searches from the system search bar under the large title, which the bar and its Liquid Glass
 * own; Android and the web keep the in-page field.
 */
const SYSTEM_SEARCH = Platform.OS === "ios";

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
  const chips = useMemo(() => (pandas ? findChips(pandas, special) : []), [pandas, special]);
  const results = useMemo(() => {
    const found = pandas ? searchPandas(pandas, deferredQuery) : [];
    return found.filter((panda) => inChip(panda, area, special));
  }, [pandas, deferredQuery, area, special]);
  const browsing = !deferredQuery.trim() && area === "全部";
  const popular = usePopularPandas(pandas);

  const searchBar = SYSTEM_SEARCH ? (
    <Stack.SearchBar
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
  // tab bar minimizes as it scrolls and the navigation bar's edge effect follows it.
  if (pandas) {
    return (
      <>
        {searchBar}
        <StatusBarCover />
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <PandaRow item={item} first={index === 0} last={index === results.length - 1} />
          )}
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-gutter"
          refreshControl={refreshControl}
          contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
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
              {browsing && popular.length > 0 ? (
                <View className="gap-stack-tight">
                  <SectionHeader title="大家常看" />
                  {popular.map((item, index) => (
                    <PandaRow key={item.id} item={item} first={index === 0} last={index === popular.length - 1} />
                  ))}
                </View>
              ) : null}
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
                试试熊猫的名字，或换一个地方。
              </Text>
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
        contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
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
                <Skeleton className="size-14 rounded-control" />
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
