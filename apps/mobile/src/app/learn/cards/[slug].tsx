import { useLocalSearchParams } from "expo-router";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { entryBySlug, learningText } from "@/features/learning/catalog";
import { LearningSources } from "@/features/learning/sources";
import { useLearningCatalog } from "@/features/learning/use-catalog";

function slugParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function LearnCardScreen() {
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  if (state.status !== "ready") {
    return (
      <Page label="知识卡" title="知识卡">
        {state.status === "loading" ? <Skeleton className="h-24 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const card = entryBySlug(state.catalog.cards, slug);
  if (!card) return <Page label="知识卡" title="没有这一篇" />;
  return (
    <Page label="知识卡" title={learningText(card.title)}>
      <Text className="text-muted-foreground">{learningText(card.summary)}</Text>
      <Text>{learningText(card.body)}</Text>
      <LearningSources sources={card.sources} />
    </Page>
  );
}
