import { ApiRequestError, requestJson } from "@/lib/api/request";

import type { AuditEvidence } from "./types";

export async function listAuditEvidence(limit: number): Promise<AuditEvidence[]> {
  try {
    return await requestJson<AuditEvidence[]>(`/api/admin/audit/evidence?limit=${limit}`);
  } catch (error) {
    throw new Error(`读取审计证据失败${error instanceof ApiRequestError ? ` (${error.status})` : ""}`);
  }
}
