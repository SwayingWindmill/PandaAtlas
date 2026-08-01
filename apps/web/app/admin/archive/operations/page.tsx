import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true" || value?.trim() === "1";
}

export default function AdminArchiveOperationsPage() {
  if (!isEnabled(process.env.ADMIN_SHELL_ENABLED ?? process.env.NEXT_PUBLIC_ADMIN_SHELL_ENABLED)) {
    notFound();
  }

  redirect("/admin#/archive/operations");
}
