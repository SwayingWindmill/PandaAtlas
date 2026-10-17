import { requestJson } from "@/lib/api/request";

import type { AuditEvidence } from "./types";

export function listAuditEvidence(limit: number): Promise<AuditEvidence[]> {
  return requestJson(`/api/admin/audit/evidence?limit=${limit}`);
}
