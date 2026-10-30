import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { SectionHeader } from "@/components/section-header";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useFollowed } from "@/features/engagement/favorites";
import { localToday, shortDay } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api";
import { fetchLifeEvents, fetchLineage, fetchResidencies } from "@/lib/public-data";
import { usePandaCover } from "@/lib/covers";
import { HAIRLINE } from "@/lib/surface";

import { type Owners, type Update, followedChanges } from "./changes";

interface Sources {
  updates: Update[];
  owners: Owners;
  pandas: Map<string, PandaListItem>;
}

/**
 * The latest releases, and the lists that map their changes back to pandas. All are read again each time 今天
 * shows, so a release published while the app is open is mapped through its own lists.
 */
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

/** The row's leading photo, and where its separator starts: under the text, past the photo. */
const THUMB = 44;
const SEPARATOR_INSET = { marginLeft: 16 + THUMB + 12 } as const;

function Section({ children }: { children: ReactNode }) {
  return (
    <View className="gap-row">
      <SectionHeader title="关注的新资料" />
      {children}
    </View>
  );
}

/** A quiet card for the section's empty and signed-out states: a sentence and at most one action. */
function Note({ children, action }: { children: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="items-start gap-row">
      <Text variant="subheadline" className="text-muted-foreground">
        {children}
      </Text>
      {action ? (
        <Button variant="tinted" size="sm" onPress={action.onPress}>
          <Text>{action.label}</Text>
        </Button>
      ) : null}
    </View>
  );
}

function Thumb({ pandaId, name }: { pandaId: string; name: string }) {
  const photo = usePandaCover(pandaId);
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-secondary"
      style={{ width: THUMB, height: THUMB }}
    >
      {photo ? (
        <Image source={photo} style={{ width: THUMB, height: THUMB }} contentFit="cover" accessible={false} />
      ) : (
        <Text variant="headline" className="text-muted-foreground">
          {name.slice(0, 1)}
        </Text>
      )}
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
        <Note action={{ label: "登录", onPress: () => router.push("/sign-in") }}>
          登录并关注熊猫后，它们的新资料会出现在这里。
        </Note>
      </Section>
    );
  }
  if (state.status !== "signedIn" || followed === null || (sources === null && !failed)) return null;
  if (followed.size === 0) {
    return (
      <Section>
        <Note action={{ label: "找熊猫", onPress: () => router.push("/find") }}>
          还没有关注的熊猫。在熊猫资料页点「关注」，它们有新资料时会出现在这里。
        </Note>
      </Section>
    );
  }
  if (failed || !sources) {
    return (
      <Section>
        <Note>最近的变化暂时打不开。</Note>
      </Section>
    );
  }
  if (changes.length === 0) {
    return (
      <Section>
        <Note>最近的资料版本里，关注的熊猫没有变化。</Note>
      </Section>
    );
  }
  const rows = changes.flatMap((change) => {
    const panda = sources.pandas.get(change.pandaId);
    return panda ? [{ change, panda }] : [];
  });
  return (
    <Section>
      <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
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
                <Thumb pandaId={panda.id} name={panda.name} />
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
    </Section>
  );
}
