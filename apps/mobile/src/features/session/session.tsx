import type { Session } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { syncGuestToAccount } from "@/features/engagement/guest-sync";
import { unregisterStoredPushDevice } from "@/features/notifications/push";
import {
  clearCachedAccountId,
  readCachedAccountId,
  writeCachedAccountId,
} from "@/features/session/account-cache";
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

function sameSessionState(left: SessionState, right: SessionState): boolean {
  if (left.status !== right.status) return false;
  if (left.status === "signedIn" && right.status === "signedIn") {
    return left.accountId === right.accountId && left.email === right.email && left.authProvider === right.authProvider;
  }
  if (left.status === "unavailable" && right.status === "unavailable") {
    return left.email === right.email;
  }
  return true;
}

interface ProvisionResult {
  state: SessionState;
  confirmedOnline: boolean;
}

/** The application account behind a Supabase user; created on first sign-in with cached offline continuity. */
async function provision(session: Session): Promise<ProvisionResult> {
  const email = session.user.email ?? null;
  const authProvider = resolveAuthProvider(session.user);

  const offlineFallback = async (): Promise<ProvisionResult> => {
    const cachedAccountId = await readCachedAccountId(session.user.id);
    if (cachedAccountId) {
      return {
        state: { status: "signedIn", email, accountId: cachedAccountId, authProvider },
        confirmedOnline: false,
      };
    }
    return { state: { status: "unavailable", email }, confirmedOnline: false };
  };

  try {
    // Repeating it is harmless: the API returns the existing account. A suspended or revoked account answers 401/403.
    const { data, response } = await authedApi.POST("/api/v2/me/account");
    if (data) {
      await writeCachedAccountId(session.user.id, data.accountId);
      await syncGuestToAccount(data.accountId).catch(() => undefined);
      return {
        state: { status: "signedIn", email, accountId: data.accountId, authProvider },
        confirmedOnline: true,
      };
    }
    if (response.status === 401 || response.status === 403) {
      await clearCachedAccountId();
      return { state: { status: "unavailable", email }, confirmedOnline: true };
    }
    return await offlineFallback();
  } catch {
    return await offlineFallback();
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const activeProvisionRef = useRef<{ userId: string; task: Promise<SessionState> } | null>(null);
  const currentUserIdRef = useRef<string | null | undefined>(undefined);
  const unconfirmedSessionRef = useRef<Session | null>(null);

  const ensureProvisioned = useCallback((session: Session, options?: { force?: boolean }): Promise<SessionState> => {
    const userId = session.user.id;
    if (!options?.force && activeProvisionRef.current?.userId === userId) {
      return activeProvisionRef.current.task;
    }
    const entry: { userId: string; task: Promise<SessionState> } = {
      userId,
      task: Promise.resolve({ status: "loading" }),
    };
    entry.task = provision(session)
      .then((result) => {
        if (currentUserIdRef.current === userId) {
          unconfirmedSessionRef.current = result.confirmedOnline ? null : session;
        }
        if (!result.confirmedOnline && activeProvisionRef.current === entry) {
          activeProvisionRef.current = null;
        }
        return result.state;
      })
      .catch<SessionState>(() => {
        if (currentUserIdRef.current === userId) {
          unconfirmedSessionRef.current = session;
        }
        if (activeProvisionRef.current === entry) {
          activeProvisionRef.current = null;
        }
        return {
          status: "unavailable",
          email: session.user.email ?? null,
        };
      });
    activeProvisionRef.current = entry;
    return entry.task;
  }, []);

  useEffect(() => {
    // undefined until the stored session is read, so a first "no session" still settles the state.
    const apply = (session: Session | null) => {
      const userId = session?.user.id ?? null;
      if (userId === currentUserIdRef.current) return;
      if (currentUserIdRef.current !== undefined) queryClient.removeQueries({ queryKey: ["private"] });
      currentUserIdRef.current = userId;
      if (!session || userId === null) {
        activeProvisionRef.current = null;
        unconfirmedSessionRef.current = null;
        void clearCachedAccountId();
        setState({ status: "signedOut" });
        return;
      }
      unconfirmedSessionRef.current = session;
      setState({ status: "loading" });
      void ensureProvisioned(session).then((next) => {
        if (currentUserIdRef.current === userId) setState(next);
      });
    };

    const retryUnconfirmedProvision = () => {
      const pending = unconfirmedSessionRef.current;
      if (!pending || pending.user.id !== currentUserIdRef.current) return;
      void ensureProvisioned(pending, { force: true }).then((next) => {
        if (currentUserIdRef.current === pending.user.id) {
          setState((prev) => (sameSessionState(prev, next) ? prev : next));
        }
      });
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    const unsubscribeOnline = onlineManager.subscribe((isOnline) => {
      if (isOnline) retryUnconfirmedProvision();
    });
    const networkSub =
      Platform.OS !== "web" || typeof window !== "undefined"
        ? Network.addNetworkStateListener((network) => {
            if (network.isConnected !== false && network.isInternetReachable !== false) {
              retryUnconfirmedProvision();
            }
          })
        : null;

    return () => {
      data.subscription.unsubscribe();
      unsubscribeOnline();
      networkSub?.remove();
    };
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
        const settled = data.session ? await ensureProvisioned(data.session, { force: true }) : undefined;
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
        await unregisterStoredPushDevice();
        activeProvisionRef.current = null;
        unconfirmedSessionRef.current = null;
        await clearCachedAccountId();
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
