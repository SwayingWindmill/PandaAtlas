import type { Metadata } from "next";
import { Manrope, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["500", "600", "700", "800"]
});

const notoSansSc = Noto_Sans_SC({
  preload: false,
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "700"]
});

export const metadata: Metadata = {
  title: "大熊猫图鉴",
  description: "大熊猫图鉴与分布地图"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${manrope.variable} ${notoSansSc.variable}`}>
        <div className="app-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
