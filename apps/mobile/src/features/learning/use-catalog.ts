import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { pandaIndexQueryOptions } from "@/features/pandas/pandas";

import { type LearningCatalog, type LearningPanda } from "./catalog";
import { loadLearningCatalog } from "./load";

export type CatalogLoad =
  | { status: "loading" }
  | { status: "ready"; catalog: LearningCatalog }
  | { status: "failed" };

export function useLearningCatalog(): { state: CatalogLoad; reload: () => void } {
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["public", "learning-catalog"],
    queryFn: loadLearningCatalog,
    staleTime: 300_000,
    networkMode: "always",
  });
  const state: CatalogLoad = data
    ? { status: "ready", catalog: data }
    : isError && !isFetching
      ? { status: "failed" }
      : { status: "loading" };
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);
  return { state, reload };
}

export function useLearningPandas(): { pandas: LearningPanda[] | null; failed: boolean; reload: () => void } {
  const { data, isError, isFetching, refetch } = useQuery(pandaIndexQueryOptions());
  const pandas = useMemo(
    () => (data ? data.map((item) => ({ id: item.id, slug: item.slug, name: item.name })) : null),
    [data],
  );
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);
  return { pandas, failed: !data && isError && !isFetching, reload };
}
