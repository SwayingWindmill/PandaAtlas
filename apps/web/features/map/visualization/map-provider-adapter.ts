import type { StyleSpecification } from "maplibre-gl";
import { ACTIVE_STRUCTURED_MAP_PROVIDER } from "@/features/map/map-provider-registry";
import type { MapVisualizationModel } from "@/features/map/visualization/map-visual-model";

export const MAP_VISUAL_SOURCE_ID = "panda-atlas-results";

export function createMapProviderStyle(model: MapVisualizationModel): StyleSpecification {
  const provider = ACTIVE_STRUCTURED_MAP_PROVIDER;
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [provider.tileUrl],
        tileSize: provider.tileSize,
        attribution: provider.attribution,
      },
      [MAP_VISUAL_SOURCE_ID]: {
        type: "geojson",
        data: model.collection,
      },
    },
    layers: [
      {
        id: "panda-atlas-basemap",
        type: "raster",
        source: "basemap",
        paint: {
          "raster-saturation": -0.35,
          "raster-contrast": 0.04,
          "raster-brightness-min": 0.08,
          "raster-brightness-max": 0.98,
        },
      },
    ],
  };
}

export function mapProviderAttribution(): string {
  return ACTIVE_STRUCTURED_MAP_PROVIDER.attribution;
}
