"use client";

import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";

import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { visibleAdminNavigationItems } from "@/features/admin/shell/navigation";

export function AdminOverview() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  if (!session) return null;

  const operations = visibleAdminNavigationItems(session).filter(
    (item) => item.href !== "/admin" && item.href !== "/admin/capabilities",
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-sm font-semibold text-stone-700">ZhiPanda Administration · V2</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">Staff control plane</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
        This console exposes only canonical V2 operations. Navigation reflects the current account capabilities; backend authorization remains authoritative.
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
          <h2 className="text-lg font-bold text-stone-950">Available operations</h2>
          <div className="mt-4 grid gap-2">
            {operations.map((item) => (
              <Link key={item.href} href={item.href as Route} className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-stone-50">
                {item.label}
              </Link>
            ))}
            {!operations.length ? <p className="text-sm text-stone-600">No staff operation capability is assigned to this account.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
