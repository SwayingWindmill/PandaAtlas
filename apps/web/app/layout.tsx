import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "吱熊猫 ZhiPanda",
    template: "%s | ZhiPanda",
  },
  description: "A modern panda information website for discovering individual pandas, families, places, and trusted sources.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const language = requestHeaders.get("x-panda-page-language") === "en" ? "en" : "zh-CN";

  return (
    <html lang={language}>
      <body>{children}</body>
    </html>
  );
}
