import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { ICON_INSET, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { CalendarCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { guestVisitsQueryOptions, recordGuestVisit } from "@/features/engagement/guest-store";
import { localToday, shortDay } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import { HAIRLINE } from "@/lib/surface";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";
import { cn } from "@/lib/utils";

import { type Visit, lastVisitByPlace, recordVisit, sortVisits, visitsQueryKey, visitsQueryOptions } from "./visits";

/** 到访 on an institution page: one row per facility with the last day the fan went, and 记下今天去过. */
export function FacilityVisits({ facilities }: { facilities: { id: string; name: string }[] }) {
  const { state: session } = useSession();
  const queryClient = useQueryClient();
  const stacked = useStacked();
  const [failed, setFailed] = useState(false);
  const signedIn = session.status === "signedIn";
  const signedOut = session.status === "signedOut";
  const accountId = signedIn ? session.accountId : "";

  const remote = useQuery({ ...visitsQueryOptions(accountId), enabled: signedIn });
  const guest = useQuery({ ...guestVisitsQueryOptions(), enabled: signedOut });
  useRefetchOnFocus(remote.refetch, signedIn);

  async function record(placeId: string) {
    setFailed(false);
    try {
      const today = localToday();
      if (signedOut) {
        await recordGuestVisit(placeId, today);
        return;
      }
      if (!signedIn) return;
      const visit = await recordVisit(placeId, today);
      const key = visitsQueryKey(accountId);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Visit[]>(key, (current) => sortVisits([visit, ...(current ?? [])]));
    } catch {
      setFailed(true);
    }
  }

  if (!signedIn && !signedOut) return null;

  const visits = (signedOut ? guest.data : remote.data) ?? [];
  const today = localToday();
  const last = lastVisitByPlace(visits);
  return (
    <ListSection title="到访" footer={failed ? "没能记下，请再试一次。" : undefined}>
      {facilities.map((facility, index) => {
        const day = last.get(facility.id);
        return (
          <View key={facility.id}>
            <View className={cn("gap-3 px-4 py-3", stacked ? "items-start" : "flex-row items-center")}>
              {stacked ? null : <Icon icon={CalendarCheck} />}
              <View className="min-w-0 flex-1 gap-0.5">
                <Text variant="body" numberOfLines={stacked ? undefined : 1}>
                  {facility.name}
                </Text>
                {day ? (
                  <Text variant="footnote" className="text-muted-foreground">{`${shortDay(day)}去过`}</Text>
                ) : null}
              </View>
              <Button
                variant="tinted"
                size="sm"
                disabled={day === today}
                onPress={() => void record(facility.id)}
                accessibilityLabel={day === today ? `今天已记下去过${facility.name}` : `记下今天去过${facility.name}`}
              >
                <Text>{day === today ? "今天已记下" : "记下今天去过"}</Text>
              </Button>
            </View>
            {index === facilities.length - 1 ? null : <View className={cn(stacked && "ml-4", "bg-border")} style={[{ height: HAIRLINE }, stacked ? null : ICON_INSET]} />}
          </View>
        );
      })}
    </ListSection>
  );
}
