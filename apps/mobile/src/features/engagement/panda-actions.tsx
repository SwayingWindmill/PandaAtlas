import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { setFollowing, useFollowed } from "@/features/engagement/favorites";
import { type Seen, loadSeen, localToday, markSeen, shortDay, unmarkSeen } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";

/** 关注 and 见过 on a living panda's profile; signed-out fans are sent to sign in first. */
export function PandaActions({ pandaId, name }: { pandaId: string; name: string }) {
  const { state } = useSession();
  const followed = useFollowed();
  const signedIn = state.status === "signedIn";
  // undefined while unknown; only read when signed in, so signing out needs no reset.
  const [record, setSeen] = useState<Seen | null | undefined>(undefined);
  const seen = signedIn ? record : undefined;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    loadSeen(pandaId)
      .then((record) => active && setSeen(record))
      .catch(() => active && setSeen(undefined));
    return () => {
      active = false;
    };
  }, [pandaId, signedIn]);

  const following = followed?.has(pandaId) ?? false;

  async function toggleSeen() {
    setBusy(true);
    const day = localToday();
    if (seen) {
      if (await unmarkSeen(pandaId)) setSeen(null);
    } else if (await markSeen(pandaId, day)) {
      setSeen({ seenOn: day });
    }
    setBusy(false);
  }

  if (!signedIn) {
    return (
      <View className="flex-row gap-2">
        <Button className="flex-1" onPress={() => router.push("/sign-in")}>
          <Text>关注</Text>
        </Button>
        <Button variant="secondary" className="flex-1" onPress={() => router.push("/sign-in")}>
          <Text>见过</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-row gap-2">
      <Button
        variant={following ? "secondary" : "default"}
        className="flex-1"
        disabled={followed === null}
        accessibilityLabel={following ? `已关注${name}，点按取消` : `关注${name}`}
        onPress={() => void setFollowing(pandaId, !following)}
      >
        <Text>{following ? "已关注" : "关注"}</Text>
      </Button>
      <Button
        variant="secondary"
        className="flex-1"
        disabled={busy || seen === undefined}
        accessibilityLabel={seen ? `${seen.seenOn ? shortDay(seen.seenOn) : ""}见过${name}，点按取消` : `记下见过${name}`}
        onPress={() => void toggleSeen()}
      >
        <Text>{seen ? `见过${seen.seenOn ? `　${shortDay(seen.seenOn)}` : ""}` : "见过"}</Text>
      </Button>
    </View>
  );
}
