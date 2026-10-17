import { requestJson } from "@/lib/api/request";

import type {
  OpenReviewCaseInput,
  ReviewCase,
  ReviewCasePage,
  ReviewCaseSurface,
  ReviewDecisionInput,
  ReviewQueueQuery,
  VerifyReviewSourceInput,
} from "./types";

export function listReviewCases(query: ReviewQueueQuery): Promise<ReviewCasePage> {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) });
  if (query.state) params.set("state", query.state);
  return requestJson(`/api/admin/review/cases?${params.toString()}`);
}

export function getReviewCaseSurface(reviewCaseId: string): Promise<ReviewCaseSurface> {
  return requestJson(`/api/admin/review/cases/${reviewCaseId}/surface`);
}

export function openReviewCase(input: OpenReviewCaseInput): Promise<ReviewCase> {
  return requestJson("/api/admin/review/cases", { method: "POST", body: JSON.stringify(input) });
}

export function claimReviewCase(reviewCaseId: string): Promise<ReviewCase> {
  return requestJson(`/api/admin/review/cases/${reviewCaseId}/claim`, { method: "POST", body: "{}" });
}

export function verifyReviewSource(reviewCaseId: string, input: VerifyReviewSourceInput): Promise<{ verified: true }> {
  return requestJson(`/api/admin/review/cases/${reviewCaseId}/source-verifications`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function decideReviewCase(reviewCaseId: string, input: ReviewDecisionInput): Promise<{ decided: true }> {
  return requestJson(`/api/admin/review/cases/${reviewCaseId}/decision`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
