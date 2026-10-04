import { queryOptions } from "@tanstack/react-query";

import { getAdminSession } from "./service";

export const adminSessionQueryOptions = queryOptions({
  queryKey: ["admin", "session"],
  queryFn: getAdminSession,
  retry: false,
});
