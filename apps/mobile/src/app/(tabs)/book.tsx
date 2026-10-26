import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type BookEntry, type BookView, type MetThrough, buildBook, entryCaption, progressPercent, wayLabel } from "@/features/book/book";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { authedApi } from "@/lib/api";
import { usePandaCover } from "@/lib/covers";
import { cn } from "@/lib/utils";

const GUTTER = 20;
const GAP = 12;
const WAYS: MetThrough[] = ["daily_panda", "guess_panda", "seen"];

async function loadBook(): Promise<BookView> {
  const [book, seen] = await Promise.all([authedApi.GET("/api/v2/me/panda-book"), authedApi.GET("/api/v2/me/seen-pandas")]);
  if (!book.data || !seen.data) throw new Error("Panda book unavailable");
  return buildBook(book.data, seen.data.items);
}

function useTileWidth() {
  const { width } = useWindowDimensions();
  return (width - GUTTER * 2 - GAP * 2) / 3;
}

function Tile({ entry, panda, width }: { entry: BookEntry; panda: PandaListItem | undefined; width: number }) {
  const photo = usePandaCover(entry.pandaId);
  const name = panda?.name ?? "熊猫";
  return (
    <Pressable
      style={{ width }}
      className="gap-1.5"
      role="button"
      accessibilityLabel={`${name}，${entryCaption(entry)}`}
      onPress={() => panda && openPanda(panda.slug)}
    >
      <View className="items-center justify-center overflow-hidden rounded-md bg-accent" style={{ width, height: width }}>
        {photo ? (
          <Image source={photo} style={{ width, height: width }} contentFit="cover" accessible={false} />
        ) : (
          <Text className="font-extrabold">{name.slice(0, 1)}</Text>
        )}
      </View>
      <View>
        <Text variant="small" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {entryCaption(entry)}
        </Text>
      </View>
    </Pressable>
  );
}

function DailyTile({ width }: { width: number }) {
  return (
    <Pressable style={{ width }} className="gap-1.5" role="button" accessibilityLabel="去猜今天的每日一猫" onPress={() => router.push("/daily")}>
      <View className="items-center justify-center rounded-md border-hairline border-dashed border-input" style={{ width, height: width }}>
        <Text className="text-xl text-muted-foreground">+</Text>
      </View>
      <View>
        <Text variant="small">今天的那只</Text>
        <Text variant="muted">去猜每日一猫</Text>
      </View>
    </Pressable>
  );
}

function SignedOut() {
  const width = useTileWidth();
  return (
    <>
      <View className="flex-row flex-wrap" style={{ gap: GAP }} accessible={false}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} className="rounded-md border-hairline border-dashed border-input" style={{ width, height: width }} />
        ))}
      </View>
      <View className="gap-3">
        <Text variant="h2">登录后，这里会记下</Text>
        <View>
          {["每日一猫猜中的熊猫", "猜熊猫答对的熊猫", "去现场见过的熊猫"].map((line, index) => (
            <Text key={line} className={cn("border-t-hairline border-border py-2.5", index === 2 && "border-b-hairline")}>
              {line}
            </Text>
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Button onPress={() => router.push("/sign-in")}>
          <Text>登录</Text>
        </Button>
        <Button variant="secondary" onPress={() => router.push("/daily")}>
          <Text>先去猜今天的每日一猫</Text>
        </Button>
      </View>
    </>
  );
}

/** Keyed by account, so another fan signing in on this device starts from a fresh load. */
function SignedIn() {
  const width = useTileWidth();
  const [view, setView] = useState<BookView | null>(null);
  const [pandas, setPandas] = useState<Map<string, PandaListItem>>(new Map());
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    Promise.all([loadBook(), loadPandaIndex()])
      .then(([book, index]) => {
        setView(book);
        setPandas(new Map(index.map((panda) => [panda.id, panda])));
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) {
    return (
      <View className="items-start gap-3 rounded-lg bg-muted p-5">
        <Text>图鉴暂时打不开。</Text>
        <Button
          onPress={() => {
            setFailed(false);
            load();
          }}
        >
          <Text>重试</Text>
        </Button>
      </View>
    );
  }
  if (!view) return <Skeleton className="h-64 w-full" accessibilityLabel="正在加载图鉴" />;

  const percent = progressPercent(view);
  return (
    <>
      <View className="gap-2.5">
        <View className="flex-row items-baseline gap-2">
          <Text variant="h1">{String(view.knownCount)}</Text>
          <Text variant="muted">{`只已认识，共收录 ${view.publishedCount} 只`}</Text>
        </View>
        <View
          className="h-2 overflow-hidden rounded-full bg-accent"
          role="progressbar"
          accessibilityLabel={`已认识 ${view.knownCount} 只，占 ${view.publishedCount} 只的 ${percent}%`}
        >
          <View className="h-2 bg-primary" style={{ width: `${percent}%` }} />
        </View>
        <View className="mt-1 flex-row gap-3">
          {WAYS.map((way) => (
            <View key={way} className="flex-1 border-t-hairline border-border pt-2">
              <Text variant="muted">{wayLabel(way)}</Text>
              <Text className="text-xl font-extrabold">{String(view.byWay[way])}</Text>
            </View>
          ))}
        </View>
      </View>
      <View className="gap-3">
        <Text variant="h2">最近认识的</Text>
        <View className="flex-row flex-wrap" style={{ gap: GAP }}>
          {view.recent.slice(0, 11).map((entry) => (
            <Tile key={entry.pandaId} entry={entry} panda={pandas.get(entry.pandaId)} width={width} />
          ))}
          <DailyTile width={width} />
        </View>
      </View>
    </>
  );
}

export default function BookScreen() {
  const { state } = useSession();
  return (
    <Page title="图鉴" back={false}>
      {state.status === "signedIn" ? <SignedIn key={state.accountId} /> : null}
      {state.status === "signedOut" ? <SignedOut /> : null}
      {state.status === "loading" ? <Skeleton className="h-64 w-full" accessibilityLabel="正在加载" /> : null}
      {state.status === "unavailable" ? <Text className="text-muted-foreground">账号暂时不可用，请稍后再试。</Text> : null}
    </Page>
  );
}
