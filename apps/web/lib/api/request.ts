// A failed request to the Web app's API routes, as Problem Details (RFC 9457) with the `code` the
// API and the forwarding module attach.
export class ApiRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = "ApiRequestError";
  }
}

export async function apiRequestError(response: Response): Promise<ApiRequestError> {
  const problem = (await response.json().catch(() => null)) as { code?: unknown; detail?: unknown; message?: unknown } | null;
  const code = typeof problem?.code === "string" ? problem.code : "";
  const detail = typeof problem?.detail === "string"
    ? problem.detail
    : typeof problem?.message === "string"
      ? problem.message
      : `Request failed (${response.status})`;
  return new ApiRequestError(response.status, code, detail);
}

// The one request helper of the Web app: same-origin, uncached, JSON in and out.
export async function requestJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...init.headers,
    },
  });
  if (!response.ok) throw await apiRequestError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
