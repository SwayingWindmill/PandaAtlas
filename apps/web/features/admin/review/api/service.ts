import type {
  OpenReviewCaseInput,
  QueueQuery,
  ReviewCase,
  ReviewCasePage,
  ReviewCaseSurface,
  ReviewDecisionInput,
  ReviewState,
  VerifyReviewSourceInput,
} from "./types";

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    throw new Error(problem?.detail ?? problem?.message ?? `Admin request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function queueSearch<TState extends string>(query: QueueQuery<TState>): string {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) });
  if (query.state) params.set("state", query.state);
  return params.toString();
}

export function listReviewCases(query: QueueQuery<ReviewState>): Promise<ReviewCasePage> {
  return requestJson(`/api/admin/review/cases?${queueSearch(query)}`);
}

export function getReviewCaseSurface(reviewCaseId: string): Promise<ReviewCaseSurface> {
  return requestJson(`/api/admin/review/cases/${reviewCaseId}/surface`);
}

export function openReviewCase(input: OpenReviewCaseInput): Promise<ReviewCase> {
  return requestJson("/api/admin/review/cases", { method: "POST", body: JSON.stringify(input) });
}

export function claimReviewCase(reviewCaseId: string): Promise<ReviewCase> {
  return requestJson(`/api/admin/review/cases/${reviewCaseId}/claim`, { method: "POST" });
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
