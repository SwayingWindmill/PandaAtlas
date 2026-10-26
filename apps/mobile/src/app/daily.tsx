import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  feedbackText,
  guessDailyPanda,
  loadDailyPanda,
  loadPandaChoices,
  type DailyPandaState,
  type PandaChoice,
} from "@/features/daily-panda/daily-panda";
import { cn } from "@/lib/utils";

const MAX_MATCHES = 8;

export default function DailyPandaScreen() {
  const [state, setState] = useState<DailyPandaState | null>(null);
  const [pandas, setPandas] = useState<PandaChoice[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [guessFailed, setGuessFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");
  const [inkColor, mutedColor] = useCSSVariable(["--color-primary", "--color-muted-foreground"]);

  const load = useCallback(() => {
    Promise.all([loadDailyPanda(), loadPandaChoices()])
      .then(([puzzle, choices]) => {
        setState(puzzle);
        setPandas(choices);
      })
      .catch(() => setLoadFailed(true));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setLoadFailed(false);
    load();
  }

  const pandasById = useMemo(() => new Map(pandas.map((panda) => [panda.id, panda])), [pandas]);
  const guessedIds = useMemo(() => new Set(state?.guesses.map((guess) => guess.pandaId)), [state]);
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return [];
    return pandas
      .filter((panda) => !guessedIds.has(panda.id))
      .filter((panda) => [panda.name, panda.alternateName ?? "", panda.slug].some((value) => value.toLowerCase().includes(query)))
      .slice(0, MAX_MATCHES);
  }, [guessedIds, pandas, search]);

  if (!state) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
        {loadFailed ? (
          <>
            <Text>今天的每日一猫暂时不可用，请稍后再来。</Text>
            <Button onPress={retry}>
              <Text>重试</Text>
            </Button>
          </>
        ) : (
          <ActivityIndicator color={String(inkColor)} accessibilityLabel="正在准备今天的熊猫" />
        )}
      </View>
    );
  }

  const current = state;
  const left = current.maxGuesses - current.guesses.length;
  const answer = current.answer ? pandasById.get(current.answer.pandaId) : undefined;

  function choose(pandaId: string) {
    if (current.finished || pending) return;
    setSearch("");
    setPending(true);
    setGuessFailed(false);
    guessDailyPanda(current, [...current.guesses.map((guess) => guess.pandaId), pandaId])
      .then(setState)
      .catch(() => setGuessFailed(true))
      .finally(() => setPending(false));
  }

  function share() {
    const marks = current.guesses.map((guess) => (guess.correct ? "🟩" : "🟥")).join("");
    const score = current.solved ? `${current.guesses.length}/${current.maxGuesses}` : `X/${current.maxGuesses}`;
    void Share.share({ message: `吱熊猫 每日一猫 ${current.puzzleDate} ${score}\n${marks}` });
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-5" keyboardShouldPersistTaps="handled">
      <View className="flex-row flex-wrap items-baseline justify-between gap-2">
        <Text variant="h2">{current.puzzleDate} 的熊猫</Text>
        {!current.finished ? <Text variant="muted">还能猜 {left} 次</Text> : null}
      </View>

      <View className="gap-2.5">
        {Array.from({ length: current.clueCount }, (_, index) => {
          const clue = current.clues[index];
          if (clue === undefined) {
            return (
              <View key={index} className="min-h-12 justify-center rounded-md border-hairline border-dashed border-input px-4 py-3">
                <Text variant="muted">猜错一次解锁</Text>
              </View>
            );
          }
          if (clue.kind === "photo") {
            return (
              <View key={index} className="aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
                <Image source={clue.imageUrl} style={{ flex: 1 }} contentFit="cover" accessibilityLabel="TA 的公开照片" />
              </View>
            );
          }
          return (
            <View key={index} className="min-h-12 justify-center rounded-md border-hairline border-border bg-card px-4 py-3">
              <Text className="font-bold">{clue.text}</Text>
            </View>
          );
        })}
      </View>

      {current.finished ? (
        <View className="gap-2.5 rounded-lg border-hairline border-border bg-card p-5" accessibilityLiveRegion="polite">
          <Text variant="h2">{current.solved ? `猜对了！用了 ${current.guesses.length} 次。` : "这次没猜出来。"}</Text>
          {answer ? <Text>今天的熊猫是{answer.name}。</Text> : null}
          <View className="flex-row flex-wrap gap-2.5">
            {current.answer ? (
              <Button
                role="link"
                onPress={() => void Linking.openURL(`https://zhipanda.com/zh/pandas/${current.answer!.canonicalSlug}`)}
              >
                <Text>打开熊猫资料</Text>
              </Button>
            ) : null}
            <Button variant="outline" onPress={share}>
              <Text>分享结果</Text>
            </Button>
          </View>
          <Text variant="muted">明天 0 点（北京时间）换一只新熊猫。</Text>
        </View>
      ) : (
        <View className="gap-2.5 rounded-lg border-hairline border-border bg-card p-5">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="输入熊猫名字"
            placeholderTextColor={String(mutedColor)}
            editable={!pending}
            autoCorrect={false}
            accessibilityLabel="猜一只熊猫"
            className="rounded-md border-hairline border-input px-3.5 py-3 text-base text-foreground"
          />
          {search.trim() !== "" && matches.length === 0 ? <Text variant="muted">没有找到这只熊猫</Text> : null}
          {matches.map((panda) => (
            <Pressable
              key={panda.id}
              className="border-b-hairline border-border px-1 py-2.5 active:bg-accent"
              onPress={() => choose(panda.id)}
              role="button"
            >
              <Text className="font-bold">{panda.name}</Text>
              {panda.alternateName ? <Text variant="muted">{panda.alternateName}</Text> : null}
            </Pressable>
          ))}
          {guessFailed ? <Text className="text-xs text-destructive">这次没能提交，请再试一次。</Text> : null}
        </View>
      )}

      {current.guesses.length > 0 ? (
        <View className="gap-2.5 rounded-lg border-hairline border-border bg-card p-5">
          <Text variant="h3">你猜过的</Text>
          {current.guesses.map((guess) => (
            <View key={guess.pandaId} className={cn("gap-0.5 rounded-md border-hairline p-3", guess.correct ? "border-highlight" : "border-border")}>
              <Text className="font-bold">
                {guess.correct ? "✓ " : "✕ "}
                {pandasById.get(guess.pandaId)?.name ?? guess.pandaId}
              </Text>
              {!guess.correct ? <Text variant="muted">{feedbackText(guess)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
