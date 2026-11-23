import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { useStacked } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { StatTile } from "@/components/stat-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { longDate } from "@/features/pandas/profile";
import { placeName, placesQueryOptions } from "@/features/pandas/pandas";
import { useAccount } from "@/features/session/account";
import { type Visit, removeVisit, visitsQueryKey, visitsQueryOptions } from "@/features/visits/visits";
import { failedWithoutData } from "@/lib/query-failed";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** Visits by year, newest year first, keeping the order they came in within a year. */
function byYear(visits: Visit[]): { year: string; visits: Visit[] }[] {
  const groups = new Map<string, Visit[]>();
  for (const visit of visits) {
    const year = visit.visitedOn.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), visit]);
  }
  return [...groups].map(([year, items]) => ({ year, visits: items })).sort((a, b) => b.year.localeCompare(a.year));
}

/** The day as a calendar leaf: month over the day, as Wallet and Calendar date a pass or event. */
function DateLeaf({ date }: { date: string }) {
  const [, month, day] = date.split("-");
  return (
    <View
      className="min-w-12 items-center justify-center rounded-control bg-secondary px-hair-gap py-hair-gap"
      style={{ borderCurve: "continuous" }}
      accessible={false}
    >
      <Text variant="footnote" className="text-muted-foreground">{`${Number(month)}月`}</Text>
      <Text variant="headline" className="font-rounded tabular-nums">
        {String(Number(day))}
      </Text>
    </View>
  );
}

function VisitRow({ visit, place, last, onRemove }: { visit: Visit; place: string; last: boolean; onRemove: () => void }) {
  // At accessibility sizes 删除 moves under the place, so the name keeps the row's width.
  const stacked = useStacked();
  const remove = (
    <Pressable
      onPress={onRemove}
      role="button"
      accessibilityLabel={`删除${longDate(visit.visitedOn)}去${place}的记录`}
      className={stacked ? "min-h-11 justify-center self-start active:opacity-60" : "min-h-11 justify-center px-inset active:opacity-60"}
    >
      <Text variant="body" className="text-destructive">
        删除
      </Text>
    </Pressable>
  );
  return (
    <View>
      <View className={cn("min-h-11 flex-row gap-row py-stack-tight pl-inset", stacked ? "items-start pr-inset" : "items-center")}>
        <DateLeaf date={visit.visitedOn} />
        <View className="min-w-0 flex-1">
          <Text variant="body" accessibilityLabel={`${longDate(visit.visitedOn)}，${place}`}>
            {place}
          </Text>
          {stacked ? remove : null}
        </View>
        {stacked ? null : remove}
      </View>
      {last ? null : <View className="bg-border" style={{ height: HAIRLINE, marginLeft: 16 + 48 + 12 }} />}
    </View>
  );
}

export default function VisitsScreen() {
  const { accountId, unavailable } = useAccount();
  const queryClient = useQueryClient();
  const [removeFailed, setRemoveFailed] = useState(false);
  const stacked = useStacked();

  const list = useQuery({ ...visitsQueryOptions(accountId ?? ""), enabled: accountId !== null });
  const placeList = useQuery(placesQueryOptions());
  useRefetchOnFocus(list.refetch, accountId !== null);
  const visits = list.data && placeList.data ? list.data : null;
  const names = useMemo(
    () => new Map([...(placeList.data ?? [])].map(([id, place]) => [id, placeName(place) ?? place.nameEn ?? place.slug])),
    [placeList.data],
  );
  const failed = unavailable || failedWithoutData(list) || failedWithoutData(placeList);

  async function remove(visit: Visit) {
    setRemoveFailed(false);
    try {
      await removeVisit(visit.checkinId);
      if (accountId) {
        const queryKey = visitsQueryKey(accountId);
        await queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData<Visit[]>(queryKey, (current) =>
          current?.filter((item) => item.checkinId !== visit.checkinId),
        );
      }
    } catch {
      setRemoveFailed(true);
    }
  }

  const places = visits ? new Set(visits.map((visit) => visit.placeId)).size : 0;

  return (
    <Page title="去过的地点">
      {failed ? (
        <LoadFailed message="到访记录暂时打不开。" onRetry={() => {
            if (failedWithoutData(list)) void list.refetch();
            if (failedWithoutData(placeList)) void placeList.refetch();
          }} />
      ) : visits === null ? (
        <View className="gap-section" accessibilityLabel="正在加载到访记录">
          <View className="flex-row gap-row">
            <Skeleton className="h-20 flex-1 rounded-tile" />
            <Skeleton className="h-20 flex-1 rounded-tile" />
          </View>
          <Skeleton className="h-40 w-full rounded-group" />
        </View>
      ) : visits.length === 0 ? (
        <ScreenState message="还没有到访记录。在基地和动物园的页面点「记下今天去过」。" />
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <View className={stacked ? "gap-row" : "flex-row gap-row"}>
            <StatTile label="到访" value={`${visits.length} 次`} />
            <StatTile label="去过的地方" value={`${places} 个`} />
          </View>
          {removeFailed ? (
            <Text variant="footnote" className="px-inset text-destructive" accessibilityLiveRegion="polite">
              没能删除，请再试一次。
            </Text>
          ) : null}
          <View className="gap-section-tight">
            {byYear(visits).map((group) => (
              <View key={group.year} className="gap-1.5">
                <Text variant="footnote" role="heading" className="px-inset text-muted-foreground tabular-nums">
                  {`${group.year} 年　${group.visits.length} 次`}
                </Text>
                <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
                  {group.visits.map((visit, index) => (
                    <VisitRow
                      key={visit.checkinId}
                      visit={visit}
                      place={names.get(visit.placeId) ?? "一个地点"}
                      last={index === group.visits.length - 1}
                      onRemove={() => void remove(visit)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      )}
    </Page>
  );
}
