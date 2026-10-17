import { useQuery } from "@tanstack/react-query";

import { ApiRequestError } from "@/lib/api/request";

import { fanSessionQueryOptions } from "./queries";
import type { FanSession } from "./types";

export type PrivateReadStatus = "loading" | "ready" | "signed-out" | "blocked" | "unavailable";

interface PrivateRead {
  data: unknown;
  error: unknown;
  isError: boolean;
  isFetching: boolean;
}

export function signInHref(returnPath: string): string {
  return `/auth/login?next=${encodeURIComponent(returnPath)}`;
}

export function signInRequired(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

// The one place a fan surface sends the visitor to sign in and back to where they were.
export function beginSignIn(returnPath: string): void {
  window.location.assign(signInHref(returnPath));
}

// Returns whether the error was a missing session, so the caller shows no failure of its own.
export function redirectedToSignIn(error: unknown, returnPath: string): boolean {
  if (!signInRequired(error)) return false;
  beginSignIn(returnPath);
  return true;
}

function readFailure(error: unknown): Exclude<PrivateReadStatus, "loading" | "ready"> {
  if (signInRequired(error)) return "signed-out";
  if (error instanceof ApiRequestError && error.status === 403) return "blocked";
  return "unavailable";
}

// Data already shown stays shown when a background refetch fails; a retry shows as loading.
function readStatus(...reads: PrivateRead[]): PrivateReadStatus {
  const failed = reads.find((read) => read.data === undefined && read.isError && !read.isFetching);
  if (failed) return readFailure(failed.error);
  return reads.every((read) => read.data !== undefined) ? "ready" : "loading";
}

export function useFanSession(enabled = true): { status: PrivateReadStatus; session: FanSession | undefined; refetch: () => void } {
  const query = useQuery({ ...fanSessionQueryOptions, enabled });
  return { status: readStatus(query), session: query.data, refetch: () => void query.refetch() };
}

// The status of private reads that run once the session is ready.
export function privateReadStatus(session: PrivateReadStatus, ...reads: PrivateRead[]): PrivateReadStatus {
  return session === "ready" ? readStatus(...reads) : session;
}
