import { useState } from "react";
import { Pressable, View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { resolveChallenge } from "@/features/learning/catalog";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { openPanda } from "@/features/pandas/panda-row";
import { cn } from "@/lib/utils";

export default function FaceChallengeScreen() {
  const { state, reload } = useLearningCatalog();
  const { pandas, failed: pandasFailed } = useLearningPandas();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);

  if (state.status !== "ready" || (pandas === null && !pandasFailed)) {
    return (
      <Page label="认脸挑战" title="这是哪只熊猫？">
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
        {state.status !== "failed" ? <Skeleton className="h-64 w-full" accessibilityLabel="正在出题" /> : null}
      </Page>
    );
  }

  const playable = (pandas ?? [])
    .length === 0
    ? []
    : state.catalog.challenges.flatMap((challenge) => {
        const resolved = resolveChallenge(challenge, pandas ?? []);
        return resolved ? [resolved] : [];
      });
  const round = playable[index % Math.max(playable.length, 1)];

  if (!round) {
    return (
      <Page label="认脸挑战" title="这是哪只熊猫？">
        <Text className="text-muted-foreground">
          {state.catalog.challenges.length === 0 ? "现在还没有认脸挑战。" : "这道题的熊猫还不在当前资料里。"}
        </Text>
      </Page>
    );
  }

  const answer = round.options.find((option) => option.slug === round.answerSlug);
  return (
    <Page label={`认脸挑战　第 ${index + 1} 题`} title={round.prompt}>
      <PandaPhoto pandaId={round.photoPandaId} label="待认熊猫的照片" aspect="4/3" />
      <View role="group" accessibilityLabel="选项" className="flex-row flex-wrap gap-2">
        {round.options.map((option) => {
          const isAnswer = chosen !== null && option.slug === round.answerSlug;
          const wrongPick = chosen === option.slug && option.slug !== round.answerSlug;
          return (
            <Pressable
              key={option.slug}
              onPress={() => {
                if (chosen === null) setChosen(option.slug);
              }}
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
      {chosen ? (
        <View className="gap-3" accessibilityLiveRegion="polite">
          <Text variant="h2">{chosen === round.answerSlug ? "认对了" : "这次没认对"}</Text>
          <Text className="text-muted-foreground">{round.tip}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Button
              onPress={() => {
                setChosen(null);
                setIndex((value) => value + 1);
              }}
            >
              <Text>下一题</Text>
            </Button>
            {answer ? (
              <Button variant="secondary" onPress={() => openPanda(answer.slug)}>
                <Text>{`看${answer.name}的资料`}</Text>
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}
    </Page>
  );
}
