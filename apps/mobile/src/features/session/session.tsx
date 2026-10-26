import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { authedApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";

// One place owns sign-in for the whole app. Screens read the state and call these actions; tokens stay in
// the Supabase client and the authenticated API client.

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; email: string | null; accountId: string }
  | { status: "unavailable"; email: string | null };

interface SessionValue {
  state: SessionState;
  /** Sends a six-digit code; creates the Supabase user on first use. */
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export class SignInError extends Error {}

function signInMessage(error: { status?: number; code?: string; message: string }): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") return "发送太频繁了，请稍后再试。";
  if (error.code === "validation_failed" || error.code === "email_address_invalid") return "邮箱格式不对。";
  return "没能完成，请稍后再试。";
}

/** The application account behind a Supabase user; created on first sign-in. */
async function provision(session: Session): Promise<SessionState> {
  const email = session.user.email ?? null;
  // Repeating it is harmless: the API returns the existing account. A suspended account answers 403.
  const { data } = await authedApi.POST("/api/v2/me/account");
  if (!data) return { status: "unavailable", email };
  return { status: "signedIn", email, accountId: data.accountId };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    // undefined until the stored session is read, so a first "no session" still settles the state.
    let current: string | null | undefined;
    const apply = (session: Session | null) => {
      const userId = session?.user.id ?? null;
      if (userId === current) return;
      current = userId;
      if (!session) {
        setState({ status: "signedOut" });
        return;
      }
      provision(session)
        .then((next) => {
          if (current === userId) setState(next);
        })
        .catch(() => {
          if (current === userId) setState({ status: "unavailable", email: session.user.email ?? null });
        });
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      async requestCode(email) {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) throw new SignInError(signInMessage(error));
      },
      async verifyCode(email, code) {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
        // Supabase answers otp_expired for a wrong code too, so the message covers both.
        if (error) throw new SignInError(error.code === "otp_expired" ? "验证码不对或已过期，请检查或重新获取。" : signInMessage(error));
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [state],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession needs a SessionProvider");
  return value;
}
