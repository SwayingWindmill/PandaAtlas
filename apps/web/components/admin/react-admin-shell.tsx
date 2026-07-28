"use client";

import { useEffect, useState } from "react";
import {
  Admin,
  type AuthProvider,
  CustomRoutes,
  type DataProvider,
  useLogout,
} from "react-admin";
import { Route } from "react-router-dom";

import { adminSessionFailureDestination } from "@/components/admin/admin-session-navigation";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type AdminSession = {
  account_id: string;
  email: string;
  state: "active" | "suspended" | "deleting" | "deleted";
  roles: string[];
  capabilities: string[];
  recent_auth: boolean;
  authenticated_at: string | null;
  authentication_method: string | null;
  assurance_level: string;
  expires_at: string;
};

async function fetchAdminSession(): Promise<AdminSession> {
  const response = await fetch("/api/admin/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const error = new Error(`Admin session request failed with ${response.status}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as AdminSession;
}

function redirectToLogin() {
  window.location.assign("/auth/login?next=%2Fadmin");
}

function redirectForSessionError(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  const destination = adminSessionFailureDestination(status);
  if (!destination) {
    return false;
  }
  window.location.assign(destination);
  return true;
}

const authProvider: AuthProvider = {
  async login() {
    redirectToLogin();
  },
  async logout() {
    await getSupabaseBrowserClient().auth.signOut();
    window.location.assign("/auth/login?next=%2Fadmin");
  },
  async checkAuth() {
    try {
      await fetchAdminSession();
    } catch (error) {
      if (redirectForSessionError(error)) {
        return new Promise<never>(() => undefined);
      }
      throw error;
    }
  },
  async checkError(error) {
    if (redirectForSessionError(error)) {
      return new Promise<never>(() => undefined);
    }
  },
  async getPermissions() {
    return (await fetchAdminSession()).capabilities;
  },
  async getIdentity() {
    const session = await fetchAdminSession();
    return {
      id: session.account_id,
      fullName: session.email,
    };
  },
};

function unsupportedOperation(): Promise<never> {
  return Promise.reject(
    new Error("The bounded admin shell does not expose generic CRUD business writes."),
  );
}

const dataProvider: DataProvider = {
  getList: unsupportedOperation,
  getOne: unsupportedOperation,
  getMany: unsupportedOperation,
  getManyReference: unsupportedOperation,
  create: unsupportedOperation,
  update: unsupportedOperation,
  updateMany: unsupportedOperation,
  delete: unsupportedOperation,
  deleteMany: unsupportedOperation,
};

function CapabilityDashboard() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logout = useLogout();

  useEffect(() => {
    let cancelled = false;
    fetchAdminSession()
      .then((result) => {
        if (!cancelled) setSession(result);
      })
      .catch(() => {
        if (!cancelled) setError("无法读取当前工作人员权限。请重新登录。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">PandaAtlas Administration</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">工作人员控制台</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            此壳层只展示 FastAPI 在本次请求中重新计算的权限。浏览器不能直接写入业务表，后续操作必须使用领域专用命令。
          </p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={() => void logout()}>
          退出登录
        </Button>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">
          {error}
        </p>
      ) : null}

      {!session && !error ? (
        <p className="mt-6 text-sm text-stone-700" aria-busy="true">
          正在读取当前账号权限…
        </p>
      ) : null}

      {session ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="account-heading">
            <h2 id="account-heading" className="text-xl font-bold text-stone-950">
              当前账号
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="font-semibold text-stone-700">邮箱</dt>
                <dd className="mt-1 break-all text-stone-950">{session.email}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700">账号状态</dt>
                <dd className="mt-1 text-stone-950">{session.state}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700">最近认证</dt>
                <dd className="mt-1 text-stone-950">{session.recent_auth ? "15 分钟内" : "需要重新认证"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700">认证方式</dt>
                <dd className="mt-1 text-stone-950">{session.authentication_method ?? "未记录"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="roles-heading">
            <h2 id="roles-heading" className="text-xl font-bold text-stone-950">
              显式角色
            </h2>
            <ul className="mt-4 grid gap-2 text-sm text-stone-950">
              {session.roles.map((role) => (
                <li key={role} className="rounded-md border border-stone-300 bg-stone-50 px-3 py-2">
                  {role}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-stone-300 bg-white p-5 lg:col-span-2" aria-labelledby="capabilities-heading">
            <h2 id="capabilities-heading" className="text-xl font-bold text-stone-950">
              当前 Capability
            </h2>
            <ul className="mt-4 grid gap-2 text-sm text-stone-950 sm:grid-cols-2">
              {session.capabilities.map((capability) => (
                <li key={capability} className="rounded-md border border-stone-300 bg-stone-50 px-3 py-2 font-mono">
                  {capability}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </main>
  );
}

const adminTheme = {
  palette: {
    mode: "light" as const,
    primary: { main: "#1c1917", contrastText: "#ffffff" },
    secondary: { main: "#14532d", contrastText: "#ffffff" },
    background: { default: "#f5f5f4", paper: "#ffffff" },
    text: { primary: "#0c0a09", secondary: "#44403c" },
    error: { main: "#991b1b", contrastText: "#ffffff" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44, fontWeight: 700 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: "#1c1917", color: "#ffffff" },
      },
    },
  },
};

export function ReactAdminShell() {
  return (
    <Admin
      authProvider={authProvider}
      dataProvider={dataProvider}
      disableTelemetry
      loginPage={false}
      requireAuth
      theme={adminTheme}
    >
      <CustomRoutes>
        <Route path="/" element={<CapabilityDashboard />} />
      </CustomRoutes>
    </Admin>
  );
}
