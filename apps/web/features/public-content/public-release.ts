import type {
  PandaDetail,
  PandaLineageResponse,
  PublicFacilitySummary,
  PublicInstitutionSummary,
  PublicParentageAssertionSummary,
  PublicPlaceSummary,
  PublicSourceSummary,
} from "@/lib/types";
import type { PublicLocale } from "@/foundation/content/locales";

export type PublicDeliveryState = "live" | "cached" | "partial" | "unavailable";
export type PublicCoverageState = "complete" | "partial" | "none";
export type PublicTranslationState = "reviewed" | "missing";

export interface PublicReleaseIdentity {
  id: string;
  schemaVersion: string;
}

export interface PublicDelivery {
  state: PublicDeliveryState;
  label: "versioned-local-public-release" | "generated-v2-public-read";
  lastSuccessfulAt: string | null;
}

export interface PublicCoverage {
  state: PublicCoverageState;
  scope: string;
}

export interface PublicLocaleDelivery {
  requested: PublicLocale;
  available: PublicLocale[];
  translation: PublicTranslationState;
}

export interface PublicContentEnvelope<T> {
  data: T;
  release: PublicReleaseIdentity;
  delivery: PublicDelivery;
  coverage: PublicCoverage;
  locale: PublicLocaleDelivery;
  sources: PublicSourceSummary[];
}

export interface PublicAtlasDataset {
  pandas: PandaDetail[];
  facilities: PublicFacilitySummary[];
  institutions: PublicInstitutionSummary[];
  places: PublicPlaceSummary[];
}

export interface PublicMapDataset {
  pandas: PandaDetail[];
  facilities: PublicFacilitySummary[];
  institutions: PublicInstitutionSummary[];
  places: PublicPlaceSummary[];
}

export interface PublicLineageDataset {
  nodes: PandaLineageResponse["nodes"];
  parentageAssertions: PublicParentageAssertionSummary[];
}

export interface PublicProfileRecord {
  panda: PandaDetail;
  institutions: PublicInstitutionSummary[];
  places: PublicPlaceSummary[];
  facilities: PublicFacilitySummary[];
  lineage: PandaLineageResponse;
  parentageAssertions: PublicParentageAssertionSummary[];
}

export interface PublicPlaceRecord {
  place: PublicPlaceSummary;
  institutions: PublicInstitutionSummary[];
  pandas: PandaDetail[];
}
