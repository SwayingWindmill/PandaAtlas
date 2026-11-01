import { type Lineage, buildLineage, sourcedLinks } from "@/features/family/lineage";
import { loadPandaIndex } from "@/features/pandas/pandas";
import { api } from "@/lib/api";
import { loadLineage } from "@/lib/public-data";

export interface LineageSource {
  sourceId: string;
  title: string;
  publisher: string;
  url: string;
  lastVerifiedOn: string;
}

/** The published sources behind the page's links. A source that fails to load is left out, not invented. */
export async function loadLineageSources(sourceIds: string[]): Promise<LineageSource[]> {
  const results = await Promise.all(
    sourceIds.slice(0, 12).map((sourceId) =>
      api.GET("/api/v2/evidence/{sourceId}", { params: { path: { sourceId } } }).catch(() => null),
    ),
  );
  return results.flatMap((result) => {
    const source = result?.data?.source;
    return source ? [{ sourceId: source.sourceId, title: source.title, publisher: source.publisher, url: source.url, lastVerifiedOn: source.lastVerifiedOn }] : [];
  });
}

/** The 家谱 beyond the tree for one panda, from the lineage and panda index the app already caches. */
export async function loadLineageFor(focusId: string): Promise<Lineage> {
  const [links, pandas] = await Promise.all([loadLineage(), loadPandaIndex()]);
  return buildLineage(focusId, sourcedLinks(links), new Map(pandas.map((panda) => [panda.id, panda])));
}
