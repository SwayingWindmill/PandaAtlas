import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/foundation/content/locales";

import { UiLabClient } from "./ui-lab-client";

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "ZhiPanda UI Lab",
  description: "Component spike for the PandaAtlas public experience.",
  robots: { index: false, follow: false },
};

export default async function FanV08UiLabPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  return <UiLabClient locale={locale} />;
}
