import "server-only";

import { cookies } from "next/headers";

export const PENDING_FOLLOW_COOKIE = "panda-atlas-pending-follow";
export const PENDING_FOLLOW_CONTINUATION_COOKIE = "panda-atlas-pending-follow-continuation";
const PENDING_FOLLOW_MAX_AGE = 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: PENDING_FOLLOW_MAX_AGE,
  };
}

export async function readPendingFollowHandle(): Promise<string | null> {
  return (await cookies()).get(PENDING_FOLLOW_COOKIE)?.value ?? null;
}

export async function readPendingFollowContinuation(): Promise<string | null> {
  return (await cookies()).get(PENDING_FOLLOW_CONTINUATION_COOKIE)?.value ?? null;
}

export async function setPendingFollowCookies(handle: string, continuation: string): Promise<void> {
  const store = await cookies();
  store.set(PENDING_FOLLOW_COOKIE, handle, cookieOptions());
  store.set(PENDING_FOLLOW_CONTINUATION_COOKIE, continuation, cookieOptions());
}

export async function setPendingFollowHandle(handle: string): Promise<void> {
  (await cookies()).set(PENDING_FOLLOW_COOKIE, handle, cookieOptions());
}

export async function clearPendingFollowCookies(): Promise<void> {
  const store = await cookies();
  store.set(PENDING_FOLLOW_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  store.set(PENDING_FOLLOW_CONTINUATION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}
