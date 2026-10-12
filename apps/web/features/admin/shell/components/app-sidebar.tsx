"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck, Database, LayoutDashboard, LogOut, ScrollText,
  Send, ShieldAlert, ShieldCheck, Sprout, UsersRound, ChevronsUpDown,
} from "lucide-react";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import type { AdminSession } from "@/features/admin/session/api/types";
import {
  isAdminNavigationItemActive, visibleAdminNavigationItems,
  type AdminNavigationItem,
} from "@/features/admin/shell/navigation";

const icons = {
  "layout-dashboard": LayoutDashboard, "clipboard-check": ClipboardCheck,
  "shield-alert": ShieldAlert, database: Database, send: Send,
  "scroll-text": ScrollText, "shield-check": ShieldCheck, "users-round": UsersRound,
} as const;

export function AppSidebar({ session, onSignOut }: { session: AdminSession; onSignOut: () => void }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const navigation = visibleAdminNavigationItems(session);

  return (
    <Sidebar collapsible="icon" variant="inset" className="text-sm">
      <SidebarHeader className="px-3 pb-4 pt-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="PandaAtlas 数据运营中心" className="h-14 gap-3 rounded-xl px-2 hover:bg-sidebar-accent">
              <Link href="/admin" onClick={() => setOpenMobile(false)}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#186b59] text-white shadow-[0_3px_10px_rgb(24_107_89_/_0.14)]">
                  <Sprout className="size-5" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <strong className="block truncate text-[15px] font-bold tracking-[-0.03em] text-slate-950">PandaAtlas</strong>
                  <span className="mt-0.5 block text-[11px] font-medium text-slate-500">DATA OPERATIONS</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="mx-4 opacity-75" />
      <SidebarContent className="gap-3 px-2 py-5">
        <nav aria-label="后台导航">
          {(["总览", "运营", "治理"] as const).map((group) => {
            const items = navigation.filter((item) => item.group === group);
            if (!items.length) return null;
            return (
              <SidebarGroup key={group} className="gap-1 px-2 pb-2">
                <SidebarGroupLabel className="h-8 px-3 text-[11px] font-semibold tracking-[0.08em] text-slate-500">{group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {items.map((item: AdminNavigationItem) => {
                      const Icon = icons[item.icon];
                      const active = isAdminNavigationItemActive(item, pathname);
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild isActive={active} tooltip={item.label}
                            className="h-10 gap-3 rounded-lg px-3 text-[13px] font-medium text-slate-600 hover:text-slate-950 data-[active=true]:bg-[#e9f5f1] data-[active=true]:font-semibold data-[active=true]:text-[#145b4a]"
                          >
                            <Link href={item.href as Route} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                              <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2 : 1.7} aria-hidden="true" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-sidebar-border px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="h-13 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 hover:bg-slate-100">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-900">工</span>
                  <span className="min-w-0 flex-1 truncate text-left">
                    <span className="block truncate text-xs font-semibold text-slate-950">工作人员</span>
                    <span className="block truncate text-[11px] text-slate-500">账号与安全设置</span>
                  </span>
                  <ChevronsUpDown className="size-4 text-slate-500" aria-hidden="true" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 rounded-xl border-slate-200 bg-white p-1.5 text-slate-900 shadow-lg">
                <DropdownMenuLabel className="px-3 py-2 text-xs text-slate-500">我的后台账号</DropdownMenuLabel>
                <DropdownMenuItem asChild className="min-h-10 cursor-pointer rounded-lg">
                  <Link href="/admin/capabilities" onClick={() => setOpenMobile(false)}><ShieldCheck aria-hidden="true" /> 我的账号</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onSignOut} className="min-h-10 cursor-pointer rounded-lg text-rose-700 focus:text-rose-700">
                  <LogOut aria-hidden="true" /> 退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
