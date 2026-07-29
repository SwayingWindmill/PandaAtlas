import type { Metadata } from "next";
import { Suspense } from "react";

import { EmailOtpLogin } from "@/features/auth";

export const metadata: Metadata = {
  title: "邮箱验证码登录",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page-shell py-12">正在准备登录…</main>}>
      <EmailOtpLogin />
    </Suspense>
  );
}
