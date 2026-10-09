import type { AuditEvidence } from "./types";

export async function listAuditEvidence(limit: number): Promise<AuditEvidence[]> {
  const response = await fetch(`/api/admin/audit/evidence?limit=${limit}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`读取审计证据失败 (${response.status})`);
  return response.json() as Promise<AuditEvidence[]>;
}
