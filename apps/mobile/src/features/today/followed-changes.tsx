import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { BellRing } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import { useFollowed } from "@/features/engagement/favorites";
import { localToday, shortDay } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api";
import { fetchLifeEvents, fetchLineage, fetchResidencies } from "@/lib/public-data";
import { HAIRLINE } from "@/lib/surface";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";

import {
  type Owners,
  type Update,
  followedChanges,
  followedChangesViewState,
  shouldLoadFollowedChanges,
} from "./changes";

interface Sources {
  updates: Update[];
  owners: Owners;
  pandas: Map<string, PandaListItem>;
}

async function loadSources(): Promise<Sources> {
  const [updates, lineage, residencies, events, pandas] = await Promise.all([
    api.GET("/api/v2/updates", { params: { query: { limit: 10 } } }),
    fetchLineage(),
    fetchResidencies(),
    fetchLifeEvents(),
    loadPandaIndex(),
  ]);
  if (!updates.data) throw new Error("Updates unavailable");
  return {
    updates: updates.data,
    owners: { lineage, residencies, events },
    pandas: new Map(pandas.map((panda) => [panda.id, panda])),
  };
}

const THUMB = 44;
const SEPARATOR_INSET = { marginLeft: 16 + THUMB + 12 } as const;

/** Latest updates for pandas the fan follows; stays completely hidden when empty or signed out. */
export function FollowedChanges() {
  const { state } = useSession();
  const followed = useFollowed();
  const followedCount = followed?.size ?? null;
  const shouldLoad = shouldLoadFollowedChanges(state.status, followedCount);
  const { data: sources = null, isError: failed, refetch } = useQuery({
    queryKey: ["public", "followed-changes"],
    queryFn: loadSources,
    enabled: shouldLoad,
    staleTime: 0,
    networkMode: "always",
  });
  useRefetchOnFocus(refetch, shouldLoad);

  const changes = useMemo(
    () => (sources && followed ? followedChanges(sources.updates, followed, sources.owners) : []),
    [sources, followed],
  );

  const viewState = followedChangesViewState({
    sessionStatus: state.status,
    followedCount,
    hasSources: sources !== null,
    failed,
  });

  if (viewState !== "ready" || !sources || changes.length === 0) {
    return null;
  }

  const rows = changes.flatMap((change) => {
    const panda = sources.pandas.get(change.pandaId);
    return panda ? [{ change, panda }] : [];
  });
  if (rows.length === 0) return null;

  return (
    <View className="gap-row">
      <SectionHeader title="关注的最新动态" icon={BellRing} />
      <View className="overflow-hidden rounded-group border-hairline border-border bg-card" style={{ borderCurve: "continuous" }}>
        {rows.map(({ change, panda }, index) => {
          const day = shortDay(localToday(new Date(change.publishedAt)));
          return (
            <View key={change.pandaId}>
              <Pressable
                onPress={() => openPanda(panda.slug)}
                role="button"
                accessibilityLabel={`${panda.name}，${change.what}，${day}`}
                className="min-h-11 flex-row items-center gap-row px-inset py-row active:bg-accent"
              >
                <PandaThumb pandaId={panda.id} name={panda.name} size={THUMB} />
                <View className="min-w-0 flex-1 gap-hair-gap">
                  <View className="flex-row items-baseline justify-between gap-row">
                    <Text variant="headline" className="min-w-0 flex-1" numberOfLines={1}>
                      {panda.name}
                    </Text>
                    <Text variant="footnote" className="text-muted-foreground tabular-nums">
                      {day}
                    </Text>
                  </View>
                  <Text variant="subheadline" className="text-muted-foreground" numberOfLines={2}>
                    {change.what}
                  </Text>
                </View>
              </Pressable>
              {index < rows.length - 1 ? (
                <View className="bg-border" style={[{ height: HAIRLINE }, SEPARATOR_INSET]} />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
