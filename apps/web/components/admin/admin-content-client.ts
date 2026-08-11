export async function adminContentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/content/${path.replace(/^\//, "")}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { detail?: string | { code?: string; message?: string } }
    | T
    | null;
  if (response.ok) return body as T;
  const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
  if (typeof detail === "string") throw new Error(detail);
  if (detail && typeof detail === "object") {
    throw new Error(detail.message ?? detail.code ?? `Admin content returned ${response.status}`);
  }
  throw new Error(`Admin content returned ${response.status}`);
}
