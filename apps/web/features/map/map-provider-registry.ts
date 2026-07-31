export interface MapProviderRegistryEntry {
  id: string;
  baseMapProvider: string;
  styleLicense: string;
  attribution: string;
  screenshotExportPolicy: string;
  privacy: string;
  snapshotPolicy: string;
  failureBehavior: string;
  activationPolicy: string;
  tileUrl: string;
  tileSize: number;
  loadedByStructuredRoute: boolean;
}

export const MAP_PROVIDER_REGISTRY: readonly MapProviderRegistryEntry[] = [
  {
    id: "carto-light-raster",
    baseMapProvider: "CARTO raster tiles with OpenStreetMap data",
    styleLicense: "CARTO and OpenStreetMap attribution must remain visible whenever the live map is shown.",
    attribution: "© OpenStreetMap contributors · © CARTO",
    screenshotExportPolicy: "Any shared or exported live-map image must preserve the full provider attribution. List-only views do not include basemap imagery.",
    privacy: "Before the live map is opened, ZhiPanda does not request map tiles or expose precise wild-animal or individual coordinates to the map provider.",
    snapshotPolicy: "External basemap styling is not part of the immutable ZhiPanda public-data snapshot.",
    failureBehavior: "Keep the explore list, selection, location precision, sources, and ordinary links fully usable when the live map fails.",
    activationPolicy: "Load MapLibre and request provider tiles only after an explicit user activation.",
    tileUrl: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    tileSize: 256,
    loadedByStructuredRoute: false,
  },
];

export const ACTIVE_STRUCTURED_MAP_PROVIDER = MAP_PROVIDER_REGISTRY[0];
