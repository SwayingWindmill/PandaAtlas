import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useFollowed } from "@/features/engagement/favorites";
import { localToday, shortDay } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api";
import { loadLifeEvents, loadLineage, loadResidencies } from "@/lib/public-data";
import { cn } from "@/lib/utils";

import { type Owners, type Update, followedChanges } from "./changes";

interface Sources {
  updates: Update[];
  owners: Owners;
  pandas: Map<string, PandaListItem>;
}

/** The latest releases, and what maps their changes back to pandas. Updates are read again each time 今天 shows. */
async function loadSources(): Promise<Sources> {
  const [updates, lineage, residencies, events, pandas] = await Promise.all([
    api.GET("/api/v2/updates", { params: { query: { limit: 10 } } }),
    loadLineage(),
    loadResidencies(),
    loadLifeEvents(),
    loadPandaIndex(),
  ]);
  if (!updates.data) throw new Error("Updates unavailable");
  return {
    updates: updates.data,
    owners: { lineage, residencies, events },
    pandas: new Map(pandas.map((panda) => [panda.id, panda])),
  };
}

function Section({ children }: { children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="h2">关注的熊猫</Text>
      {children}
    </View>
  );
}

/** 今天's list of what changed for the pandas the fan follows. */
export function FollowedChanges() {
  const { state } = useSession();
  const followed = useFollowed();
  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSources()
        .then((loaded) => {
          setSources(loaded);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    }, []),
  );

  const changes = useMemo(
    () => (sources && followed ? followedChanges(sources.updates, followed, sources.owners) : []),
    [sources, followed],
  );

  if (state.status === "signedOut") {
    return (
      <Section>
        <Text className="text-muted-foreground">登录并关注熊猫后，它们的新资料会出现在这里。</Text>
        <Button variant="secondary" className="self-start" onPress={() => router.push("/sign-in")}>
          <Text>登录</Text>
        </Button>
      </Section>
    );
  }
  if (state.status !== "signedIn" || followed === null || (sources === null && !failed)) return null;
  if (followed.size === 0) {
    return (
      <Section>
        <Text className="text-muted-foreground">
          还没有关注的熊猫。在熊猫资料页点「关注」，它们有新资料时会出现在这里。
        </Text>
        <Button variant="secondary" className="self-start" onPress={() => router.push("/find")}>
          <Text>找熊猫</Text>
        </Button>
      </Section>
    );
  }
  if (failed || !sources) {
    return (
      <Section>
        <Text className="text-muted-foreground">最近的变化暂时打不开。</Text>
      </Section>
    );
  }
  if (changes.length === 0) {
    return (
      <Section>
        <Text className="text-muted-foreground">最近的资料版本里，关注的熊猫没有变化。</Text>
      </Section>
    );
  }
  return (
    <Section>
      <View>
        {changes.map((change, index) => {
          const panda = sources.pandas.get(change.pandaId);
          if (!panda) return null;
          const day = shortDay(localToday(new Date(change.publishedAt)));
          return (
            <Pressable
              key={change.pandaId}
              onPress={() => openPanda(panda.slug)}
              role="button"
              accessibilityLabel={`${panda.name}，${change.what}，${day}`}
              className={cn(
                "gap-0.5 border-t-hairline border-border py-3 active:bg-accent",
                index === changes.length - 1 && "border-b-hairline",
              )}
            >
              <View className="flex-row items-center justify-between gap-3">
                <Text className="min-w-0 flex-1 font-bold" numberOfLines={1}>
                  {panda.name}
                </Text>
                <Text variant="muted">{day}</Text>
              </View>
              <Text className="text-highlight-foreground">{change.what}</Text>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}
