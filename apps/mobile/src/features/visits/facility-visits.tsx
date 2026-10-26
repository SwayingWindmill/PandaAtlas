import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { localToday, shortDay } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import { cn } from "@/lib/utils";

import { type Visit, lastVisitByPlace, loadVisits, recordVisit } from "./visits";

/** 到访 on an institution page: one row per facility with the last day the fan went, and 记下今天去过. */
export function FacilityVisits({ facilities }: { facilities: { id: string; name: string }[] }) {
  const { state: session } = useSession();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [failed, setFailed] = useState(false);
  const signedIn = session.status === "signedIn";

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      loadVisits()
        .then(setVisits)
        .catch(() => undefined);
    }, [signedIn]),
  );

  async function record(placeId: string) {
    setFailed(false);
    try {
      const visit = await recordVisit(placeId, localToday());
      setVisits((current) => [visit, ...current]);
    } catch {
      setFailed(true);
    }
  }

  if (session.status === "signedOut") {
    return (
      <View className="items-start gap-3">
        <Text variant="h2">到访</Text>
        <Button variant="secondary" onPress={() => router.push("/sign-in")}>
          <Text>登录后记下到访</Text>
        </Button>
      </View>
    );
  }
  if (!signedIn) return null;

  const today = localToday();
  const last = lastVisitByPlace(visits);
  return (
    <View className="gap-3">
      <Text variant="h2">到访</Text>
      <View>
        {facilities.map((facility, index) => {
          const day = last.get(facility.id);
          return (
            <View
              key={facility.id}
              className={cn(
                "flex-row items-center justify-between gap-3 border-t-hairline border-border py-3",
                index === facilities.length - 1 && "border-b-hairline",
              )}
            >
              <View className="min-w-0 flex-1">
                <Text className="font-bold" numberOfLines={1}>
                  {facility.name}
                </Text>
                {day ? <Text variant="muted">{`${shortDay(day)}去过`}</Text> : null}
              </View>
              <Button
                variant="secondary"
                disabled={day === today}
                onPress={() => void record(facility.id)}
                accessibilityLabel={day === today ? `今天已记下去过${facility.name}` : `记下今天去过${facility.name}`}
              >
                <Text>{day === today ? "今天已记下" : "记下今天去过"}</Text>
              </Button>
            </View>
          );
        })}
      </View>
      {failed ? <Text className="text-destructive">没能记下，请再试一次。</Text> : null}
    </View>
  );
}
