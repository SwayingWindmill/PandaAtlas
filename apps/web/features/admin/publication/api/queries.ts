import type { components } from "@zhipanda/api-client";
import { queryOptions } from "@tanstack/react-query";

import { ApiRequestError, requestJson } from "@/lib/api/request";

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

const authenticationMessages: Record<string, string> = {
  "auth.recentAuthRequired": "此敏感操作的近期身份验证已过期，请重新登录并验证后重试。",
  "auth.aalRequired": "此敏感操作需要完成双重验证，请先前往账号安全页面。",
  "auth.liveSessionRequired": "当前登录会话已失效，请重新登录后重试。",
};

export const publicationKeys = {
  all: ["admin", "publication"] as const,
  releases: () => [...publicationKeys.all, "releases"] as const,
  list: (params: PublicationReleaseListParams) => [...publicationKeys.releases(), params] as const,
  inspection: (releaseId: string) => [...publicationKeys.all, "inspection", releaseId] as const,
};

// A refused sensitive operation names the authentication step the operator has to repeat.
async function publicationRequest<T>(input: string, init?: RequestInit): Promise<T> {
  try {
    return await requestJson<T>(input, init);
  } catch (error) {
    const message = error instanceof ApiRequestError ? authenticationMessages[error.code] : undefined;
    if (message && error instanceof ApiRequestError) throw new PublicationAuthenticationError(error.code, message);
    throw error;
  }
}

export function publicationReleaseListQueryOptions(params: PublicationReleaseListParams) {
  return queryOptions({
    queryKey: publicationKeys.list(params),
    queryFn: () => {
      const search = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
      if (params.lifecycleState) search.set("lifecycleState", params.lifecycleState);
      return publicationRequest<PublicationReleasePage>(`/api/admin/publication/releases?${search}`);
    },
  });
}

export function publicationReleaseInspectionQueryOptions(releaseId: string, changeOffset = 0) {
  return queryOptions({
    queryKey: [...publicationKeys.inspection(releaseId), changeOffset],
    queryFn: () => {
      const search = changeOffset > 0 ? `?changeOffset=${changeOffset}&changeLimit=10` : "";
      return publicationRequest<PublicationReleaseInspection>(
        `/api/admin/publication/releases/${encodeURIComponent(releaseId)}${search}`,
      );
    },
  });
}

export function buildPublicationRelease(version: string) {
  return publicationRequest<components["schemas"]["PublicReleaseDto"]>("/api/admin/publication/releases", {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

export function runPublicationAction(releaseId: string, action: PublicationAction, reason: string) {
  return publicationRequest<components["schemas"]["PublicReleaseDto"]>(
    `/api/admin/publication/releases/${encodeURIComponent(releaseId)}/actions`,
    { method: "POST", body: JSON.stringify({ action, reason }) },
  );
}
