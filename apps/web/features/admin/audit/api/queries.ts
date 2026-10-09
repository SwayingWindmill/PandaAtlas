import { queryOptions } from "@tanstack/react-query";

import { listAuditEvidence } from "./service";

const auditEvidenceKeys = {
  all: ["admin", "audit", "evidence"] as const,
  list: (limit: number) => [...auditEvidenceKeys.all, { limit }] as const,
};

export function auditEvidenceQueryOptions(limit: number) {
  return queryOptions({
    queryKey: auditEvidenceKeys.list(limit),
    queryFn: () => listAuditEvidence(limit),
  });
}
