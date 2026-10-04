"use client";

import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { AdminSessionRequestError } from "@/features/admin/session/api/service";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import {
  adminNavigationItemForPath,
  canAccessAdminNavigationItem,
  isAdminNavigationItemActive,
  visibleAdminNavigationItems,
} from "@/features/admin/shell/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function AdminShellState({ children, tone }: { children: React.ReactNode; tone: "loading" | "error" | "warning" }) {
  const toneClass = tone === "error"
    ? "border-red-300 bg-red-50 text-red-900"
    : tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : "border-stone-300 bg-white text-stone-700";
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy={tone === "loading" ? true : undefined}>
      <p className={`rounded-md border p-4 text-sm ${toneClass}`} role={tone === "error" ? "alert" : undefined}>
        {children}
      </p>
    </main>
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
    return <AdminShellState tone="loading">Loading staff access…</AdminShellState>;
  }
  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <AdminShellState tone="error">
        {sessionError?.status === 403
          ? "This account does not have staff access."
          : "Unable to read the current V2 staff session."}
      </AdminShellState>
    );
  }

  const session = sessionQuery.data;
  const visibleNavigation = visibleAdminNavigationItems(session);
  const requestedItem = adminNavigationItemForPath(pathname);
  const accessDenied = requestedItem ? !canAccessAdminNavigationItem(session, requestedItem) : false;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-950">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link href="/admin" className="font-bold">ZhiPanda Admin V2</Link>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Admin navigation">
            {visibleNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${isAdminNavigationItemActive(item, pathname) ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-stone-100"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button type="button" variant="outline" className="min-h-10" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </header>

      {accessDenied ? (
        <AdminShellState tone="warning">
          The current account does not have the capability required for this V2 operation surface.
        </AdminShellState>
      ) : children}
    </div>
  );
}
