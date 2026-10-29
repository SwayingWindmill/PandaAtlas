import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { entryBySlug, learningText } from "@/features/learning/catalog";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { LearningSources } from "@/features/learning/sources";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { openPanda } from "@/features/pandas/panda-row";
import { cn } from "@/lib/utils";

function slugParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function FaceGuideScreen() {
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  const { pandas } = useLearningPandas();
  if (state.status !== "ready") {
    return (
      <Page label="认脸指南" title="认脸指南">
        {state.status === "loading" ? <Skeleton className="h-64 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const guide = entryBySlug(state.catalog.faceGuides, slug);
  if (!guide) return <Page label="认脸指南" title="没有这一篇" />;
  const panda = pandas?.find((item) => item.slug === guide.pandaSlug) ?? null;
  const title = learningText(guide.title);
  return (
    <Page label="认脸指南" title={title}>
      <PandaPhoto pandaId={panda?.id ?? null} label={title} aspect="4/5" />
      <View>
        {guide.tips.map((tip, index) => (
          <View
            key={tip.key}
            className={cn(
              "gap-1 border-t-hairline border-border py-3",
              index === guide.tips.length - 1 && "border-b-hairline",
            )}
          >
            <Text variant="small" className="text-muted-foreground">
              {learningText(tip.label)}
            </Text>
            <Text>{learningText(tip.body)}</Text>
          </View>
        ))}
      </View>
      {panda ? (
        <Button variant="secondary" className="self-start" onPress={() => openPanda(panda.slug)}>
          <Text>{`看${panda.name}的资料`}</Text>
        </Button>
      ) : null}
      <LearningSources sources={guide.sources} />
    </Page>
  );
}
