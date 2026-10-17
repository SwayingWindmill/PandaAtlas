import { useQuery } from "@tanstack/react-query";

import { ApiRequestError } from "@/lib/api/request";

import { fanSessionQueryOptions } from "./queries";
import type { FanSession } from "./types";

export type FanSessionStatus = "loading" | "ready" | "signed-out" | "blocked" | "unavailable";

export function signInHref(returnPath: string): string {
  return `/auth/login?next=${encodeURIComponent(returnPath)}`;
}

// The one place a fan surface sends the visitor to sign in and back to where they were.
export function beginSignIn(returnPath: string): void {
  window.location.assign(signInHref(returnPath));
}

// Whether a session is a signed-out visitor, a blocked account or an outage, read from the status
// of /api/identity/session; private queries run only once it is ready.
export function fanSessionStatus(error: unknown): Exclude<FanSessionStatus, "loading" | "ready"> {
  if (error instanceof ApiRequestError && error.status === 401) return "signed-out";
  if (error instanceof ApiRequestError && error.status === 403) return "blocked";
  return "unavailable";
}

export function useFanSession(enabled = true): { status: FanSessionStatus; session: FanSession | undefined; refetch: () => void } {
  const query = useQuery({ ...fanSessionQueryOptions, enabled });
  const status: FanSessionStatus = query.isSuccess ? "ready" : query.isError ? fanSessionStatus(query.error) : "loading";
  return { status, session: query.data, refetch: () => void query.refetch() };
}
