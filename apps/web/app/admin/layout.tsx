import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "ZhiPanda 工作人员控制台" },
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
