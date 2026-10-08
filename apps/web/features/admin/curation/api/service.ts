import type { CurationChangeSet, CurationChangeSetPage, CurationListParams } from "./types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", credentials: "same-origin", ...options });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(problem?.detail ?? `策展请求失败 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function listCurationChangeSets(params: CurationListParams) {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  if (params.state) query.set("state", params.state);
  return request<CurationChangeSetPage>(`/api/admin/curation/change-sets?${query}`);
}

export function getCurationChangeSet(id: string) {
  return request<CurationChangeSet>(`/api/admin/curation/change-sets/${encodeURIComponent(id)}`);
}

export function validateCurationChangeSet(id: string) {
  return request<CurationChangeSet>(`/api/admin/curation/change-sets/${encodeURIComponent(id)}/validate`, { method: "POST" });
}

export function approveCurationChangeSet(id: string, reason: string) {
  return request<CurationChangeSet>(`/api/admin/curation/change-sets/${encodeURIComponent(id)}/approve`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }),
  });
}
