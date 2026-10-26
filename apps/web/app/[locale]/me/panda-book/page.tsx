import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { publicShellClassName } from "@/components/patterns/public-shell";
import { buildGamePandas } from "@/features/games/game-panda";
import { PandaBookPage } from "@/features/my-pandas/panda-book-page";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface PandaBookRouteProps {
  params: Promise<{ locale: string }>;
}

const copy = {
  zh: {
    title: "熊猫图鉴 | 我的熊猫 | 吱熊猫",
    description: "在小游戏里认识的熊猫都收在这里，只记录你自己的进度。",
  },
  en: {
    title: "Panda book | My Pandas | ZhiPanda",
    description: "The pandas you have met in the games, with your own progress only.",
  },
} as const;

export async function generateMetadata({ params }: PandaBookRouteProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/me/panda-book",
    privatePage: true,
  });
}

export default async function PandaBookRoute({ params }: PandaBookRouteProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();
  const pandas = buildGamePandas(envelope.data.pandas, locale).map((panda) => ({
    id: panda.id,
    name: panda.name,
    alternateName: panda.alternateName,
    href: `/${locale}/pandas/${panda.slug}`,
    imageUrl: panda.imageUrl,
    imageAlt: panda.imageAlt,
  }));

  return (
    <>
      <main id="main-content" className="bg-[var(--bg)] text-[var(--fg)]">
        <div className={publicShellClassName}>
          <PandaBookPage locale={locale} pandas={pandas} />
        </div>
      </main>
    </>
  );
}
