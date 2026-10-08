import { queryOptions } from "@tanstack/react-query";
import { getCurationChangeSet, listCurationChangeSets } from "./service";
import type { CurationListParams } from "./types";

export const curationKeys = {
  all: ["admin", "curation"] as const,
  list: (params: CurationListParams) => [...curationKeys.all, "list", params] as const,
  detail: (id: string) => [...curationKeys.all, "detail", id] as const,
};

export function curationListQueryOptions(params: CurationListParams) {
  return queryOptions({ queryKey: curationKeys.list(params), queryFn: () => listCurationChangeSets(params) });
}

export function curationDetailQueryOptions(id: string) {
  return queryOptions({ queryKey: curationKeys.detail(id), queryFn: () => getCurationChangeSet(id) });
}
