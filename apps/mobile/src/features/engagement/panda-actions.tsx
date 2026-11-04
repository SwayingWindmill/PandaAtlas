import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Eye, Heart } from "@/components/icons";
import { useStacked } from "@/components/grouped-list";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { setFollowing, useFollowed } from "@/features/engagement/favorites";
import { loadSeen, localToday, markSeen, shortDay, unmarkSeen } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import { selectionHaptic, successHaptic, tapHaptic } from "@/lib/haptics";

/** 关注 takes a little more of the row than 见过, as the primary action. */
const FOLLOW_FLEX = { flex: 1.3 } as const;
const SEEN_FLEX = { flex: 1 } as const;

/**
 * 关注 and 见过 under a panda's name, as iOS pairs a primary and a secondary action:
 * 关注 is the filled ink capsule (grey once followed), 见过 the grey tonal capsule. Each carries its bare
 * glyph. Signed-out fans are sent to sign in first. A panda that has died has neither; share is in the bar.
 */
export function PandaActions({
  pandaId,
  name,
  deceased = false,
}: {
  pandaId: string;
  name: string;
  deceased?: boolean;
}) {
  const stacked = useStacked();
  const row = stacked ? "flex-row flex-wrap items-center gap-2.5" : "flex-row items-center gap-2.5";
  const fill = stacked ? undefined : FOLLOW_FLEX;
  const half = stacked ? undefined : SEEN_FLEX;
  const { state } = useSession();
  const followed = useFollowed();
  const signedIn = state.status === "signedIn";
  const accountId = signedIn ? state.accountId : "";
  // Under the account's private key, so signing out or switching accounts drops it (see SessionProvider).
  const key = ["private", accountId, "seen", pandaId] as const;
  const queryClient = useQueryClient();
  // undefined while unknown or after a failed read, which keeps 见过 disabled.
  const { data: seen } = useQuery({ queryKey: key, queryFn: () => loadSeen(pandaId), enabled: signedIn });
  const toggleSeen = useMutation({
    mutationFn: async () => {
      const day = localToday();
      const saved = seen ? await unmarkSeen(pandaId) : await markSeen(pandaId, day);
      if (!saved) throw new Error("Seen update failed");
      return seen ? null : { seenOn: day };
    },
    onSuccess: (record) => {
      // The success tap lands with the label change, once the server has kept the day.
      if (record) successHaptic();
      else selectionHaptic();
      queryClient.setQueryData(key, record);
    },
  });

  const following = followed?.has(pandaId) ?? false;

  if (deceased) return null;

  if (!signedIn) {
    return (
      <View className={row}>
        <Button className="px-5" style={fill} accessibilityLabel={`关注${name}`} onPress={() => router.push("/sign-in")}>
          <Icon icon={Heart} size="subhead" tone="onButton" strokeWidth={2} />
          <Text className="text-body font-semibold">关注</Text>
        </Button>
        <Button variant="secondary" className="bg-card px-4" style={half} accessibilityLabel={`记下见过${name}`} onPress={() => router.push("/sign-in")}>
          <Icon icon={Eye} size="subhead" tone="label" strokeWidth={2} />
          <Text className="text-body font-semibold">见过</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className={row}>
      <Button
        variant={following ? "secondary" : "default"}
        className="px-5"
        style={fill}
        disabled={followed === null}
        accessibilityLabel={following ? `已关注${name}，点按取消` : `关注${name}`}
        onPress={() => {
          tapHaptic();
          if (signedIn) void setFollowing(state.accountId, pandaId, !following);
        }}
      >
        <Icon icon={Heart} size="subhead" tone={following ? "label" : "onButton"} strokeWidth={2} />
        <Text className="text-body font-semibold">{following ? "已关注" : "关注"}</Text>
      </Button>
      <Button
        variant="secondary"
        className="bg-card px-4"
        style={half}
        disabled={toggleSeen.isPending || seen === undefined}
        accessibilityLabel={seen ? `${seen.seenOn ? shortDay(seen.seenOn) : ""}见过${name}，点按取消` : `记下见过${name}`}
        onPress={() => toggleSeen.mutate()}
      >
        <Icon icon={Eye} size="subhead" tone="label" strokeWidth={2} />
        <Text className="text-body font-semibold" numberOfLines={1}>
          {seen ? `见过${seen.seenOn ? `　${shortDay(seen.seenOn)}` : ""}` : "见过"}
        </Text>
      </Button>
    </View>
  );
}
