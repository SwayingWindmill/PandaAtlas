import Link from "next/link";
import type { Route } from "next";

import type { AdminSession } from "@/features/admin/session/api/types";

export function StaffWorkspaceNavigation({ current, session }: { current: "directory" | "invitations"; session: AdminSession }) {
  const canInvite = session.capabilities.includes("identity.staff.read") || session.capabilities.includes("identity.account.manage");
  const items = [
    { href: "/admin/staff/roles", label: "人员与权限", id: "directory" },
    ...(canInvite ? [{ href: "/admin/staff/invitations", label: "邀请记录", id: "invitations" }] : []),
  ] as const;

  return (
    <nav aria-label="人员管理页面" className="flex flex-wrap gap-1 border-b border-slate-200">
      {items.map((item) => (
        <Link key={item.href} href={item.href as Route} aria-current={current === item.id ? "page" : undefined}
          className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${current === item.id ? "border-teal-700 text-teal-900" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950"}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
