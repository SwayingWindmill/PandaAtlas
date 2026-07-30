import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  ZHIPANDA_APPLICATION_NAME,
  ZHIPANDA_PUBLIC_ORIGIN,
  ZHIPANDA_PUBLISHER,
} from "@/foundation/metadata/public-metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: ZHIPANDA_PUBLIC_ORIGIN,
  applicationName: ZHIPANDA_APPLICATION_NAME,
  title: {
    default: "吱熊猫 ZhiPanda",
    template: "%s | ZhiPanda",
  },
  description: "Discover giant pandas, their families, the places they have lived, and their latest published updates.",
  authors: [{ name: ZHIPANDA_PUBLISHER, url: ZHIPANDA_PUBLIC_ORIGIN }],
  creator: ZHIPANDA_PUBLISHER,
  publisher: ZHIPANDA_PUBLISHER,
  openGraph: {
    type: "website",
    url: "/zh",
    siteName: ZHIPANDA_PUBLISHER,
    title: "吱熊猫 ZhiPanda",
    description: "认识大熊猫、探索家族关系、生活足迹和最近动态。",
    locale: "zh_CN",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary",
    title: "吱熊猫 ZhiPanda",
    description: "Discover giant pandas, families, life journeys, and recent updates.",
  },
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
