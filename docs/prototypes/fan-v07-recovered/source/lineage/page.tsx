/* eslint-disable @next/next/no-img-element -- prototype lineage uses release-provided panda media. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  loadPublishedAtlasDataset,
  loadPublishedLineageDataset,
  resolvePublishedPandaReference,
} from "@/features/public-content/public-release";
import {
  parseLineageQuery,
  type LineageFocusReference,
} from "@/features/lineage/lineage-query";
import { parsePublicLocale } from "@/foundation/content/locales";

import { PrototypeShell } from "../prototype-kit";
import { LineageUniverse } from "./lineage-universe";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "ZhiPanda lineage prototype V0.7",
  robots: { index: false, follow: false },
};

export default async function FanV07Lineage({ params, searchParams }: Props) {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedLineageDataset(locale);
  const atlas = loadPublishedAtlasDataset(locale);
  const imageById = new Map(atlas.data.pandas.map((panda) => {
    const available = panda.media.filter((asset) => asset.status === "available");
    const coverAsset = available.find((asset) =>
      asset.url === panda.cover_image_url
      || asset.derivatives.some((derivative) => derivative.url === panda.cover_image_url),
    ) ?? null;
    const asset = coverAsset ?? available[0] ?? null;
    const derivative = asset?.derivatives
      .filter((item) => item.width >= 480)
      .sort((left, right) => right.width - left.width)[0]
      ?? asset?.derivatives[0]
      ?? null;
    return [panda.id, panda.cover_image_url ?? derivative?.url ?? asset?.url ?? null] as const;
  }));
  const lineageNodes = envelope.data.nodes.map((node) => ({
    ...node,
    cover_image_url: imageById.get(node.id) ?? node.cover_image_url,
  }));

  const fallback = lineageNodes.find((node) => node.slug === "mei-xiang")
    ?? envelope.data.nodes.find((node) => node.profile_available)
    ?? envelope.data.nodes[0];
  if (!fallback) notFound();

  const defaultFocus: LineageFocusReference = { id: fallback.id, slug: fallback.slug };
  const resolveFocus = (input: string): LineageFocusReference | null => {
    const published = resolvePublishedPandaReference(input);
    if (published && lineageNodes.some((node) => node.id === published.id)) return published;
    const direct = lineageNodes.find((node) => node.id === input || node.slug === input);
    return direct ? { id: direct.id, slug: direct.slug } : null;
  };

  const parsed = parseLineageQuery(rawSearch, resolveFocus, defaultFocus);
  const initialState = { ...parsed.state, relation: "" };
  const other = locale === "zh" ? "en" : "zh";
  const alternate = new URLSearchParams({ focus: initialState.focusSlug });
  if (initialState.ancestorDepth !== 2) alternate.set("ancestors", String(initialState.ancestorDepth));
  if (initialState.descendantDepth !== 2) alternate.set("descendants", String(initialState.descendantDepth));

  return (
    <PrototypeShell
      locale={locale}
      active="families"
      alternatePath={`/${other}/prototype/fan-v07/lineage?${alternate}`}
    >
      <LineageUniverse
        locale={locale}
        initialState={initialState}
        nodes={lineageNodes}
        assertions={envelope.data.parentageAssertions}
        sources={envelope.sources}
      />
    </PrototypeShell>
  );
}
