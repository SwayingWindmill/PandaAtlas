import { useEffect, useState } from "react";

import { ListCell, ListSection } from "@/components/grouped-list";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";

import { compareSuggestions } from "./compare";

/**
 * 比一比 on a panda page: up to three pandas to put side by side, each with the fact that puts it here.
 * Nothing shows while loading, on an error, or when no panda qualifies.
 */
export function CompareRows({ slug }: { slug: string }) {
  const { state: catalog } = useLearningCatalog();
  const [pandas, setPandas] = useState<PandaListItem[] | null>(null);
  useEffect(() => {
    let live = true;
    loadPandaIndex()
      .then((items) => {
        if (live) setPandas(items);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const target = pandas?.find((panda) => panda.slug === slug);
  if (!pandas || !target) return null;
  // Without the learning catalog the same-place suggestions still stand.
  const challenges = catalog.status === "ready" ? catalog.catalog.challenges : [];
  if (catalog.status === "loading") return null;
  const suggestions = compareSuggestions(target, pandas, challenges);
  if (suggestions.length === 0) return null;
  return (
    <ListSection title="比一比">
      {suggestions.map(({ panda, reason }, index) => (
        <ListCell
          key={panda.slug}
          label={`和${panda.name}比一比`}
          detail={reason}
          href={{ pathname: "/compare", params: { a: target.slug, b: panda.slug } }}
          last={index === suggestions.length - 1}
        />
      ))}
    </ListSection>
  );
}
