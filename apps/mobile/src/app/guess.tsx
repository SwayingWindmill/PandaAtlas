import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import Animated from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { Check, X } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { ScreenState } from "@/components/screen-state";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CONTENT_ENTER } from "@/design/motion";
import {
  DIFFICULTIES,
  type GuessDifficulty,
  type GuessOutcome,
  type GuessQuestion,
  NoQuestionError,
  answerQuestion,
  difficultyOf,
  loadQuestion,
} from "@/features/guess/guess";
import { openPanda } from "@/features/pandas/panda-row";
import { useSession } from "@/features/session/session";
import { selectionHaptic, successHaptic } from "@/lib/haptics";
import { RADIUS } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Load =
  { status: "loading" } | { status: "ready"; question: GuessQuestion } | { status: "empty" } | { status: "failed" };

const TITLE = "这是哪只熊猫？";

type Level = "any" | GuessDifficulty;

const LEVELS: readonly { value: Level; label: string }[] = [
  { value: "any", label: "随机" },
  ...DIFFICULTIES.map(({ value, label }) => ({ value, label })),
];

function LevelPicker({ value, onChange }: { value: Level; onChange: (level: Level) => void }) {
  return <Segmented value={value} options={LEVELS} onChange={onChange} accessibilityLabel="难度" />;
}

/** The verdict mounts after the page has settled; on web an entering view would overlap the options. */
const REVEAL = Platform.OS === "web" ? undefined : CONTENT_ENTER;

function pairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += 2) rows.push(items.slice(start, start + 2));
  return rows;
}

