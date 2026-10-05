import type { AdminSession } from "@/features/admin/session/api/types";

export interface AdminNavigationItem {
  href: string;
  label: string;
  capabilities?: readonly string[];
  activePaths?: readonly string[];
}

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  { href: "/admin", label: "Overview", activePaths: ["/admin"] },
  {
    href: "/admin/reviews",
    label: "Review",
    capabilities: ["review.case.read", "review.case.intake", "review.case.claim", "review.case.verify_source", "review.case.decide", "review.case.recommend"],
  },
  {
    href: "/admin/moderation",
    label: "Moderation",
    capabilities: ["moderation.sanction.read", "moderation.sanction.apply", "moderation.sanction.restore", "moderation.appeal.decide"],
  },
  {
    href: "/admin/curation",
    label: "Curation",
    capabilities: ["curation.change.read", "curation.change.manage", "curation.change.approve"],
  },
  {
    href: "/admin/publication",
    label: "Publication",
    capabilities: ["publication.release.manage", "publication.release.activate", "publication.emergency"],
  },
  {
    href: "/admin/audit",
    label: "Audit",
    capabilities: ["audit.read"],
    activePaths: ["/admin/audit", "/admin/audit-logs"],
  },
  { href: "/admin/capabilities", label: "Capabilities" },
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
