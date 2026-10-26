import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { longDate } from "@/features/pandas/profile";
import { loadPlaces, placeName } from "@/features/pandas/pandas";
import { type Visit, loadVisits, removeVisit } from "@/features/visits/visits";
import { cn } from "@/lib/utils";

export default function VisitsScreen() {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [failed, setFailed] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);

  const load = useCallback(() => {
    Promise.all([loadVisits(), loadPlaces()])
      .then(([loaded, places]) => {
        setNames(new Map([...places].map(([id, place]) => [id, placeName(place) ?? place.nameEn ?? place.slug])));
        setVisits(loaded);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useFocusEffect(load);

  async function remove(visit: Visit) {
    setRemoveFailed(false);
    try {
      await removeVisit(visit.checkinId);
      setVisits((current) => current?.filter((item) => item.checkinId !== visit.checkinId) ?? null);
    } catch {
      setRemoveFailed(true);
    }
  }

  return (
    <Page label="我的" title="去过的地点">
      {failed ? (
        <LoadFailed message="到访记录暂时打不开。" onRetry={load} />
      ) : visits === null ? (
        <Skeleton className="h-40 w-full" accessibilityLabel="正在加载到访记录" />
      ) : visits.length === 0 ? (
        <Text className="text-muted-foreground">还没有到访记录。在基地和动物园的页面点「记下今天去过」。</Text>
      ) : (
        <View>
          {visits.map((visit, index) => {
            const place = names.get(visit.placeId) ?? "一个地点";
            return (
              <View
                key={visit.checkinId}
                className={cn(
                  "flex-row items-center justify-between gap-3 border-t-hairline border-border py-3",
                  index === visits.length - 1 && "border-b-hairline",
                )}
              >
                <View className="min-w-0 flex-1">
                  <Text className="font-bold" numberOfLines={1}>
                    {place}
                  </Text>
                  <Text variant="muted">{longDate(visit.visitedOn)}</Text>
                </View>
                <Button
                  variant="secondary"
                  onPress={() => void remove(visit)}
                  accessibilityLabel={`删除${longDate(visit.visitedOn)}去${place}的记录`}
                >
                  <Text>删除</Text>
                </Button>
              </View>
            );
          })}
        </View>
      )}
      {removeFailed ? <Text className="text-destructive">没能删除，请再试一次。</Text> : null}
    </Page>
  );
}
