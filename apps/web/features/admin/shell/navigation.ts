import type { AdminSession } from "@/features/admin/session/api/types";

export interface AdminNavigationItem {
  href: string;
  label: string;
  description: string;
  group: "总览" | "运营" | "治理";
  icon: "layout-dashboard" | "clipboard-check" | "shield-alert" | "database" | "send" | "scroll-text" | "shield-check";
  capabilities?: readonly string[];
  activePaths?: readonly string[];
}

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  { href: "/admin", label: "工作台", description: "我的可用工作区及账号权限", group: "总览", icon: "layout-dashboard", activePaths: ["/admin"] },
  {
    href: "/admin/reviews",
    label: "审核", description: "核验贡献证据与待审事项", group: "运营", icon: "clipboard-check",
    capabilities: ["review.case.read", "review.case.intake", "review.case.claim", "review.case.verify_source", "review.case.decide", "review.case.recommend"],
  },
  {
    href: "/admin/moderation",
    label: "内容治理", description: "处理申诉和账号限制", group: "运营", icon: "shield-alert",
    capabilities: ["moderation.sanction.read", "moderation.sanction.apply", "moderation.sanction.restore", "moderation.appeal.decide"],
  },
  {
    href: "/admin/curation",
    label: "策展", description: "管理经过核验的档案变更", group: "运营", icon: "database",
    capabilities: ["curation.change.read", "curation.change.manage", "curation.change.approve"],
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
    // Until #370 removes the generic catch-all, gate its still-reachable URLs too.
    activePaths: ["/admin/audit/evidence", "/admin/audit", "/admin/audit-logs"],
  },
  { href: "/admin/capabilities", label: "权限", description: "查看当前账号的操作能力", group: "治理", icon: "shield-check" },
  {
    href: "/admin/security/mfa",
    label: "账号安全",
    description: "启用和验证多因素认证",
    group: "治理",
    icon: "shield-check",
    capabilities: ["admin.shell.access"],
  },
] as const;

export function canAccessAdminNavigationItem(session: AdminSession, item: AdminNavigationItem): boolean {
  if (!item.capabilities?.length) return true;
  return item.capabilities.some((capability) => session.capabilities.includes(capability));
}

export function visibleAdminNavigationItems(session: AdminSession): AdminNavigationItem[] {
  return adminNavigationItems.filter((item) => canAccessAdminNavigationItem(session, item));
}

export function adminNavigationItemForPath(pathname: string): AdminNavigationItem | undefined {
  return adminNavigationItems.find((item) => {
    const activePaths = item.activePaths ?? [item.href];
    return activePaths.some((path) => pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`)));
  });
}

export function isAdminNavigationItemActive(item: AdminNavigationItem, pathname: string): boolean {
  return adminNavigationItemForPath(pathname) === item;
}
