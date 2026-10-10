"use client";

import { useQuery } from "@tanstack/react-query";

import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { capabilityDescription, capabilityGroups } from "@/features/admin/session/capability-presentation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AdminAccountNavigation } from "./admin-account-navigation";

export function AdminCapabilities() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  if (!session) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-7 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">我的权限</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">了解当前账号可以执行的工作。实际操作仍由服务端校验，敏感操作可能需要再次验证身份。</p>
      <AdminAccountNavigation current="capabilities" canUseMfa={session.capabilities.includes("admin.shell.access")} />
      <section aria-label="当前可用权限" className="mt-6">
        {session.capabilities.length === 0 && <p className="rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-700">当前账号没有可用的后台业务权限。</p>}
        <ul className="grid gap-3 md:grid-cols-2">
          {capabilityGroups(session.capabilities).map(([group, keys]) => (
            <li key={group} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-950">{group} · {keys.length} 项</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {keys.map((key) => <li key={key}>{capabilityDescription(key)}</li>)}
              </ul>
            </li>
          ))}
        </ul>
        {session.capabilities.length > 0 && <Collapsible className="mt-5 text-sm text-slate-600">
          <CollapsibleTrigger className="min-h-9 font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">查看权限代码</CollapsibleTrigger>
          <CollapsibleContent>
          <ul className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            {session.capabilities.map((capability) => <li key={capability} className="break-all font-mono text-xs text-slate-700">{capability}</li>)}
          </ul>
          </CollapsibleContent>
        </Collapsible>}
      </section>
    </div>
  );
}
