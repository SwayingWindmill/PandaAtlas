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

interface LocalizedMapPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const metadataCopy = {
  zh: {
    title: "结构化全球分布与足迹",
    description: "不依赖地图画布，查阅大熊猫机构、个体驻留、野生保护范围、公开精度、来源和快照。",
  },
  en: {
    title: "Structured global distribution and footprints",
    description: "Explore panda institutions, individual residencies, wild conservation coverage, public precision, sources, and snapshots without a map canvas.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedMapPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `/${locale}/map`,
      languages: {
        "zh-CN": "/zh/map",
        en: "/en/map",
        "x-default": "/zh/map",
      },
    },
  };
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
