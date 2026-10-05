import { notFound } from "next/navigation";

import {
  AdminV2OperationsWorkbench,
  type AdminV2Domain,
} from "@/components/admin/admin-v2-operations-workbench";
import { AdminCapabilities } from "@/features/admin/shell/components/admin-capabilities";

export const dynamic = "force-dynamic";

interface AdminCatchAllPageProps {
  params: Promise<{ path: string[] }>;
}

const retainedDomainPaths: Readonly<Record<string, AdminV2Domain>> = {
  curation: "curation",
  audit: "audit",
  "audit-logs": "audit",
};

export default async function AdminCatchAllPage({ params }: AdminCatchAllPageProps) {
  const { path } = await params;
  const requestedPath = path.join("/");
  if (requestedPath === "capabilities") return <AdminCapabilities />;
  const domain = retainedDomainPaths[requestedPath];
  if (!domain) notFound();
  return <AdminV2OperationsWorkbench domain={domain} />;
}
