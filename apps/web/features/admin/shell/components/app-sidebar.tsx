"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck, Database, LayoutDashboard, LogOut, ScrollText,
  Send, ShieldAlert, ShieldCheck, Sprout, UsersRound,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import type { AdminSession } from "@/features/admin/session/api/types";
import {
  isAdminNavigationItemActive,
  visibleAdminNavigationItems,
  type AdminNavigationItem,
} from "@/features/admin/shell/navigation";

const icons = {
  "layout-dashboard": LayoutDashboard,
  "clipboard-check": ClipboardCheck,
  "shield-alert": ShieldAlert,
  database: Database,
  send: Send,
  "scroll-text": ScrollText,
  "shield-check": ShieldCheck,
  "users-round": UsersRound,
} as const;

export function AppSidebar({ session, onSignOut }: { session: AdminSession; onSignOut: () => void }) {
  const pathname = usePathname();
  const { expanded, setMobileOpen } = useSidebar();
  const navigation = visibleAdminNavigationItems(session);

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/admin" onClick={() => setMobileOpen(false)} title="PandaAtlas 数据运营中心" className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-white outline-offset-4 focus-visible:outline-2 focus-visible:outline-white">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300 ring-1 ring-teal-300/20"><Sprout size={23} strokeWidth={1.8} /></span>
          <span className={expanded ? "min-w-0" : "md:sr-only"}>
            <strong className="block truncate text-base font-bold tracking-tight">PandaAtlas</strong>
            <span className="block truncate text-[11px] tracking-widest text-slate-400">数据运营中心</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="后台导航">
          {(["总览", "运营", "治理"] as const).map((group) => {
            const items = navigation.filter((item) => item.group === group);
            if (!items.length) return null;
            return (
              <SidebarGroup key={group}>
                <SidebarGroupLabel>{group}</SidebarGroupLabel>
                <SidebarMenu>
                  {items.map((item: AdminNavigationItem) => {
                    const Icon = icons[item.icon];
                    const active = isAdminNavigationItemActive(item, pathname);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton isActive={active}>
                          <Link
                            href={item.href as Route}
                            title={item.label}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setMobileOpen(false)}
                          >
                            <Icon size={18} strokeWidth={active ? 2.1 : 1.8} className={active ? "shrink-0 text-teal-300" : "shrink-0 text-slate-400"} />
                            <span className={expanded ? "truncate" : "md:sr-only"}>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            );
          })}
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-300/20 text-xs font-bold text-teal-100">工</span>
          <div className={expanded ? "min-w-0 flex-1" : "md:sr-only"}>
            <p className="truncate text-xs font-semibold text-white">工作人员</p>
            <p className="truncate font-mono text-[11px] text-slate-400">{session.accountId.slice(0, 8)}</p>
          </div>
        </div>
        <button type="button" onClick={onSignOut} title="退出登录" className="mt-2 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-teal-300">
          <LogOut size={18} className="shrink-0" />
          <span className={expanded ? "" : "md:sr-only"}>退出登录</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
