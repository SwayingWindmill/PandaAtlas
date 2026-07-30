import type { Metadata } from "next";
import { Suspense } from "react";

import { EmailOtpLogin } from "@/features/auth";

export const metadata: Metadata = {
  title: { absolute: "登录吱熊猫 | ZhiPanda sign-in" },
  description: "使用邮箱验证码安全登录吱熊猫，继续关注熊猫并查看私有动态。",
  applicationName: "吱熊猫 ZhiPanda",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
  referrer: "no-referrer",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page-shell py-12">正在准备登录…</main>}>
      <EmailOtpLogin />
    </Suspense>
  );
}
