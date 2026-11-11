import { useQuery } from "@tanstack/react-query";
import { View, useWindowDimensions } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ComparisonCard, pairOf } from "@/features/discover/comparison-card";
import { comparisonsQueryOptions } from "@/features/discover/comparisons";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { pageColumn } from "@/lib/surface";

/** Every published 比一比, newest first, each card the column's width. */
export default function ComparisonsScreen() {
  const { width } = useWindowDimensions();
  const column = pageColumn(width);
  const comparisons = useQuery(comparisonsQueryOptions());
  const { data: pandas } = useQuery(pandaIndexQueryOptions());
  const cards = (comparisons.data ?? []).flatMap((comparison) => {
    const pair = pairOf(comparison, pandas);
    return pair ? [{ comparison, pair }] : [];
  });

  return (
    <Page title="比一比">
      {comparisons.isError ? (
        <LoadFailed message="比一比暂时打不开。" onRetry={() => void comparisons.refetch()} />
      ) : !comparisons.data || !pandas ? (
        <View className="gap-section" accessibilityLabel="正在加载比一比">
          <Skeleton className="w-full rounded-tile" style={{ height: column * 0.75 }} />
          <Skeleton className="w-full rounded-tile" style={{ height: column * 0.75 }} />
        </View>
      ) : cards.length === 0 ? (
        <ScreenState message="还没有发布的比一比。" />
      ) : (
        <View className="gap-section">
          {cards.map(({ comparison, pair }) => (
            <ComparisonCard key={comparison.id} comparison={comparison} pandas={pair} width={column} />
          ))}
        </View>
      )}
    </Page>
  );
}
