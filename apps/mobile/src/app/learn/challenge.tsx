import { Image } from "expo-image";
import { Check, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Card } from "@/components/card";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { presentChallenge, resolveChallenge } from "@/features/learning/catalog";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { openPanda } from "@/features/pandas/panda-row";
import { loadPhotos } from "@/features/pandas/profile";
import { cn } from "@/lib/utils";

export default function FaceChallengeScreen() {
  const { state, reload } = useLearningCatalog();
  const { pandas, failed: pandasFailed } = useLearningPandas();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const markInk = useCSSVariable("--color-primary-foreground");
  const photoKey =
    state.status === "ready" && pandas
      ? [...new Set(state.catalog.challenges.flatMap((challenge) => [challenge.answerPandaSlug, ...challenge.decoyPandaSlugs]))]
          .sort()
          .join(",")
      : "";
  const [photoBySlug, setPhotoBySlug] = useState<Map<string, string[]> | null>(null);
  useEffect(() => {
    if (photoKey === "") return;
    let cancel = false;
    Promise.all(
      photoKey.split(",").map(async (slug) => {
        try {
          const photos = await loadPhotos(slug);
          return [slug, photos.map((photo) => photo.url)] as const;
        } catch {
          return [slug, [] as string[]] as const;
        }
      }),
    ).then((rows) => {
      if (!cancel) setPhotoBySlug(new Map(rows));
    });
    return () => {
      cancel = true;
    };
  }, [photoKey]);

  if (state.status !== "ready" || (pandas === null && !pandasFailed)) {
    return (
      <Page label="认脸挑战" title="看照片认熊猫">
        {state.status === "failed" ? (
          <LoadFailed message="科普暂时打不开。" onRetry={reload} />
        ) : (
          <Skeleton className="h-64 w-full rounded-xl" accessibilityLabel="正在出题" />
        )}
      </Page>
    );
  }

  const playable =
    pandas === null
      ? []
      : state.catalog.challenges.flatMap((challenge) => {
          const resolved = resolveChallenge(challenge, pandas);
          return resolved ? [resolved] : [];
        });
  const round = playable[index];
  const photosReady = photoKey === "" || photoBySlug !== null;

  if (!round) {
    return (
      <Page label="认脸挑战" title="看照片认熊猫">
        <Card>
          <Text className="p-5 text-muted-foreground">
            {state.catalog.challenges.length === 0 ? "现在还没有认脸挑战。" : "这道题的熊猫还不在当前资料里。"}
          </Text>
        </Card>
      </Page>
    );
  }

  if (!photosReady || pandas === null) {
    return (
      <Page label="认脸挑战" title="看照片认熊猫">
        <Skeleton className="h-64 w-full rounded-xl" accessibilityLabel="正在出题" />
      </Page>
    );
  }

  const byId = new Map<string, string[]>();
  for (const panda of pandas) {
    const urls = photoBySlug?.get(panda.slug);
    if (urls) byId.set(panda.id, urls);
  }
  const presented = presentChallenge(round, byId);
  const answered = chosen !== null;
  const answerSlug = round.answerSlug;
  const correct = chosen === answerSlug;
  const progress = (index + (answered ? 1 : 0)) / playable.length;
  const answer = presented.options.find((option) => option.slug === answerSlug);
  const showNames = presented.mode === "compare" || answered;

  function choose(slug: string) {
    if (chosen !== null) return;
    setChosen(slug);
    if (slug === answerSlug) setCorrectCount((count) => count + 1);
  }

  function next() {
    setChosen(null);
    setIndex((value) => value + 1);
  }

  function again() {
    setChosen(null);
    setIndex(0);
    setCorrectCount(0);
  }

  return (
    <Page label="认脸挑战" title={presented.title} contentContainerClassName="gap-5 px-5 pb-16">
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text variant="small" className="text-highlight-foreground">
            {`${index + 1} / ${playable.length}`}
          </Text>
          <Text variant="small" className="text-muted-foreground">
            {`得分 ${correctCount}`}
          </Text>
        </View>
        <View className="h-1.5 overflow-hidden rounded-full bg-muted">
          <View className="h-full rounded-full bg-highlight" style={{ width: `${Math.round(progress * 100)}%` }} />
        </View>
      </View>

      {presented.questionPhotoUrl ? (
        <Card>
          <View className="aspect-[4/3] overflow-hidden">
            <Image
              source={presented.questionPhotoUrl}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              accessibilityLabel="待认熊猫的另一张照片"
            />
          </View>
        </Card>
      ) : null}

      <View accessibilityLabel="选项" className="flex-row flex-wrap gap-3">
        {presented.options.map((option, optionIndex) => {
          const isAnswer = answered && option.slug === answerSlug;
          const wrongPick = chosen === option.slug && !isAnswer;
          const label = showNames ? option.name : `照片 ${optionIndex + 1}`;
          return (
            <Pressable
              key={option.slug}
              onPress={() => choose(option.slug)}
              disabled={answered}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: chosen === option.slug }}
              className={cn(
                "basis-[47%] overflow-hidden rounded-xl border-hairline border-border bg-card active:opacity-90",
                isAnswer && "border-foreground",
                wrongPick && "border-destructive",
              )}
              style={({ pressed }) => ({ transform: [{ scale: pressed && !answered ? 0.97 : 1 }] })}
            >
              <View>
                <ChoicePhoto url={option.photoUrl} pandaId={option.pandaId} label={label} />
                {isAnswer ? <Mark icon="check" color={String(markInk)} /> : null}
                {wrongPick ? <Mark icon="wrong" color={String(markInk)} /> : null}
              </View>
              {showNames ? <Text className="px-3 py-3 text-center font-bold">{option.name}</Text> : <View className="h-4" />}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <Animated.View entering={FadeIn.duration(250)} className="gap-4" accessibilityLiveRegion="polite">
          <Card>
            <View className="gap-2 p-5">
              <Text variant="h2">{correct ? "认对了" : "这次没认对"}</Text>
              <Text className="leading-6 text-muted-foreground">{round.tip}</Text>
            </View>
          </Card>
          <View className="flex-row flex-wrap gap-2">
            {index < playable.length - 1 ? (
              <Button onPress={next}>
                <Text>下一题</Text>
              </Button>
            ) : (
              <Button onPress={again}>
                <Text>再来一次</Text>
              </Button>
            )}
            {answer ? (
              <Button variant="secondary" onPress={() => openPanda(answer.slug)}>
                <Text>{`看${answer.name}的资料`}</Text>
              </Button>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Page>
  );
}

function ChoicePhoto({ url, pandaId, label }: { url: string | null; pandaId: string; label: string }) {
  if (!url) return <PandaPhoto pandaId={pandaId} label={label} aspect="1/1" rounded={false} decorative />;
  return (
    <View className="aspect-square overflow-hidden">
      <Image source={url} style={{ width: "100%", height: "100%" }} contentFit="cover" accessible={false} />
    </View>
  );
}

function Mark({ icon, color }: { icon: "check" | "wrong"; color: string }) {
  return (
    <View className={cn("absolute right-2 top-2 size-8 items-center justify-center rounded-full", icon === "check" ? "bg-primary" : "bg-destructive")}>
      {icon === "check" ? <Check size={18} color={color} strokeWidth={2.4} /> : <X size={18} color={color} strokeWidth={2.4} />}
    </View>
  );
}
