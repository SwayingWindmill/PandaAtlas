import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Card, PressableCard } from "@/components/card";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
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
        {state.status === "loading" ? <Skeleton className="h-40 w-full rounded-xl" accessibilityLabel="正在加载" /> : null}
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
    <Page label="专题" title={learningText(topic.title)} contentContainerClassName="gap-6 px-5 pb-16">
      <Card>
        <Text className="bg-highlight-soft p-5 leading-6">{learningText(topic.summary)}</Text>
      </Card>
      {topic.sections.map((section) => (
        <Card key={learningText(section.heading)}>
          <View className="gap-2 p-5">
            <Text variant="h2">{learningText(section.heading)}</Text>
            <Text className="leading-7">{learningText(section.body)}</Text>
          </View>
        </Card>
      ))}
      {cards.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title="本专题的知识卡" />
          {cards.map((card) => (
            <PressableCard
              key={card.slug}
              accessibilityRole="button"
              accessibilityLabel={learningText(card.title)}
              onPress={() => router.push({ pathname: "/learn/cards/[slug]", params: { slug: card.slug } })}
            >
              <View className="gap-1 p-4">
                <Text className="font-bold">{learningText(card.title)}</Text>
                <Text className="text-muted-foreground" numberOfLines={2}>
                  {learningText(card.summary)}
                </Text>
              </View>
            </PressableCard>
          ))}
        </View>
      ) : null}
      <LearningSources sources={topic.sources} />
    </Page>
  );
}
