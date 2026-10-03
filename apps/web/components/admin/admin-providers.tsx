"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";

import QueryProvider from "@/components/layout/query-provider";

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <QueryProvider>{children}</QueryProvider>
    </NuqsAdapter>
  );
}
