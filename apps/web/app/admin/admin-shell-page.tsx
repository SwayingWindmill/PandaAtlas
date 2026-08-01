import { notFound } from "next/navigation";

import { AdminShellLoader } from "@/components/admin/admin-shell-loader";

export const dynamic = "force-dynamic";

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true" || value?.trim() === "1";
}

export function AdminShellPage() {
  if (!isEnabled(process.env.ADMIN_SHELL_ENABLED ?? process.env.NEXT_PUBLIC_ADMIN_SHELL_ENABLED)) {
    notFound();
  }
  return <AdminShellLoader />;
}
