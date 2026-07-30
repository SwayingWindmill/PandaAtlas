import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { StructuredMapPage } from "@/features/map/structured-map-page";
import { loadHabitatMapInput } from "@/features/map/map-data-source";
import { parseStructuredMapQuery, structuredMapHref } from "@/features/map/map-query";
import { buildStructuredMapViewModel } from "@/features/map/map-view-model";
import { buildMapVisualizationModel } from "@/features/map/visualization/map-visual-model";
import {
  loadPublishedMapDataset,
  type PublicCoverage,
} from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LocalizedMapPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const metadataCopy = {
  zh: {
    title: "熊猫地图 | 吱熊猫",
    description: "探索大熊猫生活过的机构与地点，以及公开的野生家园范围和资料来源。",
  },
  en: {
    title: "Panda map | ZhiPanda",
    description: "Explore institutions and places where giant pandas have lived, plus published wild habitat coverage and sources.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedMapPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({ locale, title: t.title, description: t.description, path: "/map" });
}

export default async function LocalizedMapPage({ params, searchParams }: LocalizedMapPageProps) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedMapDataset(locale);
  const habitatInput = await loadHabitatMapInput({ bbox: "73,18,136,54" });
  const parsed = parseStructuredMapQuery(rawQuery, envelope.release.id);
  const initialView = buildStructuredMapViewModel(
    envelope.data,
    envelope.sources,
    habitatInput,
    parsed.state,
    locale,
  );
  const country = parsed.state.country === "all"
    || initialView.countries.some((option) => option.code === parsed.state.country)
    ? parsed.state.country
    : "all";
  const selected = parsed.state.selected && initialView.validResultIds.has(parsed.state.selected)
    ? parsed.state.selected
    : "";
  const canonicalState = { ...parsed.state, country, selected };
  if (parsed.needsNormalization || country !== parsed.state.country || selected !== parsed.state.selected) {
    permanentRedirect(structuredMapHref(locale, canonicalState) as Route);
  }
  const view = country === parsed.state.country && selected === parsed.state.selected
    ? initialView
    : buildStructuredMapViewModel(envelope.data, envelope.sources, habitatInput, canonicalState, locale);
  const visualization = buildMapVisualizationModel(view, habitatInput, locale, canonicalState);
  const coverage: PublicCoverage = view.hasPartialCoverage
    ? {
        state: "partial",
        scope: habitatInput.source === "api"
          ? "reviewed structured geography with some records lacking clickable source links"
          : "reviewed institutions and residencies plus an explicitly cached partial habitat release",
      }
    : envelope.coverage;

  return (
    <StructuredMapPage
      locale={locale}
      state={canonicalState}
      view={view}
      visualization={visualization}
      release={envelope.release}
      delivery={envelope.delivery}
      coverage={coverage}
      localeDelivery={envelope.locale}
    />
  );
}
