import type {
  CompleteGeoJsonFeatureCollection,
  HabitatFeatureProperties,
} from "@/lib/types";

export interface CachedHabitatPublicRelease {
  id: string;
  snapshotDate: string;
  coverage: "partial";
  precision: "province";
  sourceState: "reviewed-cached-release";
  data: CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>;
}

export const CACHED_HABITAT_PUBLIC_RELEASE: CachedHabitatPublicRelease = {
  id: "habitat-public-release-2026-03-05",
  snapshotDate: "2026-03-05",
  coverage: "partial",
  precision: "province",
  sourceState: "reviewed-cached-release",
  data: {
    type: "FeatureCollection",
    meta: {
      truncated: false,
      limit: 2000,
      requested_zoom: null,
    },
    features: [
      {
        type: "Feature",
        id: "habitat-001",
        geometry: {
          type: "MultiPolygon",
          coordinates: [[[[103.2, 30.9], [104, 30.9], [104, 31.7], [103.2, 31.7], [103.2, 30.9]]]],
        },
        properties: {
          name: "岷山片区",
          province: "四川",
          level: "national",
        },
      },
    ],
  },
};
