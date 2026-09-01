import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadCachedHabitatMapInput } from "@/features/map/cached-map-data-source";
import { parseStructuredMapQuery } from "@/features/map/map-query";
import { ACTIVE_STRUCTURED_MAP_PROVIDER } from "@/features/map/map-provider-registry";
import { loadPublishedMapDataset } from "@/features/map/map-public-release";
import { buildStructuredMapViewModel } from "@/features/map/map-view-model";
import { buildMapVisualizationModel } from "@/features/map/visualization/map-visual-model";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

import { pandaName, PrototypeShell } from "../prototype-kit";
import { PandaMapWorkspaceLoader } from "./panda-map-workspace-loader";
import type { PandaMapWorkspaceItem, PandaMapWorkspacePerson } from "./panda-map-workspace";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "ZhiPanda map prototype V0.7",
  robots: { index: false, follow: false },
};

export default async function FanV07Map({ params, searchParams }: Props) {
  const [{ locale: rawLocale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const atlas = loadPublishedAtlasDataset(locale);
  const mapEnvelope = loadPublishedMapDataset(locale);
  const habitatInput = loadCachedHabitatMapInput({ bbox: "73,18,136,54" });
  const mapState = parseStructuredMapQuery(rawSearchParams, mapEnvelope.release.id).state;
  const mapView = buildStructuredMapViewModel(mapEnvelope.data, mapEnvelope.sources, habitatInput, mapState, locale);
  const mapVisual = buildMapVisualizationModel(mapView, habitatInput, locale, mapState);
  const other = locale === "zh" ? "en" : "zh";
  const routeBase = `/${locale}/prototype/fan-v07/map`;

  const visualById = new Map(mapVisual.collection.features.map((feature) => [feature.properties.id, feature]));
  const atlasById = new Map(atlas.data.pandas.map((panda) => [panda.id, panda]));
  const mapPandaById = new Map(mapEnvelope.data.pandas.map((panda) => [panda.id, panda]));

  const personForId = (
    pandaId: string,
    relationship: PandaMapWorkspacePerson["relationship"],
  ): PandaMapWorkspacePerson | null => {
    const panda = atlasById.get(pandaId);
    if (panda) {
      return {
        id: panda.id,
        slug: panda.slug,
        name: pandaName(panda, locale),
        imageUrl: panda.cover_image_url ?? null,
        relationship,
      };
    }
    const mapPanda = mapPandaById.get(pandaId);
    if (!mapPanda) return null;
    return {
      id: mapPanda.id,
      slug: mapPanda.slug,
      name: locale === "zh" ? mapPanda.name_zh : mapPanda.name_en ?? mapPanda.name_zh,
      imageUrl: null,
      relationship,
    };
  };

  const workspaceItems: PandaMapWorkspaceItem[] = mapView.results.map((result) => {
    const visual = visualById.get(result.id) ?? null;
    const coordinate = visual?.geometry.type === "Point"
      ? [visual.geometry.coordinates[0], visual.geometry.coordinates[1]] as [number, number]
      : null;

    let people: PandaMapWorkspacePerson[] = [];
    let primaryHref = result.entityHref;
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (result.kind === "institution") {
      const facilityId = result.id.replace(/^institution:/, "");
      const currentIds = mapEnvelope.data.pandas
        .filter((panda) => panda.current_place?.facility_id === facilityId)
        .map((panda) => panda.id);
      const historicalIds = mapEnvelope.data.pandas
        .filter((panda) => panda.residencies.some((residency) => residency.facility_id === facilityId))
        .map((panda) => panda.id);
      const currentSet = new Set(currentIds);
      const currentPeople = currentIds.flatMap((id) => {
        const person = personForId(id, "current");
        return person ? [person] : [];
      });
      const historicalPeople = historicalIds
        .filter((id) => !currentSet.has(id))
        .flatMap((id) => {
          const person = personForId(id, "historical");
          return person ? [person] : [];
        });
      people = [...currentPeople, ...historicalPeople].slice(0, 8);
    }

    if (result.kind === "residency") {
      const [, pandaId = "", residencyId = ""] = result.id.split(":");
      const person = personForId(pandaId, result.status === "current" ? "current" : "historical");
      const residency = mapPandaById.get(pandaId)?.residencies.find((entry) => entry.id === residencyId) ?? null;
      people = person ? [person] : [];
      startDate = residency?.start_date ?? null;
      endDate = residency?.end_date ?? null;
      if (person) primaryHref = `/${locale}/prototype/fan-v07/panda/${person.slug}`;
    }

    return {
      id: result.id,
      title: result.title,
      subtitle: result.subtitle,
      placeLabel: result.placeLabel,
      statusDetail: result.statusDetail,
      dateRange: result.dateRange,
      startDate,
      endDate,
      status: result.status,
      kind: result.kind,
      coordinate,
      geometry: visual?.geometry ?? null,
      people,
      primaryHref,
    };
  });

  return (
    <PrototypeShell locale={locale} active="map" alternatePath={`/${other}/prototype/fan-v07/map`} immersive>
      <main>
        <PandaMapWorkspaceLoader
          key={`${mapState.mode}:${mapState.focus}:${mapState.selected}`}
          locale={locale}
          mode={mapState.mode}
          focus={mapState.focus}
          selectedId={mapView.selected?.id ?? ""}
          snapshot={mapEnvelope.release.id}
          routeBase={routeBase}
          items={workspaceItems}
          tileUrl={ACTIVE_STRUCTURED_MAP_PROVIDER.tileUrl}
          attribution={ACTIVE_STRUCTURED_MAP_PROVIDER.attribution}
        />
      </main>
    </PrototypeShell>
  );
}
