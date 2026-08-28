import type {
  V2ContributionInput,
  V2ContributionList,
  V2ContributionRecord,
} from "./types";

interface ApiResult<T> {
  data: T;
  etag: string | null;
}

export class ContributionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Keep a stable fallback for transport failures without a JSON body.
  }
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : "Contribution request failed";
    throw new ContributionApiError(detail, response.status);
  }
  return { data: body as T, etag: response.headers.get("etag") };
}

export async function submitContribution(body: V2ContributionInput): Promise<ApiResult<V2ContributionRecord>> {
  return parseResponse<V2ContributionRecord>(
    await fetch("/api/community-intake/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function listSubmissions(): Promise<ApiResult<V2ContributionList>> {
  return parseResponse<V2ContributionList>(
    await fetch("/api/community-intake/submissions", { cache: "no-store" }),
  );
}

export async function getSubmission(submissionId: string): Promise<ApiResult<V2ContributionRecord>> {
  return parseResponse<V2ContributionRecord>(
    await fetch(`/api/community-intake/submissions/${encodeURIComponent(submissionId)}`, {
      cache: "no-store",
    }),
  );
}
