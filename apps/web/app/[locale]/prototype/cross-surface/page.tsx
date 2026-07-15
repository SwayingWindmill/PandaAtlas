import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CrossSurfacePrototype } from "./prototype-client";

export const metadata: Metadata = {
  title: "PandaAtlas cross-surface design prototype",
  robots: {
    index: false,
    follow: false,
  },
};

interface PrototypePageProps {
  params: Promise<{ locale: string }>;
}

export default async function PrototypePage({ params }: PrototypePageProps) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "en") notFound();

  return (
    <Suspense fallback={null}>
      <CrossSurfacePrototype locale={locale} />
    </Suspense>
  );
}