export default function GuessScreen() {
  const colors = useIOSColors();
  const { state: session } = useSession();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [round, setRound] = useState(1);
  const [chosen, setChosen] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GuessOutcome | null>(null);
  const [answerFailed, setAnswerFailed] = useState(false);
  const [level, setLevel] = useState<Level>("any");

  const next = useCallback(() => {
    loadQuestion(level === "any" ? undefined : level)
      .then((question) => {
        setChosen(null);
        setOutcome(null);
        setLoad({ status: "ready", question });
      })
      .catch((error: unknown) => setLoad({ status: error instanceof NoQuestionError ? "empty" : "failed" }));
  }, [level]);
  useEffect(next, [next]);

  function changeLevel(value: Level) {
    if (value === level) return;
    selectionHaptic();
    setChosen(null);
    setOutcome(null);
    setAnswerFailed(false);
    setLoad({ status: "loading" });
    setLevel(value);
  }

  function choose(question: GuessQuestion, pandaId: string) {
    if (chosen) return;
    setChosen(pandaId);
    setAnswerFailed(false);
    answerQuestion(question.questionId, pandaId, session.status === "signedIn")
      .then((result) => {
        if (result.correct) successHaptic();
        else selectionHaptic();
        setOutcome(result);
      })
      .catch(() => {
        setChosen(null);
        setAnswerFailed(true);
      });
  }

  if (load.status !== "ready") {
    return (
      <Page label="猜熊猫" title={TITLE}>
        <LevelPicker value={level} onChange={changeLevel} />
        {load.status === "loading" ? (
          <View className="gap-inset" accessibilityLabel="正在出题">
            <Skeleton className="w-full rounded-card" style={{ aspectRatio: 4 / 3 }} />
            <Skeleton className="h-28 w-full rounded-control" />
          </View>
        ) : null}
        {load.status === "empty" ? (
          level === "any" ? (
            <ScreenState message="现在还没有可以猜的题目。" />
          ) : (
            <ScreenState
              message={`${difficultyOf(level).label}这一档暂时没有题目。`}
              actionLabel="换成随机"
              onAction={() => changeLevel("any")}
            />
          )
        ) : null}
        {load.status === "failed" ? <LoadFailed message="题目暂时打不开。" onRetry={next} /> : null}
      </Page>
    );
  }

  const { question } = load;
  const answer = outcome ? question.options.find((option) => option.pandaId === outcome.answerPandaId) : undefined;
  const picked = outcome && !outcome.correct ? question.options.find((option) => option.pandaId === chosen) : undefined;
  const shown = difficultyOf(question.difficulty);
  return (
    <Page label={`猜熊猫　第 ${round} 题`} title={TITLE}>
      <LevelPicker value={level} onChange={changeLevel} />
      <View className="overflow-hidden rounded-card bg-media-placeholder" style={{ borderCurve: "continuous" }}>
        <Image
          source={question.photoUrl}
          style={{ width: "100%", aspectRatio: 4 / 3 }}
          contentFit="cover"
          accessibilityLabel="待猜熊猫的照片"
        />
        <PhotoOutline radius={RADIUS.card} />
      </View>

      <Text variant="footnote" className="text-muted-foreground">
        {`${shown.label}　${shown.meaning}`}
      </Text>

      <View role="group" accessibilityLabel="选项" className="gap-row">
        {pairs(question.options).map((row) => (
          <View key={row.map((option) => option.pandaId).join()} className="flex-row gap-row">
            {row.map((option) => {
              const isAnswer = outcome?.answerPandaId === option.pandaId;
              const wrongPick = outcome !== null && chosen === option.pandaId && !isAnswer;
              const waiting = outcome === null && chosen === option.pandaId;
              return (
                <PressScale
                  key={option.pandaId}
                  onPress={() => choose(question, option.pandaId)}
                  disabled={chosen !== null}
                  role="button"
                  accessibilityLabel={
                    isAnswer ? `${option.name}，是它` : wrongPick ? `${option.name}，不是它` : option.name
                  }
                  containerStyle={{ flex: 1 }}
                  className={cn(
                    "min-h-14 flex-row items-center justify-center gap-stack-tight rounded-control border-2 bg-card px-row py-row",
                    isAnswer
                      ? "border-primary"
                      : wrongPick
                        ? "border-destructive"
                        : waiting
                          ? "border-border"
                          : "border-transparent",
                    outcome !== null && !isAnswer && !wrongPick && "opacity-50",
                  )}
                  style={{ borderCurve: "continuous" }}
                >
                  {isAnswer ? <Icon icon={Check} size="subhead" tone="tint" /> : null}
                  {wrongPick ? <Icon icon={X} size="subhead" color={colors.destructive} /> : null}
                  <Text
                    variant="headline"
                    numberOfLines={2}
                    className={cn("text-center", isAnswer && "text-primary", wrongPick && "text-destructive")}
                  >
                    {option.name}
                  </Text>
                </PressScale>
              );
            })}
            {row.length === 1 ? <View className="flex-1" /> : null}
          </View>
        ))}
      </View>

      {answerFailed ? (
        <Text variant="footnote" className="text-destructive">
          没能提交，请再选一次。
        </Text>
      ) : null}

      {outcome ? (
        <Animated.View entering={REVEAL} className="gap-row" accessibilityLiveRegion="polite">
          <Text variant="title">{outcome.correct ? "猜对了" : "这次没猜对"}</Text>
          {outcome.tips.map((tip) => (
            <Text key={tip} variant="body" className="text-muted-foreground">
              {tip}
            </Text>
          ))}
          <View className="gap-stack-tight pt-stack-tight">
            <Button
              onPress={() => {
                setRound((value) => value + 1);
                next();
              }}
            >
              <Text>下一题</Text>
            </Button>
            {answer?.slug && picked?.slug ? (
              <Button
                variant="tinted"
                onPress={() =>
                  router.push({ pathname: "/compare", params: { a: answer.slug as string, b: picked.slug as string } })
                }
              >
                <Text className="text-center">{`比一比${answer.name}和${picked.name}`}</Text>
              </Button>
            ) : null}
            {answer?.slug ? (
              <Button variant={picked?.slug ? "secondary" : "tinted"} onPress={() => openPanda(answer.slug as string)}>
                <Text className="text-center">{`看${answer.name}的资料`}</Text>
              </Button>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Page>
  );
}
