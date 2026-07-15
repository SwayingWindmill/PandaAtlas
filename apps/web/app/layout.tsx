import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "大熊猫图鉴",
  description: "大熊猫图鉴与分布地图"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const language = requestHeaders.get("x-panda-page-language") === "en" ? "en" : "zh-CN";

  return (
    <html lang={language}>
      <body>
        <div className="app-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
