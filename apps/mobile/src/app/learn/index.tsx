import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { catalogIsEmpty, learningText, visibleTips } from "@/features/learning/catalog";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { IndexRow, ManualSection } from "@/features/learning/rows";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";

function openCard(slug: string) {
  router.push({ pathname: "/learn/cards/[slug]", params: { slug } });
}

function openTopic(slug: string) {
  router.push({ pathname: "/learn/topics/[slug]", params: { slug } });
}

function openTerm(slug: string) {
  router.push({ pathname: "/learn/terms/[slug]", params: { slug } });
}

function openFace(slug: string) {
  router.push({ pathname: "/learn/faces/[slug]", params: { slug } });
}

export default function LearnScreen() {
  const { state, reload } = useLearningCatalog();
  const { pandas } = useLearningPandas();
  if (state.status !== "ready") {
    return (
      <Page title="认识大熊猫">
        {state.status === "loading" ? <Skeleton className="-mx-5 h-80" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }

  const { catalog } = state;
  if (catalogIsEmpty(catalog)) {
    return (
      <Page title="认识大熊猫">
        <Text className="text-muted-foreground">科普还在写。</Text>
      </Page>
    );
  }

  const featured = catalog.faceGuides[0];
  const featuredPanda = featured ? pandas?.find((panda) => panda.slug === featured.pandaSlug) : undefined;
  const featuredMark = featured ? visibleTips(featured.tips)[0] : undefined;

  return (
    <Page title="认识大熊猫" contentContainerClassName="gap-10 px-5 pb-16">
      {featured ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={learningText(featured.title)}
          onPress={() => openFace(featured.slug)}
          className="-mx-5"
        >
          <PandaPhoto pandaId={featuredPanda?.id ?? null} label={learningText(featured.title)} aspect="4/5" rounded={false} decorative />
          <View className="gap-1 px-5 pt-3">
            <Text variant="h2">{learningText(featured.title)}</Text>
            {featuredMark ? <Text className="leading-6">{learningText(featuredMark.body)}</Text> : null}
          </View>
        </Pressable>
      ) : null}

      {catalog.cards.length > 0 ? (
        <ManualSection title="知识卡" meta={`${catalog.cards.length} 张`}>
          {catalog.cards.map((card, index) => (
            <IndexRow
              key={card.slug}
              label={learningText(card.title)}
              detail={learningText(card.summary)}
              onPress={() => openCard(card.slug)}
              last={index === catalog.cards.length - 1}
            />
          ))}
        </ManualSection>
      ) : null}

      {catalog.topics.length > 0 ? (
        <ManualSection title="专题">
          {catalog.topics.map((topic, index) => (
            <IndexRow
              key={topic.slug}
              label={learningText(topic.title)}
              detail={learningText(topic.summary)}
              onPress={() => openTopic(topic.slug)}
              last={index === catalog.topics.length - 1}
            />
          ))}
        </ManualSection>
      ) : null}

      {catalog.terms.length > 0 ? (
        <ManualSection title="名词解释">
          {catalog.terms.map((term, index) => (
            <IndexRow
              key={term.slug}
              label={learningText(term.term)}
              onPress={() => openTerm(term.slug)}
              last={index === catalog.terms.length - 1}
            />
          ))}
        </ManualSection>
      ) : null}

      {catalog.faceGuides.length > 1 ? (
        <ManualSection title="认脸指南">
          {catalog.faceGuides.slice(1).map((guide, index, guides) => {
            const panda = pandas?.find((item) => item.slug === guide.pandaSlug);
            const title = learningText(guide.title);
            return (
              <Pressable
                key={guide.slug}
                accessibilityRole="button"
                accessibilityLabel={title}
                onPress={() => openFace(guide.slug)}
                className={`min-h-11 flex-row items-center gap-3 border-t-hairline border-border py-2.5 active:bg-accent ${index === guides.length - 1 ? "border-b-hairline" : ""}`}
              >
                <View className="size-14">
                  <PandaPhoto pandaId={panda?.id ?? null} label={title} aspect="1/1" rounded={false} decorative />
                </View>
                <Text className="min-w-0 flex-1 font-bold">{title}</Text>
              </Pressable>
            );
          })}
        </ManualSection>
      ) : null}

      {catalog.challenges.length > 0 ? (
        <IndexRow label="认脸挑战" detail={learningText(catalog.challenges[0]?.prompt)} onPress={() => router.push("/learn/challenge")} last />
      ) : null}

      {catalog.version ? <Text variant="muted">{`资料版本 ${catalog.version}`}</Text> : null}
    </Page>
  );
}
