import { notFound } from "next/navigation";

import { AdminShellPage } from "../admin-shell-page";

export const dynamic = "force-dynamic";

interface AdminCatchAllPageProps {
  params: Promise<{ path: string[] }>;
}

const removedNonProductPaths = new Set(["imports"]);

export default async function AdminCatchAllPage({ params }: AdminCatchAllPageProps) {
  const { path } = await params;
  if (removedNonProductPaths.has(path.join("/"))) notFound();
  return <AdminShellPage />;
}
