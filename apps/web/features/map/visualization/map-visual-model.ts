import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import { structuredMapHref, type StructuredMapQueryState } from "@/features/map/map-query";
import type {
  StructuredMapHabitatInput,
  StructuredMapResult,
  StructuredMapViewModel,
} from "@/features/map/map-view-model";
import type { PublicLocale } from "@/foundation/content/locales";

export interface MapVisualProperties {
  id: string;
  title: string;
  subtitle: string;
  kind: StructuredMapResult["kind"];
  precision: StructuredMapResult["precision"];
  status: StructuredMapResult["status"];
  sourceLabel: string;
  href: string;
}

export type MapVisualFeature = Feature<Geometry, MapVisualProperties>;

export interface OmittedMapVisualResult {
  id: string;
  title: string;
  reason: string;
}

export interface MapVisualizationModel {
  collection: FeatureCollection<Geometry, MapVisualProperties>;
  omitted: OmittedMapVisualResult[];
  visualizedCount: number;
  sourceState: StructuredMapHabitatInput["source"];
}

interface PublicVisualAnchor {
  coordinates: [number, number];
  precision: "locality";
  note: string;
}

const PUBLIC_VISUAL_ANCHORS: Readonly<Record<string, PublicVisualAnchor>> = {
  "60c7e1a3-d286-5366-8d41-32c11df58b5c": {
    coordinates: [103.13, 31.05],
    precision: "locality",
    note: "Wolong locality display anchor",
  },
  "89f620b2-37d0-51ba-aafa-6844404a5b2c": {
    coordinates: [103.13, 31.05],
    precision: "locality",
    note: "Wolong locality display anchor",
  },
  "afb0f227-dd5e-5076-88e3-74e9807a6049": {
    coordinates: [-77.05, 38.93],
    precision: "locality",
    note: "Washington, D.C. locality display anchor",
  },
};

function pointFeature(
  result: StructuredMapResult,
  anchor: PublicVisualAnchor,
  locale: PublicLocale,
  state: StructuredMapQueryState,
): MapVisualFeature {
  const geometry: Point = {
    type: "Point",
    coordinates: anchor.coordinates,
  };
  return {
    type: "Feature",
    id: result.id,
    geometry,
    properties: {
      id: result.id,
      title: result.title,
      subtitle: result.placeLabel,
      kind: result.kind,
      precision: result.precision,
      status: result.status,
      sourceLabel: `${result.sourceLabel} · ${anchor.note}`,
      href: structuredMapHref(locale, { ...state, selected: result.id }),
    },
  };
}

function wildFeature(
  result: StructuredMapResult,
  habitats: StructuredMapHabitatInput,
  locale: PublicLocale,
  state: StructuredMapQueryState,
): MapVisualFeature | null {
  const source = habitats.collection.features.find(
    (feature) => String(feature.id ?? "") === result.visualizationKey,
  );
  if (!source) return null;
  return {
    type: "Feature",
    id: result.id,
    geometry: source.geometry as unknown as Geometry,
    properties: {
      id: result.id,
      title: result.title,
      subtitle: result.placeLabel,
      kind: result.kind,
      precision: result.precision,
      status: result.status,
      sourceLabel: result.sourceLabel,
      href: structuredMapHref(locale, { ...state, selected: result.id }),
    },
  };
}

function omittedReason(result: StructuredMapResult, locale: PublicLocale): string {
  if (result.kind === "residency" && result.precision === "country") {
    return locale === "zh"
      ? "该驻留仅公开国家级精度，不渲染为机构点。"
      : "This residency is published only at country precision and is not rendered as a facility point.";
  }
  return locale === "zh"
    ? "当前公开发布没有足够的可视几何。"
    : "The current public release does not provide sufficient visual geometry.";
}

export function buildMapVisualizationModel(
  view: StructuredMapViewModel,
  habitats: StructuredMapHabitatInput,
  locale: PublicLocale,
  state: StructuredMapQueryState,
): MapVisualizationModel {
  const features: MapVisualFeature[] = [];
  const omitted: OmittedMapVisualResult[] = [];

  for (const result of view.results) {
    let feature: MapVisualFeature | null = null;
    if (result.kind === "conservation_area") {
      feature = wildFeature(result, habitats, locale, state);
    } else if (result.visualizationKey) {
      const anchor = PUBLIC_VISUAL_ANCHORS[result.visualizationKey];
      if (anchor) feature = pointFeature(result, anchor, locale, state);
    }

    if (feature) {
      features.push(feature);
    } else {
      omitted.push({ id: result.id, title: result.title, reason: omittedReason(result, locale) });
    }
  }

  return {
    collection: { type: "FeatureCollection", features },
    omitted,
    visualizedCount: features.length,
    sourceState: habitats.source,
  };
}
