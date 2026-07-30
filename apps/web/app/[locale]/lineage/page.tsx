import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  loadPublishedLineageDataset,
  resolvePublishedPandaReference,
  type PublicCoverage,
} from "@/features/public-content/public-release";
import {
  lineageHref,
  parseLineageQuery,
  type LineageFocusReference,
} from "@/features/lineage/lineage-query";
import { StructuredLineagePage } from "@/features/lineage/structured-lineage-page";
import { buildStructuredLineageViewModel } from "@/features/lineage/lineage-view-model";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LocalizedLineagePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const metadataCopy = {
  zh: {
    title: "熊猫家族 | 吱熊猫",
    description: "探索大熊猫的父母、子女、兄弟姐妹和家族关系，并查看每段关系的资料来源。",
  },
  en: {
    title: "Panda families | ZhiPanda",
    description: "Explore giant panda parents, children, siblings, and family connections, with sources for every published relationship.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedLineagePageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({ locale, title: t.title, description: t.description, path: "/lineage" });
}

export default async function LocalizedLineagePage({
  params,
  searchParams,
}: LocalizedLineagePageProps) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedLineageDataset(locale);
  const defaultNode = envelope.data.nodes.find((node) => node.profile_available) ?? envelope.data.nodes[0];
  if (!defaultNode) notFound();
  const defaultFocus: LineageFocusReference = { id: defaultNode.id, slug: defaultNode.slug };
  const resolveFocus = (input: string): LineageFocusReference | null => {
    const published = resolvePublishedPandaReference(input);
    if (published && envelope.data.nodes.some((node) => node.id === published.id)) return published;
    const direct = envelope.data.nodes.find((node) => node.id === input || node.slug === input);
    return direct ? { id: direct.id, slug: direct.slug } : null;
  };

  const parsed = parseLineageQuery(rawQuery, resolveFocus, defaultFocus);
  const initialView = buildStructuredLineageViewModel(
    envelope.data.nodes,
    envelope.data.parentageAssertions,
    envelope.sources,
    parsed.state,
    locale,
  );
  const relation = parsed.state.relation && initialView.validRelationIds.has(parsed.state.relation)
    ? parsed.state.relation
    : "";
  const canonicalState = { ...parsed.state, relation };
  if (parsed.needsNormalization || relation !== parsed.state.relation) {
    permanentRedirect(lineageHref(locale, canonicalState) as Route);
  }

  const view = relation === parsed.state.relation
    ? initialView
    : buildStructuredLineageViewModel(
        envelope.data.nodes,
        envelope.data.parentageAssertions,
        envelope.sources,
        canonicalState,
        locale,
      );
  const coverage: PublicCoverage = view.hasPartialRecords
    ? {
        state: "partial",
        scope: "reviewed lineage scope containing partial identities, tentative assertions, or inaccessible sources",
      }
    : envelope.coverage;

  return (
    <StructuredLineagePage
      locale={locale}
      state={canonicalState}
      view={view}
      release={envelope.release}
      delivery={envelope.delivery}
      coverage={coverage}
      localeDelivery={envelope.locale}
    />
  );
}
