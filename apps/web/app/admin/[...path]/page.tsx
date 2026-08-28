import { notFound } from "next/navigation";

import { AdminShellPage } from "../admin-shell-page";

export const dynamic = "force-dynamic";

interface AdminCatchAllPageProps {
  params: Promise<{ path: string[] }>;
}

const retainedAdminPaths = new Set([
  "reviews",
  "moderation",
  "curation",
  "publication",
  "audit",
  "audit-logs",
  "capabilities",
]);

export default async function AdminCatchAllPage({ params }: AdminCatchAllPageProps) {
  const { path } = await params;
  if (!retainedAdminPaths.has(path.join("/"))) notFound();
  return <AdminShellPage />;
}
