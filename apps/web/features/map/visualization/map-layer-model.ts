import type { FilterSpecification, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import { MAP_VISUAL_SOURCE_ID } from "@/features/map/visualization/map-provider-adapter";

export const MAP_INTERACTIVE_LAYER_IDS = [
  "panda-atlas-result-points",
  "panda-atlas-result-polygons",
] as const;

const layers: LayerSpecification[] = [
  {
    id: "panda-atlas-result-polygons",
    type: "fill",
    source: MAP_VISUAL_SOURCE_ID,
    filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
    paint: {
      "fill-color": [
        "case",
        ["==", ["get", "kind"], "conservation_area"],
        "#52745A",
        "#BE8A4A",
      ],
      "fill-opacity": 0.25,
    },
  },
  {
    id: "panda-atlas-result-polygon-outline",
    type: "line",
    source: MAP_VISUAL_SOURCE_ID,
    filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
    paint: {
      "line-color": "#35533C",
      "line-width": 1.8,
      "line-opacity": 0.88,
    },
  },
  {
    id: "panda-atlas-result-points",
    type: "circle",
    source: MAP_VISUAL_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": [
        "case",
        ["==", ["get", "kind"], "residency"],
        7,
        8.5,
      ],
      "circle-color": [
        "case",
        ["==", ["get", "status"], "historical"],
        "#8A8174",
        ["==", ["get", "kind"], "residency"],
        "#477D9E",
        "#C47D35",
      ],
      "circle-stroke-color": "#FFFDF8",
      "circle-stroke-width": 2,
      "circle-opacity": 0.96,
    },
  },
  {
    id: "panda-atlas-selected-polygon",
    type: "line",
    source: MAP_VISUAL_SOURCE_ID,
    filter: ["==", ["get", "id"], ""],
    paint: {
      "line-color": "#A55D1D",
      "line-width": 4,
      "line-opacity": 1,
    },
  },
  {
    id: "panda-atlas-selected-point-glow",
    type: "circle",
    source: MAP_VISUAL_SOURCE_ID,
    filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "id"], ""]],
    paint: {
      "circle-radius": 18,
      "circle-color": "rgba(178, 99, 28, 0.18)",
      "circle-stroke-color": "#A55D1D",
      "circle-stroke-width": 2.5,
    },
  },
];

export function installMapResultLayers(map: MapLibreMap): void {
  for (const layer of layers) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  }
}

export function synchronizeSelectedMapLayers(map: MapLibreMap, selectedId: string): void {
  const filter: FilterSpecification = ["==", ["get", "id"], selectedId || ""];
  if (map.getLayer("panda-atlas-selected-polygon")) {
    map.setFilter("panda-atlas-selected-polygon", filter);
  }
  if (map.getLayer("panda-atlas-selected-point-glow")) {
    const pointFilter: FilterSpecification = [
      "all",
      ["==", ["geometry-type"], "Point"],
      ["==", ["get", "id"], selectedId || ""],
    ];
    map.setFilter("panda-atlas-selected-point-glow", pointFilter);
  }
}
