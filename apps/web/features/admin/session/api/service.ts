import type { AdminSession } from "./types";

export class AdminSessionRequestError extends Error {
  constructor(readonly status: number) {
    super(`Admin session request failed with ${status}`);
  }
}

export async function getAdminSession(): Promise<AdminSession> {
  const response = await fetch("/api/admin/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new AdminSessionRequestError(response.status);
  return response.json() as Promise<AdminSession>;
}
