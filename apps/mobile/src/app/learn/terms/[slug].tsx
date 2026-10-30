import { router, useLocalSearchParams } from "expo-router";

import { LoadFailed } from "@/components/load-failed";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { entryBySlug, learningText } from "@/features/learning/catalog";
import { ReadingPage, ReadingSkeletonGround } from "@/features/learning/reading-page";
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
      <ReadingSkeletonGround>
        {state.status === "loading" ? <Skeleton className="h-32 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </ReadingSkeletonGround>
    );
  }
  const term = entryBySlug(state.catalog.terms, slug);
  if (!term) {
    return (
      <ReadingSkeletonGround>
        <ScreenState message="没有这一篇。" actionLabel="回到科普" onAction={() => router.replace("/learn")} />
      </ReadingSkeletonGround>
    );
  }
  const related = term.relatedSlugs.flatMap((relatedSlug) => {
    const item = entryBySlug(state.catalog.terms, relatedSlug);
    return item ? [item] : [];
  });
  const index = state.catalog.terms.findIndex((item) => item.slug === term.slug);
  const { previous, next } = neighborsAt(state.catalog.terms, index);
  return (
    <ReadingPage meta="名词解释" title={learningText(term.term)}>
      <Text variant="readingBody">{learningText(term.definition)}</Text>
      {related.length > 0 ? (
        <ManualSection title="相关名词">
          {related.map((item) => (
            <IndexRow
              key={item.slug}
              label={learningText(item.term)}
              onPress={() => router.push({ pathname: "/learn/terms/[slug]", params: { slug: item.slug } })}
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
    </ReadingPage>
  );
}
