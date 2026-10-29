import { router, useLocalSearchParams } from "expo-router";

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

export default function TermScreen() {
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  if (state.status !== "ready") {
    return (
      <Page title="名词解释">
        {state.status === "loading" ? <Skeleton className="h-32 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </Page>
    );
  }
  const term = entryBySlug(state.catalog.terms, slug);
  if (!term) return <Page title="没有这一篇" />;
  const related = term.relatedSlugs.flatMap((relatedSlug) => {
    const item = entryBySlug(state.catalog.terms, relatedSlug);
    return item ? [item] : [];
  });
  const index = state.catalog.terms.findIndex((item) => item.slug === term.slug);
  const { previous, next } = neighborsAt(state.catalog.terms, index);
  return (
    <Page title={learningText(term.term)} contentContainerClassName="gap-8 px-5 pb-16">
      <Text className="leading-7">{learningText(term.definition)}</Text>
      {related.length > 0 ? (
        <ManualSection title="相关名词">
          {related.map((item, itemIndex) => (
            <IndexRow
              key={item.slug}
              label={learningText(item.term)}
              onPress={() => router.push({ pathname: "/learn/terms/[slug]", params: { slug: item.slug } })}
              last={itemIndex === related.length - 1}
            />
          ))}
        </ManualSection>
      ) : null}
      <NeighborRows
        previous={previous}
        next={next}
        labelOf={(entry) => learningText(entry.term)}
        onOpen={(entry) => router.push({ pathname: "/learn/terms/[slug]", params: { slug: entry.slug } })}
      />
      <LearningSources sources={term.sources} />
    </Page>
  );
}
