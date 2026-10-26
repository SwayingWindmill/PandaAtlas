import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type GuessOutcome, type GuessQuestion, NoQuestionError, answerQuestion, loadQuestion } from "@/features/guess/guess";
import { openPanda } from "@/features/pandas/panda-row";
import { useSession } from "@/features/session/session";
import { cn } from "@/lib/utils";

type Load = { status: "loading" } | { status: "ready"; question: GuessQuestion } | { status: "empty" } | { status: "failed" };

export default function GuessScreen() {
  const { state: session } = useSession();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [round, setRound] = useState(1);
  const [chosen, setChosen] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GuessOutcome | null>(null);
  const [answerFailed, setAnswerFailed] = useState(false);

  const next = useCallback(() => {
    loadQuestion()
      .then((question) => {
        setChosen(null);
        setOutcome(null);
        setLoad({ status: "ready", question });
      })
      .catch((error: unknown) => setLoad({ status: error instanceof NoQuestionError ? "empty" : "failed" }));
  }, []);
  useEffect(next, [next]);

  function choose(question: GuessQuestion, pandaId: string) {
    if (chosen) return;
    setChosen(pandaId);
    setAnswerFailed(false);
    answerQuestion(question.questionId, pandaId, session.status === "signedIn")
      .then(setOutcome)
      .catch(() => {
        setChosen(null);
        setAnswerFailed(true);
      });
  }

  const label = `猜熊猫　第 ${round} 题`;
  if (load.status !== "ready") {
    return (
      <Page label="猜熊猫" title="这是哪只熊猫？">
        {load.status === "loading" ? <Skeleton className="h-64 w-full" accessibilityLabel="正在出题" /> : null}
        {load.status === "empty" ? <Text className="text-muted-foreground">现在还没有可以猜的题目。</Text> : null}
        {load.status === "failed" ? (
          <LoadFailed message="题目暂时打不开。" onRetry={next} />
        ) : null}
      </Page>
    );
  }

  const { question } = load;
  const answer = outcome ? question.options.find((option) => option.pandaId === outcome.answerPandaId) : undefined;
  return (
    <Page label={label} title="这是哪只熊猫？">
      <View className="overflow-hidden rounded-lg">
        <Image
          source={question.photoUrl}
          style={{ width: "100%", aspectRatio: 4 / 3 }}
          contentFit="cover"
          accessibilityLabel="待猜熊猫的照片"
        />
      </View>
      <View role="group" accessibilityLabel="选项" className="flex-row flex-wrap gap-2">
        {question.options.map((option) => {
          const isAnswer = outcome?.answerPandaId === option.pandaId;
          const wrongPick = outcome !== null && chosen === option.pandaId && !isAnswer;
          return (
            <Pressable
              key={option.pandaId}
              onPress={() => choose(question, option.pandaId)}
              disabled={chosen !== null}
              role="button"
              accessibilityLabel={option.name}
              className={cn(
                "h-16 basis-[48%] grow items-center justify-center rounded-lg border-hairline border-input active:bg-accent",
                isAnswer && "border-foreground bg-accent",
                wrongPick && "border-destructive",
              )}
            >
              <Text className="font-bold">{option.name}</Text>
              {isAnswer ? (
                <Text variant="small" className="font-bold text-foreground">
                  是它
                </Text>
              ) : null}
              {wrongPick ? (
                <Text variant="small" className="text-destructive">
                  不是它
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {answerFailed ? <Text className="text-destructive">没能提交，请再选一次。</Text> : null}
      {outcome ? (
        <View className="gap-3" accessibilityLiveRegion="polite">
          <Text variant="h2">{outcome.correct ? "猜对了" : "这次没猜对"}</Text>
          {outcome.tips.map((tip) => (
            <Text key={tip} className="text-muted-foreground">
              {tip}
            </Text>
          ))}
          <View className="flex-row flex-wrap gap-2">
            <Button
              onPress={() => {
                setRound((value) => value + 1);
                next();
              }}
            >
              <Text>下一题</Text>
            </Button>
            {answer?.slug ? (
              <Button variant="secondary" onPress={() => openPanda(answer.slug as string)}>
                <Text>{`看${answer.name}的资料`}</Text>
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}
    </Page>
  );
}
