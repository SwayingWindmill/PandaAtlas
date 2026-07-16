import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PandaAtlas",
    template: "%s | PandaAtlas",
  },
  description: "A bilingual, evidence-first public archive of giant panda identities and reviewed facts.",
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
