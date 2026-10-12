import type { components } from "@zhipanda/api-client";
import { queryOptions } from "@tanstack/react-query";

export type PublicationReleasePage = components["schemas"]["PublicationReleasePageDto"];
export type PublicationReleaseSummary = components["schemas"]["PublicationReleaseSummaryDto"];
export type PublicationReleaseInspection = components["schemas"]["PublicationReleaseInspectionDto"];
export type PublicationAction = "seal" | "activate" | "rollback" | "suspend" | "restore";

interface PublicationReleaseListParams {
  limit: number;
  offset: number;
  lifecycleState?: "building" | "sealed";
}

export class PublicationAuthenticationError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export const publicationKeys = {
  all: ["admin", "publication"] as const,
  releases: () => [...publicationKeys.all, "releases"] as const,
  list: (params: PublicationReleaseListParams) => [...publicationKeys.releases(), params] as const,
  inspection: (releaseId: string) => [...publicationKeys.all, "inspection", releaseId] as const,
};

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { code?: string; detail?: string } | null;
    if (body?.code === "auth.recentAuthRequired") {
      throw new PublicationAuthenticationError(body.code, "此敏感操作的近期身份验证已过期，请重新登录并验证后重试。");
    }
    if (body?.code === "auth.aalRequired") {
      throw new PublicationAuthenticationError(body.code, "此敏感操作需要完成双重验证，请先前往账号安全页面。");
    }
    if (body?.code === "auth.liveSessionRequired") {
      throw new PublicationAuthenticationError(body.code, "当前登录会话已失效，请重新登录后重试。");
    }
    throw new Error(body?.detail ?? `${fallback} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function publicationReleaseListQueryOptions(params: PublicationReleaseListParams) {
  return queryOptions({
    queryKey: publicationKeys.list(params),
    queryFn: async () => {
      const search = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
      if (params.lifecycleState) search.set("lifecycleState", params.lifecycleState);
      const response = await fetch(`/api/admin/publication/releases?${search}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      return responseJson<PublicationReleasePage>(response, "Publication releases request failed");
    },
  });
}

export function publicationReleaseInspectionQueryOptions(releaseId: string) {
  return queryOptions({
    queryKey: publicationKeys.inspection(releaseId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/publication/releases/${encodeURIComponent(releaseId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      return responseJson<PublicationReleaseInspection>(response, "Publication release inspection failed");
    },
  });
}

export async function buildPublicationRelease(version: string) {
  const response = await fetch("/api/admin/publication/releases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ version }),
  });
  return responseJson<components["schemas"]["PublicReleaseDto"]>(response, "Publication release build failed");
}

export async function runPublicationAction(releaseId: string, action: PublicationAction, reason: string) {
  const response = await fetch(`/api/admin/publication/releases/${encodeURIComponent(releaseId)}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action, reason }),
  });
  return responseJson<components["schemas"]["PublicReleaseDto"]>(response, `Publication ${action} failed`);
}
