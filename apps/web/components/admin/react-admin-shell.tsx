"use client";

import { useEffect, useState } from "react";
import {
  Admin,
  type AuthProvider,
  CustomRoutes,
  type DataProvider,
  Layout,
  type LayoutProps,
  Menu,
  useLogout,
} from "react-admin";
import { BrowserRouter, Link, Route } from "react-router-dom";

import { AdminDashboardPage } from "@/components/admin/admin-dashboard-page";
import { AdminDomainCenterPage } from "@/components/admin/admin-domain-center-page";
import { AdminGuessQuestionBankPage } from "@/components/admin/admin-guess-question-bank-page";
import { AdminPandaCreatePage } from "@/components/admin/admin-panda-create-page";
import { AdminPandaDetailPage } from "@/components/admin/admin-panda-detail-page";
import { AdminPandaListPage } from "@/components/admin/admin-panda-list-page";
import { adminMenuSections } from "@/components/admin/admin-product-menu";
import { adminSessionFailureDestination } from "@/components/admin/admin-session-navigation";
import { ArchiveAdvancedOperations } from "@/components/admin/archive-advanced-operations";
import { ArchiveWorkbench } from "@/components/admin/archive-workbench";
import { AuditWorkbench } from "@/components/admin/audit-workbench";
import { ModerationWorkbench } from "@/components/admin/moderation-workbench";
import { PrivacyWorkbench } from "@/components/admin/privacy-workbench";
import { productAdminDomains } from "@/components/admin/product-operations-page";
import { ReviewCaseWorkbench } from "@/components/admin/review-case-workbench";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { adminTheme } from "@/styles/admin-theme";

const adminCenterDomains = [
  "locations",
  "relationships",
  "events",
  "images",
  "sources",
  "users",
] as const;

const productDomainLabels: Record<(typeof productAdminDomains)[number], string> = {
  pandas: "熊猫资料",
  locations: "地点与机构",
  relationships: "家族关系",
  events: "熊猫事件",
  images: "图片与媒体",
  sources: "来源与证据",
  games: "熊猫游戏",
  users: "用户与账号",
};

function AdminProductMenu() {
  return (
    <Menu>
      {adminMenuSections.flatMap((section, sectionIndex) => [
        <p
          key={`${section.label}-label`}
          className="px-4 pb-1 pt-5 text-xs font-bold uppercase tracking-[0.14em] text-stone-600"
        >
          {section.label}
        </p>,
        ...section.items.map((item) => (
          <Menu.Item key={item.to} to={item.to} primaryText={item.label} />
        )),
        sectionIndex === adminMenuSections.length - 1 ? null : null,
      ])}
    </Menu>
  );
}

function AdminProductLayout(props: LayoutProps) {
  return <Layout {...props} menu={AdminProductMenu} />;
}


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

          <section
            className="rounded-xl border border-stone-300 bg-white p-5 lg:col-span-2"
            aria-labelledby="product-operations-heading"
          >
            <h2 id="product-operations-heading" className="text-xl font-bold text-stone-950">
              V1 产品运营入口
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              按产品领域进入现有治理工作流。这里不创建第二套 CRUD；所有写操作继续由 Archive、Review、Moderation、Privacy 与 Audit 的显式权限边界执行。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {productAdminDomains.map((domain) => (
                <Link
                  key={domain}
                  to={`/${domain}`}
                  className="inline-flex min-h-11 items-center rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-950"
                >
                  {productDomainLabels[domain]}
                </Link>
              ))}
            </div>
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

          {session.capabilities.includes("audit.read") ? (
            <section
              className="rounded-xl border border-stone-300 bg-white p-5 lg:col-span-2"
              aria-labelledby="audit-workbench-heading"
            >
              <h2 id="audit-workbench-heading" className="text-xl font-bold text-stone-950">
                Unified Audit
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                搜索统一只读证据、检查完整性和指标，并按独立 Capability 生成加密导出或执行过期密文维护。通用 CRUD 始终禁用。
              </p>
              <Link
                to="/audit"
                className="mt-4 inline-flex min-h-11 items-center rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
              >
                打开 Audit 工作台
              </Link>
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

          {session.capabilities.includes("moderation.sanction.read") ||
          session.capabilities.includes("moderation.appeal.read") ? (
            <section
              className="rounded-xl border border-stone-300 bg-white p-5 lg:col-span-2"
              aria-labelledby="moderation-workbench-heading"
            >
              <h2
                id="moderation-workbench-heading"
                className="text-xl font-bold text-stone-950"
              >
                Scoped Moderation &amp; Appeals
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                处理显式 scope 的处分、24 小时 Reviewer freeze、append-only 恢复、申诉 SLA 与一致性告警。Administrator 和 Archive Editor 不会隐式获得这些权限。
              </p>
              <Link
                to="/moderation"
                className="mt-4 inline-flex min-h-11 items-center rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
              >
                打开账号处分工作台
              </Link>
            </section>
          ) : null}

          {session.capabilities.includes("privacy.operate") ? (
            <section
              className="rounded-xl border border-stone-300 bg-white p-5 lg:col-span-2"
              aria-labelledby="privacy-workbench-heading"
            >
              <h2 id="privacy-workbench-heading" className="text-xl font-bold text-stone-950">
                Privacy Operations
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                验证访问/删除请求，协调 Context、Hold、加密导出、不可逆删除、保留维护、恢复后 tombstone 重放和无身份指标告警。
              </p>
              <Link
                to="/privacy"
                className="mt-4 inline-flex min-h-11 items-center rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
              >
                打开隐私请求工作台
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
        layout={AdminProductLayout}
        loginPage={false}
        requireAuth
        theme={adminTheme}
      >
        <CustomRoutes>
          <Route path="/" element={<AdminDashboardPage />} />
          <Route path="pandas" element={<AdminPandaListPage />} />
          <Route path="pandas/new" element={<AdminPandaCreatePage />} />
          <Route path="pandas/:pandaId" element={<AdminPandaDetailPage />} />
          <Route path="capabilities" element={<CapabilityDashboard />} />
          {adminCenterDomains.map((domain) => (
            <Route key={domain} path={domain} element={<AdminDomainCenterPage domain={domain} />} />
          ))}
          <Route path="games" element={<AdminGuessQuestionBankPage />} />
          <Route path="archive" element={<ArchiveWorkbench />} />
          <Route path="archive/operations" element={<ArchiveAdvancedOperations />} />
          <Route path="audit" element={<AuditWorkbench />} />
          <Route path="audit-logs" element={<AuditWorkbench />} />
          <Route path="reviews" element={<ReviewCaseWorkbench />} />
          <Route path="moderation" element={<ModerationWorkbench />} />
          <Route path="privacy" element={<PrivacyWorkbench />} />
        </CustomRoutes>
      </Admin>
    </BrowserRouter>
  );
}
