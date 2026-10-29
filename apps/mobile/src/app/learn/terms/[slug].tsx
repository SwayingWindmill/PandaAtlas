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

export default function TermScreen() {
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  if (state.status !== "ready") {
    return (
      <Page label="名词解释" title="名词解释">
        {state.status === "loading" ? <Skeleton className="h-24 w-full" accessibilityLabel="正在加载" /> : null}
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
    <Page label="名词解释" title={learningText(term.term)}>
      <Text>{learningText(term.definition)}</Text>
      {related.length > 0 ? (
        <View className="gap-1">
          <Text variant="h2">相关名词</Text>
          <View>
            {related.map((item, index) => (
              <NavRow
                key={item.slug}
                label={learningText(item.term)}
                href={{ pathname: "/learn/terms/[slug]", params: { slug: item.slug } }}
                last={index === related.length - 1}
              />
            ))}
          </View>
        </View>
      ) : null}
      <LearningSources sources={term.sources} />
    </Page>
  );
}
