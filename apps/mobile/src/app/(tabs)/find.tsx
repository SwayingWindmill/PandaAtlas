import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PandaRow } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex, searchPandas } from "@/features/pandas/pandas";

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  return (
    <View className="h-12 flex-row items-center gap-2.5 rounded-full border-hairline border-input px-4">
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth={2} strokeLinecap="round">
        <Circle cx={11} cy={11} r={7} />
        <Path d="m20 20-3.5-3.5" />
      </Svg>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="名字或基地"
        placeholderTextColor={muted}
        accessibilityLabel="搜索熊猫"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        className="h-full flex-1 text-base text-foreground"
      />
    </View>
  );
}

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

  const results = useMemo(() => (pandas ? searchPandas(pandas, deferredQuery) : []), [pandas, deferredQuery]);

  return (
    <View className="flex-1 bg-background">
      <View className="gap-4 px-5 pb-3" style={{ paddingTop: insets.top + 12 }}>
        <PageHeader title="找熊猫" back={false} />
        <SearchField value={query} onChange={setQuery} />
      </View>

      {pandas ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <PandaRow item={item} last={index === results.length - 1} />}
          contentContainerClassName="px-5 pb-12"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text className="py-4 text-muted-foreground">{`没有找到「${deferredQuery.trim()}」`}</Text>}
        />
      ) : failed ? (
        <View className="mx-5 items-start gap-3 rounded-lg bg-muted p-5">
          <Text>熊猫列表暂时打不开。</Text>
          <Button onPress={retry}>
            <Text>重试</Text>
          </Button>
        </View>
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
