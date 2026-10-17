import { queryOptions } from "@tanstack/react-query";

import { requestJson } from "@/lib/api/request";

import type { AdminSession } from "./types";

export const adminSessionQueryOptions = queryOptions({
  queryKey: ["admin", "session"],
  queryFn: () => requestJson<AdminSession>("/api/admin/session"),
  retry: false,
});
