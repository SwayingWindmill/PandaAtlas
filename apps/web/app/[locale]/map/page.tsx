import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { MapCover } from "@/features/map/panda-world-map";
import { PandaMapPage } from "@/features/map/panda-map-page";
import { buildPandaMapViewModel } from "@/features/map/panda-map-view-model";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/features/map/world-land.generated";
import {
  loadV2PandaCovers,
  loadV2PublicMapOverview,
  pandaCoverMedia,
} from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LocalizedMapPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "熊猫地图 | 吱熊猫",
    description: "世界上哪些动物园和基地住着大熊猫，现在住着哪几只。",
  },
  en: {
    title: "Panda map | ZhiPanda",
    description: "The zoos and breeding centers around the world where giant pandas live, and which pandas live there now.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedMapPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({ locale, title: t.title, description: t.description, path: "/map" });
}

export default async function LocalizedMapPage({ params }: LocalizedMapPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const envelope = await loadV2PublicMapOverview(locale);
  if (!envelope) notFound();
  const view = buildPandaMapViewModel(envelope.data.entries, locale, { width: WORLD_WIDTH, height: WORLD_HEIGHT });
  const coverIds = view.items.flatMap((item) => (item.coverPandaId ? [item.coverPandaId] : []));
  const assets = await loadV2PandaCovers(coverIds);
  const covers: Record<string, MapCover> = {};
  for (const item of view.items) {
    const asset = item.coverPandaId ? assets.get(item.coverPandaId) : undefined;
    const media = asset ? pandaCoverMedia(asset, item.name, locale) : null;
    if (media && item.coverPandaId) covers[item.coverPandaId] = { src: media.src, alt: media.alt };
  }
  return <PandaMapPage locale={locale} view={view} covers={covers} />;
}
