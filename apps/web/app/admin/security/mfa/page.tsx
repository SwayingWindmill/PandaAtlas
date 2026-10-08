import { Suspense } from "react";

import { StaffMfa } from "@/features/admin/security/components/staff-mfa";

export const dynamic = "force-dynamic";

export default function AdminSecurityMfaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-600">正在加载安全设置…</div>}>
      <StaffMfa />
    </Suspense>
  );
}
