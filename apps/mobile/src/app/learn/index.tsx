import { router } from "expo-router";
import { Baby, Eye, Leaf, ScanFace, Sparkles } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { PressableCard } from "@/components/card";
import { Chip } from "@/components/chip";
import { Hero } from "@/components/hero";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { catalogIsEmpty, learningText } from "@/features/learning/catalog";
import { IconWell } from "@/features/learning/icon-well";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { usePandaCover } from "@/lib/covers";

const CARD_ICONS: Record<string, LucideIcon> = {
  "black-eye-patches": Eye,
  bamboo: Leaf,
  cubs: Baby,
};

const TOPIC_ICONS: Record<string, LucideIcon> = {
  "telling-faces-apart": ScanFace,
  "what-pandas-eat": Leaf,
};

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
      <Page label="科普" title="认识大熊猫">
        {state.status === "loading" ? <Skeleton className="h-72 w-full rounded-xl" accessibilityLabel="正在加载" /> : null}
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

  const featured = catalog.faceGuides[0];
  const featuredPanda = featured ? pandas?.find((panda) => panda.slug === featured.pandaSlug) : undefined;
  const tagline = catalog.topics[0] ? learningText(catalog.topics[0].summary) : learningText(catalog.cards[0]?.summary);

  return (
    <Page label="科普" title="认识大熊猫" contentContainerClassName="gap-8 px-5 pb-16">
      <FeaturedHero pandaId={featuredPanda?.id ?? null} title={featured ? learningText(featured.title) : "认识大熊猫"} subtitle={tagline} />

      {catalog.cards.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title="知识卡" meta={`${catalog.cards.length} 张`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-1">
            {catalog.cards.map((card) => (
              <PressableCard
                key={card.slug}
                accessibilityRole="button"
                accessibilityLabel={learningText(card.title)}
                onPress={() => openCard(card.slug)}
                className="w-44"
              >
                <View className="gap-3 p-4">
                  <IconWell icon={CARD_ICONS[card.slug] ?? Eye} />
                  <Text className="font-bold">{learningText(card.title)}</Text>
                  <Text className="text-muted-foreground" numberOfLines={3}>
                    {learningText(card.summary)}
                  </Text>
                </View>
              </PressableCard>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {catalog.topics.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title="专题" />
          {catalog.topics.map((topic) => (
            <PressableCard
              key={topic.slug}
              accessibilityRole="button"
              accessibilityLabel={learningText(topic.title)}
              onPress={() => openTopic(topic.slug)}
            >
              <View className="flex-row items-center gap-4 p-4">
                <IconWell icon={TOPIC_ICONS[topic.slug] ?? ScanFace} large />
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="font-bold">{learningText(topic.title)}</Text>
                  <Text className="text-muted-foreground" numberOfLines={2}>
                    {learningText(topic.summary)}
                  </Text>
                </View>
              </View>
            </PressableCard>
          ))}
        </View>
      ) : null}

      {catalog.terms.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title="名词解释" />
          <View className="flex-row flex-wrap gap-2">
            {catalog.terms.map((term) => (
              <Chip key={term.slug} label={learningText(term.term)} onPress={() => openTerm(term.slug)} />
            ))}
          </View>
        </View>
      ) : null}

      {catalog.faceGuides.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title="认脸指南" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-1">
            {catalog.faceGuides.map((guide) => {
              const panda = pandas?.find((item) => item.slug === guide.pandaSlug);
              const title = learningText(guide.title);
              return (
                <PressableCard
                  key={guide.slug}
                  accessibilityRole="button"
                  accessibilityLabel={title}
                  onPress={() => openFace(guide.slug)}
                  className="w-40"
                >
                  <PandaPhoto pandaId={panda?.id ?? null} label={title} aspect="4/5" rounded={false} />
                  <Text className="px-3 py-3 font-bold">{title}</Text>
                </PressableCard>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {catalog.challenges.length > 0 ? <ChallengeCard prompt={learningText(catalog.challenges[0]?.prompt)} /> : null}

      {catalog.version ? <Text variant="muted">{`资料版本 ${catalog.version}`}</Text> : null}
    </Page>
  );
}

function ChallengeCard({ prompt }: { prompt: string }) {
  const ink = useCSSVariable("--color-primary-foreground");
  return (
    <PressableCard accessibilityRole="button" accessibilityLabel="认脸挑战" onPress={() => router.push("/learn/challenge")} className="bg-primary">
      <View className="flex-row items-center gap-4 p-5">
        <View className="size-14 items-center justify-center rounded-xl bg-background/15">
          <Sparkles size={28} color={String(ink)} strokeWidth={2} />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="small" className="text-highlight">
            认脸挑战
          </Text>
          <Text variant="h2" className="text-primary-foreground">
            {prompt}
          </Text>
          <Text className="text-primary-foreground">开始</Text>
        </View>
      </View>
    </PressableCard>
  );
}

function FeaturedHero({ pandaId, title, subtitle }: { pandaId: string | null; title: string; subtitle: string }) {
  const photo = pandaId ? <Cover pandaId={pandaId} title={title} subtitle={subtitle} /> : <Hero imageUrl={null} label="认一认" title={title} subtitle={subtitle} />;
  return photo;
}

function Cover({ pandaId, title, subtitle }: { pandaId: string; title: string; subtitle: string }) {
  const photo = usePandaCover(pandaId);
  return <Hero imageUrl={photo} label="认一认" title={title} subtitle={subtitle} />;
}
