import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Eye, Heart } from "@/components/icons";
import { useStacked } from "@/components/grouped-list";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { setFollowing, useFollowed } from "@/features/engagement/favorites";
import { guestSeenQueryOptions, setGuestFollowing, setGuestSeen } from "@/features/engagement/guest-store";
import { loadSeen, localToday, markSeen, seenIdsQueryKey, shortDay, unmarkSeen } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import { selectionHaptic, successHaptic, tapHaptic } from "@/lib/haptics";

/** 关注 takes a little more of the row than 见过, as the primary action. */
const FOLLOW_FLEX = { flex: 1.3 } as const;
const SEEN_FLEX = { flex: 1 } as const;

/**
 * 关注 and 见过 under a panda's name, as iOS pairs a primary and a secondary action:
 * 关注 is the filled ink capsule (grey once followed), 见过 the grey tonal capsule. Each carries its bare
 * glyph. Signed-out fans store actions locally on the device and sync after sign-in.
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
  const signedOut = state.status === "signedOut";
  const accountId = signedIn ? state.accountId : "";
  // Under the account's private key, so signing out or switching accounts drops it (see SessionProvider).
  const key = ["private", accountId, "seen", pandaId] as const;
  const queryClient = useQueryClient();
  // undefined while unknown or after a failed read, which keeps 见过 disabled.
  const remoteSeen = useQuery({ queryKey: key, queryFn: () => loadSeen(pandaId), enabled: signedIn });
  const guestSeenMap = useQuery({ ...guestSeenQueryOptions(), enabled: signedOut });
  const guestEntry = guestSeenMap.data?.[pandaId];
  const seen = signedIn
    ? remoteSeen.data
    : signedOut && guestSeenMap.data !== undefined
      ? guestEntry
        ? { seenOn: guestEntry.seenOn }
        : null
      : undefined;

  const toggleSeen = useMutation({
    mutationFn: async () => {
      const day = localToday();
      if (signedOut) {
        const next = await setGuestSeen(pandaId, seen ? null : day);
        const entry = next[pandaId];
        return entry ? { seenOn: entry.seenOn } : null;
      }
      const saved = seen ? await unmarkSeen(pandaId) : await markSeen(pandaId, day);
      if (!saved) throw new Error("Seen update failed");
      return seen ? null : { seenOn: day };
    },
    onSuccess: (record) => {
      // The success tap lands with the label change, once the save succeeds.
      if (record) successHaptic();
      else selectionHaptic();
      if (signedIn) {
        queryClient.setQueryData(key, record);
        void queryClient.invalidateQueries({ queryKey: seenIdsQueryKey(accountId) });
      }
    },
  });

  const following = followed?.has(pandaId) ?? false;

  if (deceased) return null;

  return (
    <View className={row}>
      <Button
        variant={following ? "secondary" : "default"}
        className="px-5"
        style={fill}
        disabled={(!signedIn && !signedOut) || followed === null}
        accessibilityLabel={following ? `已关注${name}，点按取消` : `关注${name}`}
        onPress={() => {
          tapHaptic();
          if (signedIn) void setFollowing(state.accountId, pandaId, !following);
          else if (signedOut) void setGuestFollowing(pandaId, !following);
        }}
      >
        <Icon icon={Heart} size="subhead" tone={following ? "label" : "onButton"} strokeWidth={2} />
        <Text className="text-body font-semibold">{following ? "已关注" : "关注"}</Text>
      </Button>
      <Button
        variant="secondary"
        className="bg-card px-4"
        style={half}
        disabled={(!signedIn && !signedOut) || toggleSeen.isPending || seen === undefined}
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
