"use client";

import { useQuery } from "@tanstack/react-query";

import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";

export function AdminCapabilities() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  if (!session) return null;

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
