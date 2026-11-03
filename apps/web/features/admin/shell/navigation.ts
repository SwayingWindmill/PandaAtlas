import type { AdminSession } from "@/features/admin/session/api/types";

export interface AdminNavigationItem {
  href: string;
  label: string;
  description: string;
  group: "总览" | "运营" | "治理";
  icon: "layout-dashboard" | "clipboard-check" | "send" | "scroll-text" | "shield-check";
  capabilities?: readonly string[];
  /** Retained as an authorized deep-link route without occupying the sidebar. */
  hiddenFromSidebar?: boolean;
}

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  { href: "/admin", label: "工作台", description: "我的可用工作区及账号权限", group: "总览", icon: "layout-dashboard" },
  {
    href: "/admin/reviews",
    label: "审核", description: "核验贡献证据与待审事项", group: "运营", icon: "clipboard-check",
    capabilities: ["review.case.read", "review.case.intake", "review.case.claim", "review.case.verify_source", "review.case.decide"],
  },
  {
    href: "/admin/publication",
    label: "发布", description: "版本检查、启用和回滚", group: "运营", icon: "send",
    capabilities: ["publication.release.manage", "publication.release.activate", "publication.emergency"],
  },
  {
    href: "/admin/audit/evidence",
    label: "审计", description: "追踪操作与证据记录", group: "治理", icon: "scroll-text",
    capabilities: ["audit.read"],
  },
  { href: "/admin/capabilities", label: "我的账号", description: "查看个人权限与安全设置", group: "治理", icon: "shield-check", hiddenFromSidebar: true },
  {
    href: "/admin/security/mfa",
    label: "账号安全",
    description: "启用和验证多因素认证",
    group: "治理",
    icon: "shield-check",
    capabilities: ["admin.shell.access"],
    hiddenFromSidebar: true,
  },
] as const;

export function canAccessAdminNavigationItem(session: AdminSession, item: AdminNavigationItem): boolean {
  if (!item.capabilities?.length) return true;
  return item.capabilities.some((capability) => session.capabilities.includes(capability));
}

export function visibleAdminNavigationItems(session: AdminSession): AdminNavigationItem[] {
  return adminNavigationItems.filter((item) => !item.hiddenFromSidebar && canAccessAdminNavigationItem(session, item));
}

export function adminNavigationItemForPath(pathname: string): AdminNavigationItem | undefined {
  return adminNavigationItems.find((item) =>
    pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)),
  );
}

export function isAdminNavigationItemActive(item: AdminNavigationItem, pathname: string): boolean {
  return adminNavigationItemForPath(pathname) === item;
}
