import type { Href } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { NavRow } from "@/components/nav-row";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { catalogIsEmpty, learningText } from "@/features/learning/catalog";
import { useLearningCatalog } from "@/features/learning/use-catalog";

function cardHref(slug: string): Href {
  return { pathname: "/learn/cards/[slug]", params: { slug } };
}

function topicHref(slug: string): Href {
  return { pathname: "/learn/topics/[slug]", params: { slug } };
}

function termHref(slug: string): Href {
  return { pathname: "/learn/terms/[slug]", params: { slug } };
}

function faceHref(slug: string): Href {
  return { pathname: "/learn/faces/[slug]", params: { slug } };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-1">
      <Text variant="h2">{title}</Text>
      <View>{children}</View>
    </View>
  );
}

export default function LearnScreen() {
  const { state, reload } = useLearningCatalog();
  if (state.status !== "ready") {
    return (
      <Page label="科普" title="认识大熊猫">
        {state.status === "loading" ? <Skeleton className="h-24 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }

  const { catalog } = state;
  if (catalogIsEmpty(catalog)) {
    return (
      <Page label="科普" title="认识大熊猫">
        <Text className="text-muted-foreground">科普还在写。</Text>
      </Page>
    );
  }

  const showFaces = catalog.faceGuides.length > 0 || catalog.challenges.length > 0;
  return (
    <Page label="科普" title="认识大熊猫">
      {catalog.cards.length > 0 ? (
        <Section title="知识卡">
          {catalog.cards.map((card, index) => (
            <NavRow
              key={card.slug}
              label={learningText(card.title)}
              href={cardHref(card.slug)}
              last={index === catalog.cards.length - 1}
            />
          ))}
        </Section>
      ) : null}
      {catalog.topics.length > 0 ? (
        <Section title="专题">
          {catalog.topics.map((topic, index) => (
            <NavRow
              key={topic.slug}
              label={learningText(topic.title)}
              href={topicHref(topic.slug)}
              last={index === catalog.topics.length - 1}
            />
          ))}
        </Section>
      ) : null}
      {catalog.terms.length > 0 ? (
        <Section title="名词解释">
          {catalog.terms.map((term, index) => (
            <NavRow
              key={term.slug}
              label={learningText(term.term)}
              href={termHref(term.slug)}
              last={index === catalog.terms.length - 1}
            />
          ))}
        </Section>
      ) : null}
      {showFaces ? (
        <Section title="认脸指南">
          {catalog.faceGuides.map((guide, index) => (
            <NavRow
              key={guide.slug}
              label={learningText(guide.title)}
              href={faceHref(guide.slug)}
              last={catalog.challenges.length === 0 && index === catalog.faceGuides.length - 1}
            />
          ))}
          {catalog.challenges.length > 0 ? <NavRow label="认脸挑战" href="/learn/challenge" last /> : null}
        </Section>
      ) : null}
      {catalog.version ? <Text variant="muted">{`资料版本 ${catalog.version}`}</Text> : null}
    </Page>
  );
}
