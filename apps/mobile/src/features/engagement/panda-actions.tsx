import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { setFollowing, useFollowed } from "@/features/engagement/favorites";
import { loadSeen, localToday, markSeen, shortDay, unmarkSeen } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import { selectionHaptic, successHaptic, tapHaptic } from "@/lib/haptics";

/**
 * 关注 and 见过 under a living panda's name, as iOS pairs a primary and a secondary action:
 * 关注 is a tinted capsule, 见过 is plain tint text. Signed-out fans are sent to sign in first.
 */
export function PandaActions({ pandaId, name }: { pandaId: string; name: string }) {
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

  if (!signedIn) {
    return (
      <View className="flex-row flex-wrap items-center gap-2">
        <Button variant="tinted" size="sm" className="min-w-24 px-5" accessibilityLabel={`关注${name}`} onPress={() => router.push("/sign-in")}>
          <Text className="text-body font-semibold">关注</Text>
        </Button>
        <Button variant="plain" size="sm" accessibilityLabel={`记下见过${name}`} onPress={() => router.push("/sign-in")}>
          <Text className="text-body font-semibold">见过</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Button
        variant={following ? "secondary" : "tinted"}
        size="sm"
        className="min-w-24 px-5"
        disabled={followed === null}
        accessibilityLabel={following ? `已关注${name}，点按取消` : `关注${name}`}
        onPress={() => {
          tapHaptic();
          if (signedIn) void setFollowing(state.accountId, pandaId, !following);
        }}
      >
        <Text className="text-body font-semibold">{following ? "已关注" : "关注"}</Text>
      </Button>
      <Button
        variant="plain"
        size="sm"
        disabled={toggleSeen.isPending || seen === undefined}
        accessibilityLabel={seen ? `${seen.seenOn ? shortDay(seen.seenOn) : ""}见过${name}，点按取消` : `记下见过${name}`}
        onPress={() => toggleSeen.mutate()}
      >
        <Text className="text-body font-semibold">{seen ? `见过${seen.seenOn ? `　${shortDay(seen.seenOn)}` : ""}` : "见过"}</Text>
      </Button>
    </View>
  );
}
