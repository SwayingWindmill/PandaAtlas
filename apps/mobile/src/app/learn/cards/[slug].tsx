import { router, useLocalSearchParams } from "expo-router";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { entryBySlug, learningText } from "@/features/learning/catalog";
import { NeighborRows, neighborsAt } from "@/features/learning/rows";
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
      <Page title="知识卡">
        {state.status === "loading" ? <Skeleton className="h-40 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const card = entryBySlug(state.catalog.cards, slug);
  if (!card) return <Page title="没有这一篇" />;
  const index = state.catalog.cards.findIndex((item) => item.slug === card.slug);
  const { previous, next } = neighborsAt(state.catalog.cards, index);
  return (
    <Page title={learningText(card.title)} contentContainerClassName="gap-8 px-5 pb-16">
      <Text className="leading-7">{learningText(card.summary)}</Text>
      <Text className="leading-7">{learningText(card.body)}</Text>
      <NeighborRows
        previous={previous}
        next={next}
        labelOf={(entry) => learningText(entry.title)}
        onOpen={(entry) => router.push({ pathname: "/learn/cards/[slug]", params: { slug: entry.slug } })}
      />
      <LearningSources sources={card.sources} />
    </Page>
  );
}
