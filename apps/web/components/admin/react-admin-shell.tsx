"use client";

import { useEffect, useState } from "react";
import {
  Admin,
  type AuthProvider,
  CustomRoutes,
  type DataProvider,
  useLogout,
} from "react-admin";
import { BrowserRouter, Link, Route } from "react-router-dom";

import { adminSessionFailureDestination } from "@/components/admin/admin-session-navigation";
import { ArchiveAdvancedOperations } from "@/components/admin/archive-advanced-operations";
import { ArchiveWorkbench } from "@/components/admin/archive-workbench";
import { ReviewCaseWorkbench } from "@/components/admin/review-case-workbench";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { adminTheme } from "@/styles/admin-theme";

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

  const canUseSeniorArchiveOperations =
    session?.capabilities.includes("archive.sensitive.merge_split") ||
    session?.capabilities.includes("archive.sensitive.takedown");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">ZhiPanda Administration</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">工作人员控制台</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            这里显示 ZhiPanda 为当前工作人员账号核对后的权限。浏览器不能直接写入业务数据，所有操作仍需通过对应的工作人员工具完成。
          </p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={() => void logout()}>
          退出登录
        </Button>
      </div>

      {error ? (
        <p
          className="mt-6 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950"
          role="alert"
        >
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
          <section
            className="rounded-xl border border-stone-300 bg-white p-5"
            aria-labelledby="account-heading"
          >
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
                <dd className="mt-1 text-stone-950">
                  {session.recent_auth ? "15 分钟内" : "需要重新认证"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700">认证方式</dt>
                <dd className="mt-1 text-stone-950">
                  {session.authentication_method ?? "未记录"}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="rounded-xl border border-stone-300 bg-white p-5"
            aria-labelledby="roles-heading"
          >
            <h2 id="roles-heading" className="text-xl font-bold text-stone-950">
              显式角色
            </h2>
            <ul className="mt-4 grid gap-2 text-sm text-stone-950">
              {session.roles.map((role) => (
                <li
                  key={role}
                  className="rounded-md border border-stone-300 bg-stone-50 px-3 py-2"
                >
                  {role}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-xl border border-stone-300 bg-white p-5 lg:col-span-2"
            aria-labelledby="capabilities-heading"
          >
            <h2 id="capabilities-heading" className="text-xl font-bold text-stone-950">
              当前 Capability
            </h2>
            <ul className="mt-4 grid gap-2 text-sm text-stone-950 sm:grid-cols-2">
              {session.capabilities.map((capability) => (
                <li
                  key={capability}
                  className="rounded-md border border-stone-300 bg-stone-50 px-3 py-2 font-mono"
                >
                  {capability}
                </li>
              ))}
            </ul>
          </section>

          {session.capabilities.includes("archive.workbench.read") ? (
            <section
              className="rounded-xl border border-stone-300 bg-white p-5 lg:col-span-2"
              aria-labelledby="archive-workbench-heading"
            >
              <h2 id="archive-workbench-heading" className="text-xl font-bold text-stone-950">
                Trusted Archive
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                检查完整 Diff、来源、验证、媒体权利、公开影响、投影滞后与紧急跟进，并通过显式 FastAPI 命令验证、发布、修正、回滚或控制 cutover。
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/archive"
                  className="inline-flex min-h-11 items-center rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                >
                  打开 Archive 工作台
                </Link>
                {canUseSeniorArchiveOperations ? (
                  <Link
                    to="/archive/operations"
                    className="inline-flex min-h-11 items-center rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-950"
                  >
                    打开高级操作工作台
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {session.capabilities.includes("review.case.read") ? (
            <section
              className="rounded-xl border border-stone-300 bg-white p-5 lg:col-span-2"
              aria-labelledby="review-workbench-heading"
            >
              <h2 id="review-workbench-heading" className="text-xl font-bold text-stone-950">
                Review &amp; Moderation
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                使用领域专用命令处理 ReviewCase、来源验证、补充请求、追加决定和 Curation 推荐。通用 React-admin CRUD 仍保持禁用。
              </p>
              <Link
                to="/reviews"
                className="mt-4 inline-flex min-h-11 items-center rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
              >
                打开贡献审核工作台
              </Link>
            </section>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

export function ReactAdminShell() {
  return (
    <BrowserRouter basename="/admin">
      <Admin
        basename="/admin"
        authProvider={authProvider}
        dataProvider={dataProvider}
        disableTelemetry
        loginPage={false}
        requireAuth
        theme={adminTheme}
      >
        <CustomRoutes>
          <Route path="/" element={<CapabilityDashboard />} />
          <Route path="archive" element={<ArchiveWorkbench />} />
          <Route path="archive/operations" element={<ArchiveAdvancedOperations />} />
          <Route path="reviews" element={<ReviewCaseWorkbench />} />
        </CustomRoutes>
      </Admin>
    </BrowserRouter>
  );
}
