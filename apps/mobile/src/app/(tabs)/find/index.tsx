import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useDeferredValue, useMemo, useState } from "react";
import { FlatList, Platform, ScrollView, View, useWindowDimensions } from "react-native";

import { Chip } from "@/components/chip";
import { Columns, House, MapPin, Network, Plane, Users } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { SectionHeader } from "@/components/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { areaChips } from "@/features/pandas/areas";
import { SPECIAL_CHIPS, type SpecialChips, isSpecialChip, useSpecialChips } from "@/features/pandas/special-chips";
import { PandaRow } from "@/features/pandas/panda-row";
import { pandaIndexQueryOptions, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { localToday } from "@/features/engagement/seen";
import { ExploreCard } from "@/features/pandas/explore-card";
import { useStoryPhotos } from "@/features/today/story-photos";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { pageColumn } from "@/lib/surface";

const GAP = 12;

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
/** 今天 takes the day's first four story photos; 找熊猫 takes the next ones, so no panda repeats. */
const TODAY_STORIES = 4;

export default function FindScreen() {
  const { width } = useWindowDimensions();
  const bottom = useBottomClearance();
  const photos = useStoryPhotos(localToday(), TODAY_STORIES + 4).slice(TODAY_STORIES);
  const card = Math.round(Math.min(pageColumn(width) * 0.42, 200));
  const { data: pandas, isError: failed, refetch } = useQuery(pandaIndexQueryOptions());
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  // The entry appears once a release publishes institutions; until then there is nothing behind it.
  const { data: institutions } = useQuery(institutionListQueryOptions());
  const hasInstitutions = (institutions?.length ?? 0) > 0;

  const [area, setArea] = useState("全部");
  const special = useSpecialChips();
  const chips = useMemo(() => (pandas ? findChips(pandas, special) : []), [pandas, special]);
  const results = useMemo(() => {
    const found = pandas ? searchPandas(pandas, deferredQuery) : [];
    return found.filter((panda) => inChip(panda, area, special));
  }, [pandas, deferredQuery, area, special]);
  const browsing = !deferredQuery.trim() && area === "全部";
  const explore = [
    { id: "returning", title: "归国熊猫", icon: Plane, href: "/returning" as const },
    { id: "look-alikes", title: "双胞胎", spoken: "双胞胎和像的熊猫", icon: Users, href: "/look-alikes" as const },
    { id: "map", title: "熊猫在哪里", icon: MapPin, href: "/map" as const },
    ...(hasInstitutions ? [{ id: "institutions", title: "场馆", spoken: "基地和动物园", icon: House, href: "/institutions" as const }] : []),
    { id: "relationship", title: "查关系", spoken: "查两只熊猫的关系", icon: Network, href: "/relationship" as const },
    // The user picks both pandas on /compare; nothing here proposes a pair.
    { id: "compare", title: "比一比", spoken: "比一比两只熊猫", icon: Columns, href: "/compare" as const },
  ];

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
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <PandaRow item={item} first={index === 0} last={index === results.length - 1} />
          )}
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-gutter"
          contentContainerStyle={{ paddingBottom: bottom }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="gap-stack pb-row">
              {Platform.OS === "web" ? <Text variant="display">找熊猫</Text> : null}
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
              {browsing ? <SectionHeader title="探索" /> : null}
              {browsing ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="-mx-gutter"
                  contentContainerClassName="px-gutter"
                  contentContainerStyle={{ gap: GAP }}
                  snapToInterval={card + GAP}
                  snapToAlignment="start"
                  decelerationRate="fast"
                >
                  {explore.map((entry, index) => (
                    <ExploreCard
                      key={entry.id}
                      id={entry.id}
                      title={entry.title}
                      spoken={"spoken" in entry ? entry.spoken : undefined}
                      icon={entry.icon}
                      href={entry.href}
                      photo={photos[index]}
                      width={card}
                    />
                  ))}
                </ScrollView>
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
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: bottom }}
      >
        {Platform.OS === "web" ? (
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
