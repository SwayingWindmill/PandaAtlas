import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { FlatList, Platform, ScrollView, View, useWindowDimensions } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { SectionHeader } from "@/components/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { loadInstitutionList } from "@/features/institutions/institutions";
import { areaChips } from "@/features/pandas/areas";
import { PandaRow } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { localToday } from "@/features/engagement/seen";
import { ExploreCard } from "@/features/pandas/explore-card";
import { useStoryPhotos } from "@/features/today/story-photos";

const GAP = 12;
/** 今天 takes the day's first four story photos; 找熊猫 takes the next ones, so no panda repeats. */
const TODAY_STORIES = 4;

export default function FindScreen() {
  const { width } = useWindowDimensions();
  const photos = useStoryPhotos(localToday(), TODAY_STORIES + 4).slice(TODAY_STORIES);
  const card = Math.round(Math.min((Math.min(width, 700) - 32) * 0.78, 320));
  const [pandas, setPandas] = useState<PandaListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(() => {
    loadPandaIndex()
      .then(setPandas)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  // The entry appears once a release publishes institutions; until then there is nothing behind it.
  const [hasInstitutions, setHasInstitutions] = useState(false);
  useEffect(() => {
    loadInstitutionList()
      .then((institutions) => setHasInstitutions(institutions.length > 0))
      .catch(() => setHasInstitutions(false));
  }, []);

  const [area, setArea] = useState("全部");
  const chips = useMemo(() => (pandas ? areaChips(pandas) : []), [pandas]);
  const results = useMemo(() => {
    const found = pandas ? searchPandas(pandas, deferredQuery) : [];
    return area === "全部" ? found : found.filter((panda) => panda.area === area);
  }, [pandas, deferredQuery, area]);
  const browsing = !deferredQuery.trim() && area === "全部";
  const explore = [
    { id: "map", title: "熊猫在哪里", href: "/map" as const },
    ...(hasInstitutions ? [{ id: "institutions", title: "基地和动物园", href: "/institutions" as const }] : []),
    { id: "relationship", title: "查两只熊猫的关系", href: "/relationship" as const },
    // The user picks both pandas on /compare; nothing here proposes a pair.
    { id: "compare", title: "比一比两只熊猫", href: "/compare" as const },
  ];

  return (
    <View className="flex-1 bg-background">
      {/* While loading or after a failure the list header isn't there, so the web title stands on its own. */}
      {!pandas && Platform.OS === "web" ? (
        <Text variant="display" className="px-4">
          找熊猫
        </Text>
      ) : null}
      {pandas ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <PandaRow item={item} first={index === 0} last={index === results.length - 1} />
          )}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-4 pb-28"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="gap-stack pb-row">
              {Platform.OS === "web" ? <Text variant="display">找熊猫</Text> : null}
              <SearchField value={query} onChange={setQuery} />
              {chips.length > 0 ? (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={area}
                  onValueChange={(value) => setArea(value ?? "全部")}
                  accessibilityLabel="按地方看"
                >
                  {["全部", ...chips].map((chip) => (
                    <ToggleGroupItem key={chip} value={chip} accessibilityLabel={chip}>
                      <Text>{chip}</Text>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ) : null}
              {browsing ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="-mx-4"
                  contentContainerClassName="px-4"
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
      ) : failed ? (
        <LoadFailed message="熊猫列表暂时打不开。" onRetry={retry} className="mx-4" />
      ) : (
        <View className="gap-row px-4 pt-row" accessibilityLabel="正在加载熊猫列表">
          <Skeleton className="h-11 rounded-control" />
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
    </View>
  );
}
