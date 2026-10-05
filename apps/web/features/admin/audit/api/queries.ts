import { queryOptions } from "@tanstack/react-query";

import type { AuditEvidence } from "./types";

const auditEvidenceKeys = {
  all: ["admin", "audit", "evidence"] as const,
  list: (limit: number) => [...auditEvidenceKeys.all, { limit }] as const,
};

async function listAuditEvidence(limit: number): Promise<AuditEvidence[]> {
  const response = await fetch(`/api/admin/audit/evidence?limit=${limit}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`Audit evidence request failed (${response.status})`);
  return response.json() as Promise<AuditEvidence[]>;
}

export function auditEvidenceQueryOptions(limit: number) {
  return queryOptions({
    queryKey: auditEvidenceKeys.list(limit),
    queryFn: () => listAuditEvidence(limit),
  });
}
