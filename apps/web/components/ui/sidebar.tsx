"use client";

// Adapted from the shadcn sidebar composition used by
// Kiranism/next-shadcn-dashboard-starter (SidebarProvider / Sidebar / SidebarInset).
// Keep only the primitives used by the PandaAtlas staff console.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarContextValue = {
  expanded: boolean;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  toggle: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("Sidebar components must be inside SidebarProvider");
  return context;
}

export function SidebarProvider({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  const [expanded, setExpanded] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  React.useEffect(() => {
    const saved = document.cookie.split("; ").find((entry) => entry.startsWith("pa_admin_sidebar="));
    if (saved) setExpanded(saved.split("=")[1] !== "false");
    setRestored(true);
  }, []);
  React.useEffect(() => {
    if (restored) {
      document.cookie = `pa_admin_sidebar=${expanded}; path=/admin; max-age=604800; SameSite=Lax`;
    }
  }, [expanded, restored]);
  const toggle = React.useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileOpen((value) => !value);
    } else {
      setExpanded((value) => !value);
    }
  }, []);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return (
    <SidebarContext.Provider value={{ expanded, mobileOpen, setMobileOpen, toggle }}>
      <div data-slot="sidebar-wrapper" data-state={expanded ? "expanded" : "collapsed"} className={cn("pa-admin-shell flex min-h-svh w-full bg-[#f6f8fa] text-slate-900", className)}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  const { expanded, mobileOpen, setMobileOpen } = useSidebar();
  return (
    <>
      {mobileOpen ? (
        <button aria-label="关闭导航遮罩" className="fixed inset-0 z-40 bg-slate-950/55 md:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}
      <aside
        data-slot="sidebar"
        data-state={expanded ? "expanded" : "collapsed"}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#111d2b] text-slate-200 shadow-2xl transition-transform duration-200 md:sticky md:z-auto md:h-svh md:shrink-0 md:translate-x-0 md:shadow-none",
          expanded ? "md:w-64" : "md:w-[4.5rem]",
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full md:visible",
          className,
        )}
      >
        <div className="absolute right-3 top-3 md:hidden">
          <button type="button" aria-label="关闭导航" onClick={() => setMobileOpen(false)} className="rounded-md p-2 text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><X size={18} /></button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function SidebarHeader({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <div data-slot="sidebar-header" className={cn("shrink-0 border-b border-white/10 px-3 py-5", className)}>{children}</div>;
}

export function SidebarContent({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <div data-slot="sidebar-content" className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-5", className)}>{children}</div>;
}

export function SidebarFooter({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <div data-slot="sidebar-footer" className={cn("shrink-0 border-t border-white/10 px-3 py-4", className)}>{children}</div>;
}

export function SidebarGroup({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <section data-slot="sidebar-group" className={cn("mb-5", className)}>{children}</section>;
}

export function SidebarGroupLabel({ children }: React.PropsWithChildren) {
  const { expanded } = useSidebar();
  return <p data-slot="sidebar-group-label" className={cn("mb-2 px-3 text-[11px] font-semibold tracking-[.12em] text-slate-400", !expanded && "md:sr-only")}>{children}</p>;
}

export function SidebarMenu({ children }: React.PropsWithChildren) {
  return <ul data-slot="sidebar-menu" className="space-y-1">{children}</ul>;
}

export function SidebarMenuItem({ children }: React.PropsWithChildren) {
  return <li data-slot="sidebar-menu-item">{children}</li>;
}

export function SidebarMenuButton({
  children,
  isActive,
}: {
  children: React.ReactElement<React.ComponentProps<"a">>;
  isActive?: boolean;
}) {
  return (
    <Slot
      data-slot="sidebar-menu-button"
      data-active={isActive || undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-teal-300",
        isActive
          ? "bg-teal-300/15 text-teal-100 ring-1 ring-inset ring-teal-300/20"
          : "text-slate-300 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </Slot>
  );
}

export function SidebarInset({ children }: React.PropsWithChildren) {
  return <main data-slot="sidebar-inset" className="min-w-0 flex-1 bg-[#f6f8fa]">{children}</main>;
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { expanded, toggle } = useSidebar();
  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      aria-label="切换侧边栏"
      aria-expanded={expanded}
      title="切换侧边栏（Ctrl+B）"
      onClick={toggle}
      className={cn("inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600", className)}
    >
      {expanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
    </button>
  );
}
