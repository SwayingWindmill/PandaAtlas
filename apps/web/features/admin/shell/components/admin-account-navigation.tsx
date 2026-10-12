import Link from "next/link";
import type { Route } from "next";

export function AdminAccountNavigation({ current, canUseMfa }: { current: "capabilities" | "mfa"; canUseMfa: boolean }) {
  const items = [
    { href: "/admin/capabilities", label: "我的权限", id: "capabilities" },
    ...(canUseMfa ? [{ href: "/admin/security/mfa", label: "双重验证", id: "mfa" }] : []),
  ] as const;
  return (
    <nav aria-label="我的账号页面" className="mt-5 flex flex-wrap gap-1 border-b border-slate-200">
      {items.map((item) => (
        <Link href={item.href as Route} key={item.href} aria-current={current === item.id ? "page" : undefined}
          className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${current === item.id ? "border-teal-700 text-teal-900" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950"}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
