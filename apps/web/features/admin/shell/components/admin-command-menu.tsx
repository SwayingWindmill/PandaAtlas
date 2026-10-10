"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandShortcut,
} from "@/components/ui/command";
import type { AdminSession } from "@/features/admin/session/api/types";
import {
  adminNavigationItems, canAccessAdminNavigationItem,
} from "@/features/admin/shell/navigation";

export function AdminCommandMenu({ session }: { session: AdminSession }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  const permitted = adminNavigationItems.filter((item) => canAccessAdminNavigationItem(session, item));

  function navigate(href: string) {
    setOpen(false);
    router.push(href as Route);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="搜索工作区"
        aria-keyshortcuts="Control+K Meta+K"
        className="group h-9 min-w-9 justify-center gap-3 border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:min-w-56 sm:justify-between sm:px-3"
      >
        <span className="flex items-center gap-2.5"><Search size={16} aria-hidden="true" /><span className="hidden sm:inline">搜索工作区…</span></span>
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] text-slate-600 sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="快速进入工作区"
        description="搜索已授权的工作区，按上下方向键选择，回车进入。"
        className="max-w-xl border-slate-200 bg-white text-slate-950 shadow-xl [&_[data-slot=command]]:bg-white"
      >
        <CommandInput aria-label="搜索工作区" placeholder="查找功能、业务或工作区…" />
        <CommandList className="max-h-[min(60vh,420px)] p-2">
          <CommandEmpty className="py-10 text-slate-600">
            <span role="option" aria-selected="false" aria-disabled="true">没有匹配的工作区</span>
          </CommandEmpty>
          {(["总览", "运营", "治理"] as const).map((group) => {
            const options = permitted.filter((item) => item.group === group);
            return options.length ? (
              <CommandGroup key={group} heading={group}>
                {options.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.description}`}
                    onSelect={() => navigate(item.href)}
                    className="min-h-14 gap-3 rounded-lg px-3 py-2.5 text-slate-900 data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-950"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-600">{item.description}</span>
                    </span>
                    <CommandShortcut className="text-slate-500"><ArrowUpRight size={15} aria-hidden="true" /></CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null;
          })}
        </CommandList>
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600">
          仅显示当前账号有权限进入的页面 · ↑ ↓ 选择 · Enter 打开 · Esc 关闭
        </p>
      </CommandDialog>
    </>
  );
}
