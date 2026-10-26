import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { api } from "@/lib/api";

import { type ParentLink, buildGraph } from "./relationship";

let links: Promise<ParentLink[]> | null = null;

/** The published pandas and their parent links, loaded once per app session. */
export async function loadKinship(): Promise<{ pandas: PandaListItem[]; graph: ReturnType<typeof buildGraph> }> {
  links ??= api
    .GET("/api/v2/lineage")
    .then(({ data }) => {
      if (!data) throw new Error("Lineage unavailable");
      return data.items;
    })
    .catch((error: unknown) => {
      links = null;
      throw error;
    });
  const [pandas, lineage] = await Promise.all([loadPandaIndex(), links]);
  return { pandas, graph: buildGraph(lineage) };
}
