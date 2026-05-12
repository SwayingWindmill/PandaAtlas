import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "大熊猫图鉴",
  description: "大熊猫图鉴与分布地图"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
