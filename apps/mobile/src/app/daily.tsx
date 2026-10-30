import { Image } from "expo-image";
import { router } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Share, View } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Check, Lock } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PhotoOutline } from "@/components/photo-outline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { SearchField } from "@/features/pandas/search-field";
import { useSession } from "@/features/session/session";
import { selectionHaptic, successHaptic } from "@/lib/haptics";
import { HAIRLINE, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

const MAX_MATCHES = 8;
const TITLE = "今天是哪只熊猫？";
const LABEL = "每日一猫";

/** "2026-10-26" -> "10月26日" */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${month}月${day}日`;
}

/** A grouped card: the clues and the guesses read as one list each, the way Fitness lists a workout. */
function Group({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
      {children}
    </View>
  );
}

function Separator() {
  return <View className="ml-inset bg-border" style={{ height: HAIRLINE }} />;
}

/** The section label over a group, in the footnote the grouped lists use. */
function GroupLabel({ children, trailing }: { children: string; trailing?: string }) {
  return (
    <View className="flex-row items-baseline justify-between px-inset">
      <Text variant="footnote" className="text-muted-foreground">
        {children}
      </Text>
      {trailing ? (
        <Text variant="footnote" className="text-muted-foreground tabular-nums">
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

export default function DailyPandaScreen() {
  const [state, setState] = useState<DailyPandaState | null>(null);
  const [pandas, setPandas] = useState<PandaChoice[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [guessFailed, setGuessFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");

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
      .filter((panda) =>
        [panda.name, panda.alternateName ?? "", panda.slug].some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, MAX_MATCHES);
  }, [guessedIds, pandas, search]);

  if (!state) {
    return (
      <Page label={LABEL} title={TITLE}>
        {loadFailed ? (
          <LoadFailed message="今天的每日一猫暂时打不开。" onRetry={retry} />
        ) : (
          <View className="gap-row" accessibilityLabel="正在加载每日一猫">
            <Skeleton className="h-6 w-32 rounded-pill" />
            <Skeleton className="h-48 w-full rounded-group" />
            <Skeleton className="h-11 w-full rounded-control" />
          </View>
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
      .then((next) => {
        if (next.guesses.at(-1)?.correct) successHaptic();
        else selectionHaptic();
        setState(next);
      })
      .catch(() => setGuessFailed(true))
      .finally(() => setPending(false));
  }

  function share() {
    const marks = current.guesses.map((guess) => (guess.correct ? "🟩" : "🟥")).join("");
    const score = current.solved ? `${current.guesses.length}/${current.maxGuesses}` : `X/${current.maxGuesses}`;
    void Share.share({ message: `吱熊猫 每日一猫 ${current.puzzleDate} ${score}\n${marks}` });
  }

  return (
    <Page label={LABEL} title={TITLE} keyboardShouldPersistTaps="handled">
      {/* 笋金 marks today, once on the screen. */}
      <View className="flex-row">
        <View className="rounded-pill bg-warm-soft px-stack-tight py-hair-gap">
          <Text variant="footnote" className="font-semibold text-warm">{`今天　${shortDate(current.puzzleDate)}`}</Text>
        </View>
      </View>

      <View className="gap-stack-tight">
        <GroupLabel trailing={`${current.clues.length} / ${current.clueCount}`}>线索</GroupLabel>
        <Group>
          {Array.from({ length: current.clueCount }, (_, index) => {
            const clue = current.clues[index];
            return (
              <View key={index}>
                {index > 0 ? <Separator /> : null}
                <View
                  className={cn("min-h-11 flex-row gap-row px-inset py-row", clue?.kind !== "photo" && "items-center")}
                >
                  <View className="size-7 items-center justify-center rounded-pill bg-secondary">
                    <Text variant="footnote" className="font-semibold tabular-nums">
                      {index + 1}
                    </Text>
                  </View>
                  {clue === undefined ? (
                    <View className="flex-1 flex-row items-center gap-stack-tight">
                      <Icon icon={Lock} size="footnote" tone="tertiary" />
                      <Text variant="body" className="text-muted-foreground">
                        猜错一次解锁
                      </Text>
                    </View>
                  ) : clue.kind === "photo" ? (
                    <View
                      className="flex-1 overflow-hidden rounded-tile bg-media-placeholder"
                      style={{ aspectRatio: 4 / 3, borderCurve: "continuous" }}
                    >
                      <Image
                        source={clue.imageUrl}
                        style={{ flex: 1 }}
                        contentFit="cover"
                        accessibilityLabel="它的公开照片"
                      />
                      <PhotoOutline radius={RADIUS.tile} />
                    </View>
                  ) : (
                    <Text variant="body" className="flex-1">
                      {clue.text}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </Group>
      </View>

      {current.guesses.length > 0 ? (
        <View className="gap-stack-tight">
          <GroupLabel>你猜过</GroupLabel>
          <Group>
            {current.guesses.map((guess, index) => (
              <View key={guess.pandaId}>
                {index > 0 ? <Separator /> : null}
                <View className="min-h-11 gap-stack-tight px-inset py-row">
                  <View className="flex-row items-center gap-stack-tight">
                    <Text variant="headline" className="flex-1">
                      {pandasById.get(guess.pandaId)?.name ?? guess.pandaId}
                    </Text>
                    {guess.correct ? (
                      <View className="flex-row items-center gap-hair-gap">
                        <Icon icon={Check} size="footnote" tone="tint" />
                        <Text variant="footnote" className="font-semibold text-primary">
                          猜中了
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {guess.correct ? null : (
                    <View className="flex-row flex-wrap gap-stack-tight">
                      {feedbackParts(guess).map((part) => (
                        <View key={part} className="rounded-pill bg-secondary px-stack-tight py-hair-gap">
                          <Text variant="footnote" className="text-muted-foreground">
                            {part}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Group>
        </View>
      ) : null}

      {current.finished ? (
        <View
          className="gap-inset rounded-card bg-card p-stack"
          style={{ borderCurve: "continuous" }}
          accessibilityLiveRegion="polite"
        >
          <View className="gap-hair-gap">
            <Text variant="footnote" className="text-muted-foreground">
              今天的答案
            </Text>
            <Text variant="title">{answer?.name ?? "这只熊猫"}</Text>
            <Text
              variant="subheadline"
              className={current.solved ? "font-semibold text-primary" : "text-muted-foreground"}
            >
              {current.solved ? `第 ${current.guesses.length} 次猜中` : "这次没猜中"}
            </Text>
          </View>
          {savedToBook ? (
            <View className="flex-row items-center gap-hair-gap">
              <Icon icon={Check} size="footnote" tone="tint" />
              <Text variant="footnote" className="text-primary">
                已收进图鉴
              </Text>
            </View>
          ) : null}
          <View className="gap-stack-tight">
            <Button onPress={share}>
              <Text>分享结果</Text>
            </Button>
            {current.answer ? (
              <Button variant="tinted" onPress={() => openPanda(current.answer!.canonicalSlug)}>
                <Text>{answer ? `看${answer.name}的资料` : "看资料"}</Text>
              </Button>
            ) : null}
            {!savedToBook && session.status === "signedOut" ? (
              <Button variant="plain" onPress={() => router.push("/sign-in")}>
                <Text>登录，收进图鉴</Text>
              </Button>
            ) : null}
          </View>
          <Text variant="footnote" className="text-center text-muted-foreground">
            明天 0:00（北京时间）换新的一只
          </Text>
        </View>
      ) : (
        <View className="gap-stack-tight">
          <View className="flex-row items-center justify-between px-inset">
            <Text variant="footnote" className="text-muted-foreground">
              再猜一只
            </Text>
            <View className="flex-row items-center gap-stack-tight" accessible accessibilityLabel={`还剩 ${left} 次`}>
              <View className="flex-row gap-hair-gap">
                {Array.from({ length: current.maxGuesses }, (_, index) => (
                  <View
                    key={index}
                    className={cn("size-2 rounded-pill", index < left ? "bg-primary" : "bg-secondary")}
                  />
                ))}
              </View>
              <Text variant="footnote" className="text-muted-foreground tabular-nums">{`还剩 ${left} 次`}</Text>
            </View>
          </View>
          <SearchField
            value={search}
            onChange={setSearch}
            label="猜一只熊猫"
            placeholder="输入熊猫名字"
            editable={!pending}
          />
          {search.trim() !== "" && matches.length === 0 ? (
            <Text variant="footnote" className="px-inset text-muted-foreground">
              没有找到这只熊猫
            </Text>
          ) : null}
          {matches.length > 0 ? (
            <ListSection>
              {matches.map((panda, index) => (
                <ListCell
                  key={panda.id}
                  label={panda.name}
                  meta={panda.alternateName ?? undefined}
                  onPress={() => choose(panda.id)}
                  last={index === matches.length - 1}
                />
              ))}
            </ListSection>
          ) : null}
          {guessFailed ? (
            <Text variant="footnote" className="px-inset text-destructive">
              这次没能提交，请再猜一次。
            </Text>
          ) : null}
        </View>
      )}
    </Page>
  );
}
