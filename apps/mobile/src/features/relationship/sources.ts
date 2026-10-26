import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { loadLineage } from "@/lib/public-data";

import { buildGraph } from "./relationship";

/** The published pandas and their parent links. */
export async function loadKinship(): Promise<{ pandas: PandaListItem[]; graph: ReturnType<typeof buildGraph> }> {
  const [pandas, lineage] = await Promise.all([loadPandaIndex(), loadLineage()]);
  return { pandas, graph: buildGraph(lineage) };
}
