import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminProviders } from "@/components/admin/admin-providers";

export const metadata: Metadata = {
  title: { absolute: "ZhiPanda 工作人员控制台" },
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true" || value?.trim() === "1";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isEnabled(process.env.ADMIN_SHELL_ENABLED)) {
    notFound();
  }
  return <AdminProviders>{children}</AdminProviders>;
}
