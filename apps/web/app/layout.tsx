import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/archivo";
import {
  DEFAULT_SHARE_IMAGE,
  ZHIPANDA_APPLICATION_NAME,
  ZHIPANDA_PUBLIC_ORIGIN,
  ZHIPANDA_PUBLISHER,
} from "@/lib/public-metadata";
import { appDownloadLinks } from "@/lib/app-download";
import "./globals.css";

const { iosStoreId } = appDownloadLinks();

export const metadata: Metadata = {
  metadataBase: ZHIPANDA_PUBLIC_ORIGIN,
  applicationName: ZHIPANDA_APPLICATION_NAME,
  title: {
    default: "吱熊猫 ZhiPanda",
    template: "%s | ZhiPanda",
  },
  description: "Discover giant pandas, their families, the places they have lived, and their latest published updates.",
  authors: [{ name: ZHIPANDA_PUBLISHER, url: ZHIPANDA_PUBLIC_ORIGIN.toString() }],
  icons: { apple: "/apple-touch-icon.png" },
  ...(iosStoreId ? { itunes: { appId: iosStoreId } } : {}),
  manifest: "/manifest.webmanifest",
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
    images: [DEFAULT_SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "吱熊猫 ZhiPanda",
    description: "Discover giant pandas, families, life journeys, and recent updates.",
    images: [DEFAULT_SHARE_IMAGE.url],
  },
};

// `cover` lets the page reach under the home indicator and the notch, so env(safe-area-inset-*) reports real
// insets: the open-in-app bar pads by the bottom one, .pa-shell by the side ones. The theme colour is the canvas.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcfdfc",
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
