import type { components } from "@zhipanda/api-client";

// Data export and account deletion: asynchronous requests the API processes on its scheduled cycle. A fan sees
// the latest request of each kind. Pure rules here, calls in requests.ts.

export type PrivacyRequest = components["schemas"]["PrivacyRequestDto"];
export type PrivacyKind = PrivacyRequest["kind"];

export const DEFAULT_REASON: Record<PrivacyKind, string> = {
  access_export: "在 App 中申请导出我的数据。",
  account_deletion: "在 App 中申请注销账号。",
};

/** The API lists requests newest first. */
export function latestRequest(requests: PrivacyRequest[], kind: PrivacyKind): PrivacyRequest | null {
  return requests.find((request) => request.kind === kind) ?? null;
}

/** A new request can start when there is none in flight; a finished export can be requested again. */
export function canRequest(request: PrivacyRequest | null): boolean {
  if (!request) return true;
  if (request.state === "failed") return true;
  return request.kind === "access_export" && request.state === "completed";
}

export function requestStatus(request: PrivacyRequest): string {
  switch (request.state) {
    case "pending":
      return "已提交，等待处理";
    case "processing":
      return "正在处理";
    case "completed":
      return request.kind === "access_export" ? "已准备好" : "已完成";
    case "failed":
      return "没能完成，可以重新申请";
  }
}

/** The reason the fan wrote, or the default; the API needs at least three characters. */
export function requestReason(kind: PrivacyKind, written: string): string {
  const reason = written.trim();
  return reason.length >= 3 ? reason : DEFAULT_REASON[kind];
}

export function exportFileName(createdAt: string): string {
  return `zhipanda-export-${createdAt.slice(0, 10)}.json`;
}
