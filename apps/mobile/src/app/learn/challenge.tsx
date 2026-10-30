import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import Animated from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { Check, X } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { ScreenState } from "@/components/screen-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CONTENT_ENTER } from "@/design/motion";
import { presentChallenge, resolveChallenge } from "@/features/learning/catalog";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { ReadingPage, ReadingSkeletonGround } from "@/features/learning/reading-page";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { openPanda } from "@/features/pandas/panda-row";
import { loadPhotos } from "@/features/pandas/profile";
import { selectionHaptic, successHaptic } from "@/lib/haptics";
import { RADIUS } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const KICKER = "认脸挑战";

/** The verdict mounts after the page has settled; on web an entering view would overlap the options. */
const REVEAL = Platform.OS === "web" ? undefined : CONTENT_ENTER;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size) rows.push(items.slice(start, start + size));
  return rows;
}

export default function FaceChallengeScreen() {
  const colors = useIOSColors();
  const { state, reload } = useLearningCatalog();
  const { pandas, failed: pandasFailed } = useLearningPandas();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const photoKey =
    state.status === "ready" && pandas
      ? [
          ...new Set(
            state.catalog.challenges.flatMap((challenge) => [challenge.answerPandaSlug, ...challenge.decoyPandaSlugs]),
          ),
        ]
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
      <ReadingSkeletonGround>
        {state.status === "failed" ? (
          <LoadFailed message="科普暂时打不开。" onRetry={reload} />
        ) : (
          <Skeleton className="w-full rounded-tile" style={{ aspectRatio: 4 / 3 }} accessibilityLabel="正在出题" />
        )}
      </ReadingSkeletonGround>
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
      <ReadingPage kicker={KICKER} title="看照片认熊猫">
        <ScreenState
          message={state.catalog.challenges.length === 0 ? "现在还没有认脸挑战。" : "这道题的熊猫还不在当前资料里。"}
        />
      </ReadingPage>
    );
  }

  if (!photosReady || pandas === null) {
    return (
      <ReadingSkeletonGround>
        <Skeleton className="w-full rounded-tile" style={{ aspectRatio: 4 / 3 }} accessibilityLabel="正在出题" />
      </ReadingSkeletonGround>
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
  const answer = presented.options.find((option) => option.slug === answerSlug);
  const showNames = presented.mode === "compare" || answered;

  function choose(slug: string) {
    if (chosen !== null) return;
    setChosen(slug);
    if (slug === answerSlug) {
      successHaptic();
      setCorrectCount((count) => count + 1);
    } else {
      selectionHaptic();
    }
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
    <ReadingPage kicker={`${KICKER}　${index + 1} / ${playable.length}　得分 ${correctCount}`} title={presented.title}>
      {presented.questionPhotoUrl ? (
        <View className="overflow-hidden rounded-tile" style={{ aspectRatio: 4 / 3, borderCurve: "continuous" }}>
          <Image
            source={presented.questionPhotoUrl}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            accessibilityLabel="待认熊猫的另一张照片"
          />
          <PhotoOutline radius={RADIUS.tile} />
        </View>
      ) : null}

      <View accessibilityLabel="选项" className="gap-row">
        {chunk(presented.options, 2).map((row) => (
          <View key={row.map((option) => option.slug).join()} className="flex-row gap-row">
            {row.map((option) => {
              const optionIndex = presented.options.indexOf(option);
              const isAnswer = answered && option.slug === answerSlug;
              const wrongPick = chosen === option.slug && !isAnswer;
              const label = showNames ? option.name : `照片 ${optionIndex + 1}`;
              return (
                <PressScale
                  key={option.slug}
                  onPress={() => choose(option.slug)}
                  disabled={answered}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: chosen === option.slug }}
                  containerStyle={{ flex: 1 }}
                  className="gap-stack-tight"
                >
                  <View
                    className={cn(
                      "overflow-hidden rounded-tile border-2",
                      isAnswer ? "border-primary" : wrongPick ? "border-destructive" : "border-transparent",
                    )}
                    style={{ borderCurve: "continuous" }}
                  >
                    <ChoicePhoto url={option.photoUrl} pandaId={option.pandaId} label={label} />
                  </View>
                  {showNames ? (
                    <View className="flex-row items-center justify-center gap-hair-gap">
                      {isAnswer ? <Icon icon={Check} size="subhead" tone="tint" /> : null}
                      {wrongPick ? <Icon icon={X} size="subhead" color={colors.destructive} /> : null}
                      <Text
                        variant="subheadline"
                        className={cn(
                          "text-center",
                          isAnswer
                            ? "font-semibold text-primary"
                            : wrongPick
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {option.name}
                      </Text>
                    </View>
                  ) : null}
                </PressScale>
              );
            })}
            {row.length === 1 ? <View className="flex-1" /> : null}
          </View>
        ))}
      </View>

      {answered ? (
        <Animated.View entering={REVEAL} className="gap-row" accessibilityLiveRegion="polite">
          <Text variant="readingHeading">{correct ? "认对了" : "这次没认对"}</Text>
          <Text variant="readingBody">{round.tip}</Text>
          <View className="gap-stack-tight pt-stack-tight">
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
              <Button variant="tinted" onPress={() => openPanda(answer.slug)}>
                <Text>{`看${answer.name}的资料`}</Text>
              </Button>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ReadingPage>
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
