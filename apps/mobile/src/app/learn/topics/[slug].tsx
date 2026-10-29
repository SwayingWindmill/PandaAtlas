import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { entryBySlug, learningText } from "@/features/learning/catalog";
import { IndexRow, ManualSection, NeighborRows, neighborsAt } from "@/features/learning/rows";
import { LearningSources } from "@/features/learning/sources";
import { useLearningCatalog } from "@/features/learning/use-catalog";

function slugParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function TopicScreen() {
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  if (state.status !== "ready") {
    return (
      <Page title="专题">
        {state.status === "loading" ? <Skeleton className="h-40 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const topic = entryBySlug(state.catalog.topics, slug);
  if (!topic) return <Page title="没有这一篇" />;
  const cards = topic.cardSlugs.flatMap((cardSlug) => {
    const card = entryBySlug(state.catalog.cards, cardSlug);
    return card ? [card] : [];
  });
  const index = state.catalog.topics.findIndex((item) => item.slug === topic.slug);
  const { previous, next } = neighborsAt(state.catalog.topics, index);
  return (
    <Page title={learningText(topic.title)} contentContainerClassName="gap-8 px-5 pb-16">
      <Text className="leading-7">{learningText(topic.summary)}</Text>
      {topic.sections.map((section) => (
        <View key={learningText(section.heading)} className="gap-2">
          <Text variant="h2">{learningText(section.heading)}</Text>
          <Text className="leading-7">{learningText(section.body)}</Text>
        </View>
      ))}
      {cards.length > 0 ? (
        <ManualSection title="本专题的知识卡">
          {cards.map((card, cardIndex) => (
            <IndexRow
              key={card.slug}
              label={learningText(card.title)}
              detail={learningText(card.summary)}
              onPress={() => router.push({ pathname: "/learn/cards/[slug]", params: { slug: card.slug } })}
              last={cardIndex === cards.length - 1}
            />
          ))}
        </ManualSection>
      ) : null}
      <NeighborRows
        previous={previous}
        next={next}
        labelOf={(entry) => learningText(entry.title)}
        onOpen={(entry) => router.push({ pathname: "/learn/topics/[slug]", params: { slug: entry.slug } })}
      />
      <LearningSources sources={topic.sources} />
    </Page>
  );
}
