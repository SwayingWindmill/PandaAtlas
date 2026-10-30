import { useCallback, useEffect, useState } from "react";

import { loadPandaIndex } from "@/features/pandas/pandas";

import { type LearningCatalog, type LearningPanda } from "./catalog";
import { loadLearningCatalog } from "./load";

export type CatalogLoad =
  | { status: "loading" }
  | { status: "ready"; catalog: LearningCatalog }
  | { status: "failed" };

export function useLearningCatalog(): { state: CatalogLoad; reload: () => void } {
  const [state, setState] = useState<CatalogLoad>({ status: "loading" });
  const load = useCallback(() => {
    loadLearningCatalog()
      .then((catalog) => setState({ status: "ready", catalog }))
      .catch(() => setState({ status: "failed" }));
  }, []);
  const reload = useCallback(() => {
    setState({ status: "loading" });
    load();
  }, [load]);
  useEffect(() => {
    load();
  }, [load]);
  return { state, reload };
}

export function useLearningPandas(): { pandas: LearningPanda[] | null; failed: boolean; reload: () => void } {
  const [pandas, setPandas] = useState<LearningPanda[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    loadPandaIndex()
      .then((items) => setPandas(items.map((item) => ({ id: item.id, slug: item.slug, name: item.name }))))
      .catch(() => setFailed(true));
  }, []);
  const reload = useCallback(() => {
    setFailed(false);
    load();
  }, [load]);
  useEffect(() => {
    load();
  }, [load]);
  return { pandas, failed, reload };
}
