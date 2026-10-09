"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Menu, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
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

function AdminHeader({ pathname }: { pathname: string }) {
  const { setMobileOpen } = useSidebar();
  const item = adminNavigationItemForPath(pathname);
  const parent = pathname === "/admin/staff/invitations"
    ? { href: "/admin/staff/roles", label: "人员管理" }
    : pathname === "/admin/security/mfa"
      ? { href: "/admin/capabilities", label: "我的账号" }
      : null;
  return (
    <header className="sticky top-0 z-20 flex min-h-[4.5rem] items-center justify-between gap-4 border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-md md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 md:hidden"
          aria-label="展开导航"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} />
        </button>
        <SidebarTrigger className="hidden md:inline-flex" />
        <span className="hidden h-5 w-px bg-slate-200 md:block" />
        <nav aria-label="当前位置" className="flex min-w-0 items-center gap-2 text-sm">
          <Link href="/admin" className="shrink-0 text-slate-500 hover:text-teal-800">数据运营</Link>
          {parent && <><ChevronRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" /><Link href={parent.href as Route} className="shrink-0 text-slate-600 hover:text-teal-800">{parent.label}</Link></>}
          {item?.href !== "/admin" && item ? (
            <>
              <ChevronRight size={15} className="shrink-0 text-slate-400" />
              <span className="truncate font-semibold text-slate-900">{item.label}</span>
            </>
          ) : null}
        </nav>
      </div>
      <Link href="/admin/capabilities" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:inline-flex">
        <ShieldCheck size={16} aria-hidden="true" />我的账号
      </Link>
    </header>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sessionQuery = useQuery(adminSessionQueryOptions);
  const sessionError = sessionQuery.error instanceof AdminSessionRequestError ? sessionQuery.error : null;

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
              <button
                type="button"
                className="ml-3 rounded-md border border-rose-300 bg-white px-3 py-1.5 font-semibold hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
                onClick={() => void sessionQuery.refetch()}
              >
                重新尝试
              </button>
            </>
          )}
      </AdminShellState>
    );
  }

  const session = sessionQuery.data;
  const requestedItem = adminNavigationItemForPath(pathname);
  const accessDenied = requestedItem ? !canAccessAdminNavigationItem(session, requestedItem) : false;

  return (
    <SidebarProvider>
      <AppSidebar session={session} onSignOut={() => void signOut()} />
      <SidebarInset>
        <AdminHeader pathname={pathname} />
        {accessDenied ? (
          <AdminShellState tone="warning">当前账号没有访问此工作区所需的权限。</AdminShellState>
        ) : (
          <div className="min-w-0 pb-10">{children}</div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
