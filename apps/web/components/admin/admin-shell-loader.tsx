"use client";

import dynamic from "next/dynamic";

const ReactAdminShell = dynamic(
  () => import("@/components/admin/react-admin-shell").then((module) => module.ReactAdminShell),
  {
    ssr: false,
    loading: () => (
      <main className="page-shell py-12" aria-busy="true">
        正在加载工作人员控制台…
      </main>
    ),
  },
);

export function AdminShellLoader() {
  return <ReactAdminShell />;
}
