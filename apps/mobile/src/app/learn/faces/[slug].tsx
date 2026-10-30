import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { entryBySlug, learningText, visibleTips } from "@/features/learning/catalog";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { DefinitionRow, NeighborRows, neighborsAt } from "@/features/learning/rows";
import { LearningSources } from "@/features/learning/sources";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { openPanda } from "@/features/pandas/panda-row";

function slugParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function FaceGuideScreen() {
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  const { pandas } = useLearningPandas();
  if (state.status !== "ready") {
    return (
      <Page title="认脸指南" prominent>
        {state.status === "loading" ? <Skeleton className="-mx-5 h-80" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const guide = entryBySlug(state.catalog.faceGuides, slug);
  if (!guide) return <Page title="没有这一篇" prominent />;
  const panda = pandas?.find((item) => item.slug === guide.pandaSlug) ?? null;
  const title = learningText(guide.title);
  const tips = visibleTips(guide.tips);
  const index = state.catalog.faceGuides.findIndex((item) => item.slug === guide.slug);
  const { previous, next } = neighborsAt(state.catalog.faceGuides, index);
  return (
    <Page title={title} prominent contentContainerClassName="gap-8 px-4 pb-16">
      <View className="-mx-4 overflow-hidden">
        <PandaPhoto pandaId={panda?.id ?? null} label={title} aspect="4/5" rounded={false} />
      </View>
      {tips.length > 0 ? (
        <View className="overflow-hidden rounded-[10px] bg-card">
          {tips.map((tip, tipIndex) => (
            <DefinitionRow
              key={tip.key}
              label={learningText(tip.label)}
              body={learningText(tip.body)}
              last={tipIndex === tips.length - 1}
            />
          ))}
        </View>
      ) : null}
      {panda ? (
        <Button onPress={() => openPanda(panda.slug)}>
          <Text>{`看${panda.name}的资料`}</Text>
        </Button>
      ) : null}
      <NeighborRows
        previous={previous}
        next={next}
        labelOf={(entry) => learningText(entry.title)}
        onOpen={(entry) => router.push({ pathname: "/learn/faces/[slug]", params: { slug: entry.slug } })}
      />
      <LearningSources sources={guide.sources} />
    </Page>
  );
}
