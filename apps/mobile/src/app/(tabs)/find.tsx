import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadFailed } from "@/components/load-failed";
import { NavRow } from "@/components/nav-row";
import { PageHeader } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { loadInstitutionList } from "@/features/institutions/institutions";
import { areaChips } from "@/features/pandas/areas";
import { PandaRow } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";

export default function FindScreen() {
  const insets = useSafeAreaInsets();
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

  return (
    <View className="flex-1 bg-background">
      <View className="gap-4 px-5 pb-3" style={{ paddingTop: insets.top + 12 }}>
        <PageHeader title="找熊猫" back={false} />
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
      </View>

      {pandas ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <PandaRow item={item} last={index === results.length - 1} />}
          contentContainerClassName="px-5 pb-12"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            deferredQuery.trim() || area !== "全部" ? undefined : (
              <View className="mb-3">
                {hasInstitutions ? <NavRow label="基地和动物园" href="/institutions" /> : null}
                <NavRow label="查两只熊猫的关系" href="/relationship" last />
              </View>
            )
          }
          ListEmptyComponent={<Text className="py-4 text-muted-foreground">{`没有找到「${deferredQuery.trim()}」`}</Text>}
        />
      ) : failed ? (
        <LoadFailed message="熊猫列表暂时打不开。" onRetry={retry} className="mx-5" />
      ) : (
        <View className="gap-3 px-5 pt-2.5" accessibilityLabel="正在加载熊猫列表">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <View key={key} className="flex-row items-center gap-3">
              <Skeleton className="size-14" />
              <View className="flex-1 gap-2">
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
