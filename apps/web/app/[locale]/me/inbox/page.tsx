import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isNotificationCenterEnabled } from "@/features/notification-center/config";
import { NotificationCenterPage } from "@/features/notification-center/notification-center-page";
import { parsePublicLocale } from "@/foundation/content/locales";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LocalizedInboxPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "通知中心 | 私有 Inbox 与邮件偏好",
    description: "查看当前账号的站内 Inbox、已读状态和可选邮件偏好。",
  },
  en: {
    title: "Notification Center | Private Inbox and email preferences",
    description: "Read the current account's native Inbox, read state, and optional email preferences.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedInboxPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return {
    title: t.title,
    description: t.description,
    robots: { index: false, follow: false, nocache: true },
    alternates: {
      canonical: `/${locale}/me/inbox`,
      languages: {
        "zh-CN": "/zh/me/inbox",
        en: "/en/me/inbox",
        "x-default": "/zh/me/inbox",
      },
    },
  };
}

export default async function LocalizedInboxPage({ params }: LocalizedInboxPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale || !isNotificationCenterEnabled()) notFound();
  return <NotificationCenterPage locale={locale} />;
}
