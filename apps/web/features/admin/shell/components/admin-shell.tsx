"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleUserRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  adminSessionQueryOptions,
  AdminSessionRequestError,
} from "@/features/admin/session/api/queries";
import {
  adminNavigationItemForPath,
  canAccessAdminNavigationItem,
} from "@/features/admin/shell/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AppSidebar } from "./app-sidebar";
import { AdminCommandMenu } from "./admin-command-menu";
import type { AdminSession } from "@/features/admin/session/api/types";

function AdminShellState({ children, tone }: { children: React.ReactNode; tone: "loading" | "error" | "warning" }) {
  const toneClass = tone === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-slate-200 bg-white text-slate-700";
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8" aria-busy={tone === "loading" ? true : undefined}>
      <p className={`rounded-xl border p-5 text-sm ${toneClass}`} role={tone === "error" ? "alert" : undefined}>{children}</p>
    </div>
  );
}

function AdminHeader({ pathname, session }: { pathname: string; session: AdminSession }) {
  const item = adminNavigationItemForPath(pathname);
  const parent = pathname === "/admin/staff/invitations"
    ? { href: "/admin/staff/roles", label: "人员管理" }
    : pathname === "/admin/security/mfa"
      ? { href: "/admin/capabilities", label: "我的账号" }
      : null;
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-md md:px-7">
      <div className="flex min-w-0 items-center gap-4">
        <SidebarTrigger aria-label="切换侧边栏" title="切换侧边栏（Ctrl+B）" className="hidden size-9 rounded-lg text-slate-500 hover:bg-slate-100 md:inline-flex" />
        <SidebarTrigger aria-label="展开导航" className="size-9 rounded-lg text-slate-600 md:hidden" />
        <Separator orientation="vertical" className="hidden h-5 bg-slate-200 md:block" />
        <Breadcrumb aria-label="当前位置">
          <BreadcrumbList className="flex-nowrap gap-2 text-[13px]">
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/admin">数据运营</Link></BreadcrumbLink>
            </BreadcrumbItem>
            {parent && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink asChild><Link href={parent.href as Route}>{parent.label}</Link></BreadcrumbLink></BreadcrumbItem>
              </>
            )}
            {item?.href !== "/admin" && item && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem><span aria-current="page" className="max-w-36 truncate font-semibold text-slate-900">{item.label}</span></BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-3">
        <AdminCommandMenu session={session} />
        <Separator orientation="vertical" className="hidden h-5 bg-slate-200 md:block" />
        <Button asChild variant="ghost" size="icon" title="我的账号" className="rounded-full text-slate-500 hover:text-emerald-800">
          <Link href="/admin/capabilities" aria-label="我的账号"><CircleUserRound size={21} aria-hidden="true" /></Link>
        </Button>
      </div>
    </header>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sessionQuery = useQuery(adminSessionQueryOptions);
  const sessionError = sessionQuery.error instanceof AdminSessionRequestError ? sessionQuery.error : null;
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const stored = document.cookie.split("; ").find((entry) => entry.startsWith("sidebar_state="));
    // Restore the registry sidebar's persisted state once browser cookies are available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setSidebarOpen(stored.split("=")[1] !== "false");
  }, []);

  useEffect(() => {
    if (sessionError?.status === 401) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}` as Route);
    }
  }, [pathname, router, sessionError]);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/auth/login?next=%2Fadmin" as Route);
  }

  if (sessionQuery.isPending || sessionError?.status === 401) {
    return <AdminShellState tone="loading">正在确认后台访问权限…</AdminShellState>;
  }
  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <AdminShellState tone="error">
        {sessionError?.status === 403
          ? "当前账号没有后台访问权限。"
          : (
            <>
              无法获取当前工作人员会话。
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-3 border-rose-300 bg-white text-rose-900 hover:bg-rose-100"
                onClick={() => void sessionQuery.refetch()}
              >
                重新尝试
              </Button>
            </>
          )}
      </AdminShellState>
    );
  }

  const session = sessionQuery.data;
  const requestedItem = adminNavigationItemForPath(pathname);
  const accessDenied = requestedItem ? !canAccessAdminNavigationItem(session, requestedItem) : false;

  return (
    <SidebarProvider className="pa-admin-shell" open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar session={session} onSignOut={() => void signOut()} />
      <SidebarInset className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-[#f8fafc] shadow-[0_2px_20px_rgb(20_48_43_/_0.03)] md:my-2 md:mr-2">
        <AdminHeader pathname={pathname} session={session} />
        {accessDenied ? (
          <AdminShellState tone="warning">当前账号没有访问此工作区所需的权限。</AdminShellState>
        ) : (
          <div className="min-w-0 flex-1 pb-10">{children}</div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
