import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminProviders } from "@/features/admin/shell/components/admin-providers";
import { AdminShell } from "@/features/admin/shell/components/admin-shell";
import { isAdminShellEnabled } from "@/lib/server/admin-shell";

export const metadata: Metadata = {
  title: { absolute: "ZhiPanda 工作人员控制台" },
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Second guard for pages, independent of how the request path was spelled.
  if (!isAdminShellEnabled()) notFound();
  return (
    <AdminProviders>
      <AdminShell>{children}</AdminShell>
    </AdminProviders>
  );
}
