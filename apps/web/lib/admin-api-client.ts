import type { ImportJob, ImportSourceList } from "@/lib/types";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let detail = `Request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep the default detail.
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function listImportSources(): Promise<ImportSourceList> {
  return adminFetch<ImportSourceList>("/api/admin/import-sources");
}

export async function createImportJob(payload: { source_name: string }): Promise<ImportJob> {
  return adminFetch<ImportJob>("/api/admin/import-jobs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function runImportJob(jobId: string): Promise<ImportJob> {
  return adminFetch<ImportJob>(`/api/admin/import-jobs/${jobId}/run`, {
    method: "POST"
  });
}

export async function getImportJob(jobId: string): Promise<ImportJob> {
  return adminFetch<ImportJob>(`/api/admin/import-jobs/${jobId}`);
}
