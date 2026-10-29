import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
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

export default function TermScreen() {
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  if (state.status !== "ready") {
    return (
      <Page label="名词解释" title="名词解释">
        {state.status === "loading" ? <Skeleton className="h-32 w-full rounded-xl" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const term = entryBySlug(state.catalog.terms, slug);
  if (!term) return <Page label="名词解释" title="没有这一篇" />;
  const related = term.relatedSlugs.flatMap((relatedSlug) => {
    const item = entryBySlug(state.catalog.terms, relatedSlug);
    return item ? [item] : [];
  });
  return (
    <Page label="名词解释" title={learningText(term.term)} contentContainerClassName="gap-6 px-5 pb-16">
      <Card>
        <Text className="p-5 leading-7">{learningText(term.definition)}</Text>
      </Card>
      {related.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title="相关名词" />
          <View className="flex-row flex-wrap gap-2">
            {related.map((item) => (
              <Chip
                key={item.slug}
                label={learningText(item.term)}
                onPress={() => router.push({ pathname: "/learn/terms/[slug]", params: { slug: item.slug } })}
              />
            ))}
          </View>
        </View>
      ) : null}
      <LearningSources sources={term.sources} />
    </Page>
  );
}
