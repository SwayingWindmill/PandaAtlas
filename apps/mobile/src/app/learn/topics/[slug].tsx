import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { NavRow } from "@/components/nav-row";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { entryBySlug, learningText } from "@/features/learning/catalog";
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
      <Page label="专题" title="专题">
        {state.status === "loading" ? <Skeleton className="h-24 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const topic = entryBySlug(state.catalog.topics, slug);
  if (!topic) return <Page label="专题" title="没有这一篇" />;
  const cards = topic.cardSlugs.flatMap((cardSlug) => {
    const card = entryBySlug(state.catalog.cards, cardSlug);
    return card ? [card] : [];
  });
  return (
    <Page label="专题" title={learningText(topic.title)}>
      <Text className="text-muted-foreground">{learningText(topic.summary)}</Text>
      {topic.sections.map((section) => (
        <View key={learningText(section.heading)} className="gap-2">
          <Text variant="h2">{learningText(section.heading)}</Text>
          <Text>{learningText(section.body)}</Text>
        </View>
      ))}
      {cards.length > 0 ? (
        <View className="gap-1">
          <Text variant="h2">本专题的知识卡</Text>
          <View>
            {cards.map((card, index) => (
              <NavRow
                key={card.slug}
                label={learningText(card.title)}
                href={{ pathname: "/learn/cards/[slug]", params: { slug: card.slug } }}
                last={index === cards.length - 1}
              />
            ))}
          </View>
        </View>
      ) : null}
      <LearningSources sources={topic.sources} />
    </Page>
  );
}
