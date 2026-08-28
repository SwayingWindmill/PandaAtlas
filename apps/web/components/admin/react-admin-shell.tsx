"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  AdminV2OperationsWorkbench,
  type AdminV2Domain,
} from "@/components/admin/admin-v2-operations-workbench";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface AdminSession {
  accountId: string;
  aal: "aal1" | "aal2";
  capabilities: string[];
}

interface NavItem {
  href: string;
  label: string;
  domain?: AdminV2Domain;
  capabilities?: string[];
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview" },
  {
    href: "/admin/reviews",
    label: "Review",
    domain: "review",
    capabilities: ["review.case.read", "review.case.intake", "review.case.claim", "review.case.decide", "review.case.recommend"],
  },
  {
    href: "/admin/moderation",
    label: "Moderation",
    domain: "moderation",
    capabilities: ["moderation.sanction.read", "moderation.sanction.apply", "moderation.sanction.restore", "moderation.appeal.decide"],
  },
  {
    href: "/admin/curation",
    label: "Curation",
    domain: "curation",
    capabilities: ["curation.change.read", "curation.change.manage", "curation.change.approve"],
  },
  {
    href: "/admin/publication",
    label: "Publication",
    domain: "publication",
    capabilities: ["publication.release.manage", "publication.release.activate", "publication.emergency"],
  },
  {
    href: "/admin/audit",
    label: "Audit",
    domain: "audit",
    capabilities: ["audit.read"],
  },
  { href: "/admin/capabilities", label: "Capabilities" },
];

async function fetchAdminSession(): Promise<AdminSession> {
  const response = await fetch("/api/admin/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const error = new Error(`Admin session request failed with ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return await response.json() as AdminSession;
}

function canAccess(session: AdminSession, item: NavItem): boolean {
  if (!item.capabilities?.length) return true;
  return item.capabilities.some((capability) => session.capabilities.includes(capability));
}

function domainFromPath(pathname: string): AdminV2Domain | null {
  if (pathname === "/admin/reviews") return "review";
  if (pathname === "/admin/moderation") return "moderation";
  if (pathname === "/admin/curation") return "curation";
  if (pathname === "/admin/publication") return "publication";
  if (pathname === "/admin/audit" || pathname === "/admin/audit-logs") return "audit";
  return null;
}

function AdminOverview({ session }: { session: AdminSession }) {
  const available = navItems.filter((item) => item.domain && canAccess(session, item));
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-sm font-semibold text-stone-700">ZhiPanda Administration · V2</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">工作人员控制台</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
        此控制台只暴露 canonical V2 已拥有的 Review、Moderation、Curation、Publication 与 Audit 操作。旧 V1 Archive、Privacy admin、Game Bank、Media Upload 与 Content Center 不再作为生产候选路由保留。
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-stone-300 bg-white p-5">
          <h2 className="text-lg font-bold text-stone-950">Current account</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="font-semibold text-stone-700">Account ID</dt><dd className="mt-1 break-all font-mono text-stone-950">{session.accountId}</dd></div>
            <div><dt className="font-semibold text-stone-700">Assurance level</dt><dd className="mt-1 text-stone-950">{session.aal}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border border-stone-300 bg-white p-5">
          <h2 className="text-lg font-bold text-stone-950">Retained V2 operations</h2>
          <div className="mt-4 grid gap-2">
            {available.map((item) => (
              <Link key={item.href} href={item.href as Route} className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-stone-50">
                {item.label}
              </Link>
            ))}
            {!available.length ? <p className="text-sm text-stone-600">No staff operation capability is assigned to this account.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function CapabilityPage({ session }: { session: AdminSession }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-sm font-semibold text-stone-700">ZhiPanda Administration · V2</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">Capabilities</h1>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {session.capabilities.map((capability) => (
          <li key={capability} className="rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-950">
            {capability}
          </li>
        ))}
      </ul>
    </main>
  );
}

export function ReactAdminShell() {
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const domain = useMemo(() => domainFromPath(pathname), [pathname]);

  useEffect(() => {
    let active = true;
    void fetchAdminSession()
      .then((nextSession) => {
        if (active) setSession(nextSession);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const status = (reason as { status?: number }).status;
        if (status === 401) {
          window.location.assign(`/auth/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setError(status === 403 ? "This account does not have staff access." : "Unable to read the current V2 staff session.");
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    window.location.assign("/auth/login?next=%2Fadmin");
  }

  if (error) {
    return <main className="page-shell py-12"><p className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900" role="alert">{error}</p></main>;
  }
  if (!session) {
    return <main className="page-shell py-12" aria-busy="true">正在加载 V2 工作人员权限…</main>;
  }

  const visibleNav = navItems.filter((item) => canAccess(session, item));
  const requestedNav = navItems.find((item) => item.href === pathname || (pathname === "/admin/audit-logs" && item.href === "/admin/audit"));
  const accessDenied = requestedNav ? !canAccess(session, requestedNav) : false;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-950">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link href="/admin" className="font-bold">ZhiPanda Admin V2</Link>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Admin navigation">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${pathname === item.href || (pathname === "/admin/audit-logs" && item.href === "/admin/audit") ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-stone-100"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button type="button" variant="outline" className="min-h-10" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </header>

      {accessDenied ? (
        <main className="mx-auto w-full max-w-5xl px-4 py-8">
          <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">The current account does not have the capability required for this V2 operation surface.</p>
        </main>
      ) : domain ? (
        <AdminV2OperationsWorkbench domain={domain} />
      ) : pathname === "/admin/capabilities" ? (
        <CapabilityPage session={session} />
      ) : (
        <AdminOverview session={session} />
      )}
    </div>
  );
}
