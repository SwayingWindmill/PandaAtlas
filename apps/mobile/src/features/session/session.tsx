import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { syncGuestToAccount } from "@/features/engagement/guest-sync";
import {
  type AuthProvider,
  authenticateWithApple,
  resolveAuthProvider,
  storeAppleRevocationToken,
} from "@/features/session/apple-auth";
import { authedApi } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

// One place owns sign-in for the whole app. Screens read the state and call these actions; tokens stay in
// the Supabase client and the authenticated API client.

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; email: string | null; accountId: string; authProvider: AuthProvider }
  | { status: "unavailable"; email: string | null };

interface SessionValue {
  state: SessionState;
  /** Sends a six-digit code; creates the Supabase user on first use. */
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signInWithApple(): Promise<"signedIn" | "cancelled">;
  reauthenticateWithApple(): Promise<"verified" | "cancelled">;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export class SignInError extends Error {
  /** Supabase refused the code: wrong or expired, which only the code's age can tell apart. */
  public constructor(message: string, public readonly codeRejected = false) {
    super(message);
  }
}

function signInMessage(error: { status?: number; code?: string; message: string }): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "请求太频繁，请稍后再试。";
  }
  if (error.code === "validation_failed" || error.code === "email_address_invalid") return "邮箱格式不对。";
  return "没能完成，请稍后再试。";
}

/** The application account behind a Supabase user; created on first sign-in. */
async function provision(session: Session): Promise<SessionState> {
  const email = session.user.email ?? null;
  const authProvider = resolveAuthProvider(session.user);
  // Repeating it is harmless: the API returns the existing account. A suspended account answers 403.
  const { data } = await authedApi.POST("/api/v2/me/account");
  if (!data) return { status: "unavailable", email };
  await syncGuestToAccount(data.accountId).catch(() => undefined);
  return { status: "signedIn", email, accountId: data.accountId, authProvider };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const activeProvisionRef = useRef<{ userId: string; task: Promise<SessionState> } | null>(null);

  const ensureProvisioned = useCallback((session: Session): Promise<SessionState> => {
    const userId = session.user.id;
    if (activeProvisionRef.current?.userId === userId) {
      return activeProvisionRef.current.task;
    }
    const task = provision(session).catch<SessionState>(() => ({
      status: "unavailable",
      email: session.user.email ?? null,
    }));
    activeProvisionRef.current = { userId, task };
    return task;
  }, []);

  useEffect(() => {
    // undefined until the stored session is read, so a first "no session" still settles the state.
    let current: string | null | undefined;
    const apply = (session: Session | null) => {
      const userId = session?.user.id ?? null;
      if (userId === current) return;
      if (current !== undefined) queryClient.removeQueries({ queryKey: ["private"] });
      current = userId;
      if (!session || userId === null) {
        activeProvisionRef.current = null;
        setState({ status: "signedOut" });
        return;
      }
      setState({ status: "loading" });
      void ensureProvisioned(session).then((next) => {
        if (current === userId) setState(next);
      });
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, [ensureProvisioned]);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      async requestCode(email) {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) throw new SignInError(signInMessage(error));
      },
      async verifyCode(email, code) {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
        if (!error) return;
        if (error.code === "otp_expired") throw new SignInError("验证码不对或已过期，请检查或重新获取。", true);
        throw new SignInError(signInMessage(error));
      },
      async signInWithApple() {
        const result = await authenticateWithApple();
        if (result.status === "cancelled") return "cancelled";
        const { data } = await supabase.auth.getSession();
        const settled = data.session ? await ensureProvisioned(data.session) : undefined;
        if (settled?.status === "signedIn") {
          await storeAppleRevocationToken(result.authorizationCode);
        }
        return "signedIn";
      },
      async reauthenticateWithApple() {
        const result = await authenticateWithApple();
        if (result.status === "cancelled") return "cancelled";
        await storeAppleRevocationToken(result.authorizationCode);
        return "verified";
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [state, ensureProvisioned],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession needs a SessionProvider");
  return value;
}
