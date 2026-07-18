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
    styleLicense: "Provider attribution and OpenStreetMap attribution must remain visible in any visual enhancement.",
    attribution: "© OpenStreetMap contributors · © CARTO",
    screenshotExportPolicy: "Any exported visual map must preserve the full provider attribution. Structured HTML exports do not include basemap imagery.",
    privacy: "The structured route does not request map tiles or expose precise wild-animal or individual coordinates to a tile provider.",
    snapshotPolicy: "External basemap styling is not part of the immutable PandaAtlas public-data snapshot.",
    failureBehavior: "Keep the structured result list, selection, precision, sources, and ordinary links fully usable when the optional visual provider fails.",
    activationPolicy: "Load MapLibre and request provider tiles only after an explicit user activation.",
    tileUrl: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    tileSize: 256,
    loadedByStructuredRoute: false,
  },
];

export const ACTIVE_STRUCTURED_MAP_PROVIDER = MAP_PROVIDER_REGISTRY[0];
