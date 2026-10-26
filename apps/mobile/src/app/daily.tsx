import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Share, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  feedbackParts,
  guessDailyPanda,
  loadDailyPanda,
  loadPandaChoices,
  saveDailyResult,
  type DailyPandaState,
  type PandaChoice,
} from "@/features/daily-panda/daily-panda";
import { openPanda } from "@/features/pandas/panda-row";
import { useSession } from "@/features/session/session";
import { cn } from "@/lib/utils";

const MAX_MATCHES = 8;
const TITLE = "今天是哪只熊猫？";

/** "2026-10-26" -> "10月26日" */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${month}月${day}日`;
}

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

  // A finished puzzle joins the signed-in fan's 图鉴; saving the same day again changes nothing.
  const { state: session } = useSession();
  const accountId = session.status === "signedIn" ? session.accountId : null;
  const [savedFor, setSavedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!state?.finished || accountId === null) return;
    let active = true;
    void saveDailyResult(state).then((saved) => {
      if (active && saved) setSavedFor(`${accountId}:${state.puzzleDate}`);
    });
    return () => {
      active = false;
    };
  }, [state, accountId]);
  const savedToBook = state !== null && accountId !== null && savedFor === `${accountId}:${state.puzzleDate}`;

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
      <Page label="每日一猫" title={TITLE}>
        {loadFailed ? (
          <LoadFailed message="今天的每日一猫暂时打不开。" onRetry={retry} />
        ) : (
          <ActivityIndicator color={String(inkColor)} accessibilityLabel="正在加载每日一猫" />
        )}
      </Page>
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
    <Page label={`每日一猫　${shortDate(current.puzzleDate)}`} title={TITLE} keyboardShouldPersistTaps="handled">
      <View className="gap-2">
        <Text variant="small" className="text-muted-foreground">
          线索 {current.clues.length} / {current.clueCount}
        </Text>
        <View>
          {Array.from({ length: current.clueCount }, (_, index) => {
            const clue = current.clues[index];
            return (
              <View
                key={index}
                className={cn(
                  "flex-row gap-3 border-t-hairline border-border py-2.5",
                  index === current.clueCount - 1 && "border-b-hairline",
                )}
              >
                <Text className="w-5 font-bold">{index + 1}</Text>
                {clue === undefined ? (
                  <Text className="text-muted-foreground">猜错一次解锁</Text>
                ) : clue.kind === "photo" ? (
                  <View className="aspect-[4/3] flex-1 overflow-hidden rounded-md bg-muted">
                    <Image source={clue.imageUrl} style={{ flex: 1 }} contentFit="cover" accessibilityLabel="它的公开照片" />
                  </View>
                ) : (
                  <Text className="flex-1">{clue.text}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {current.guesses.length > 0 ? (
        <View className="gap-2">
          <Text variant="small" className="text-muted-foreground">
            你猜过
          </Text>
          {current.guesses.map((guess) => (
            <View key={guess.pandaId} className="flex-row flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted px-3 py-2.5">
              <Text className="flex-1 font-bold">{pandasById.get(guess.pandaId)?.name ?? guess.pandaId}</Text>
              {guess.correct ? (
                <Text variant="small" className="text-highlight-foreground">
                  猜中了
                </Text>
              ) : (
                feedbackParts(guess).map((part) => (
                  <Text key={part} variant="muted">
                    {part}
                  </Text>
                ))
              )}
            </View>
          ))}
        </View>
      ) : null}

      {current.finished ? (
        <View className="gap-3" accessibilityLiveRegion="polite">
          <View className="gap-1">
            <Text variant="small" className="text-muted-foreground">
              今天的答案
            </Text>
            <Text variant="h2">{answer?.name ?? "这只熊猫"}</Text>
            <Text className="font-bold">{current.solved ? `第 ${current.guesses.length} 次猜中` : "这次没猜中"}</Text>
          </View>
          {savedToBook ? (
            <View className="self-start rounded-full bg-highlight-soft px-3 py-1.5">
              <Text variant="small" className="text-highlight-foreground">
                已收进图鉴
              </Text>
            </View>
          ) : session.status === "signedOut" ? (
            <Button variant="secondary" className="self-start" onPress={() => router.push("/sign-in")}>
              <Text>登录，收进图鉴</Text>
            </Button>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            <Button onPress={share}>
              <Text>分享结果</Text>
            </Button>
            {current.answer ? (
              <Button variant="secondary" onPress={() => openPanda(current.answer!.canonicalSlug)}>
                <Text>{answer ? `看${answer.name}的资料` : "看资料"}</Text>
              </Button>
            ) : null}
          </View>
          <Text variant="muted">明天 0:00（北京时间）换新的一只</Text>
        </View>
      ) : (
        <View className="gap-2">
          <Text variant="small" className="text-muted-foreground">
            再猜一只　还剩 {left} 次
          </Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="输入熊猫名字"
            placeholderTextColor={String(mutedColor)}
            editable={!pending}
            autoCorrect={false}
            accessibilityLabel="猜一只熊猫"
            className="h-14 rounded-full border-hairline border-input px-5 text-base text-foreground"
          />
          {search.trim() !== "" && matches.length === 0 ? <Text variant="muted">没有找到这只熊猫</Text> : null}
          {matches.length > 0 ? (
            <View className="overflow-hidden rounded-lg border-hairline border-border">
              {matches.map((panda, index) => (
                <Pressable
                  key={panda.id}
                  className={cn("flex-row items-center gap-3 px-4 py-3 active:bg-accent", index > 0 && "border-t-hairline border-border")}
                  onPress={() => choose(panda.id)}
                  role="button"
                >
                  <Text className="font-bold">{panda.name}</Text>
                  {panda.alternateName ? <Text variant="muted">{panda.alternateName}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {guessFailed ? <Text className="text-xs text-destructive">这次没能提交，请再猜一次。</Text> : null}
        </View>
      )}
    </Page>
  );
}
