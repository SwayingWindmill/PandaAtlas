import type { JsonValue } from "../../panda/application/panda.application.js";

export interface PublicReadRelease {
  releaseId: string;
  version: string;
}

export interface PublicPandaSummary {
  pandaId: string;
  canonicalSlug: string;
  legacySlugs: string[];
  names: Array<{
    languageTag: string;
    nameKind: string;
    value: string;
    isPrimary: boolean;
  }>;
  facts: Array<{
    fieldKey: string;
    value?: JsonValue;
    status: string;
    lastVerifiedOn: string;
    conclusionVersion: number;
  }>;
}

export interface PublicPlaceSummary {
  placeId: string;
  institutionId?: string;
  slug: string;
  placeType: string;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
  region?: string;
  longitude?: number;
  latitude?: number;
}

export interface PublicEvidenceSummary {
  sourceId: string;
  publisher: string;
  title: string;
  url: string;
  publishedOn?: string;
  lastVerifiedOn: string;
  languageTag: string;
  accessState: string;
  evidenceTier?: string;
  publicSummary?: string;
}

export interface PublicMediaSummary {
  assetId: string;
  pandaId: string;
  sourceId?: string;
  usageRole: string;
  displayOrder: number;
  objectKey: string;
  contentSha256: string;
  mediaType: string;
  title?: string;
  creator?: string;
  copyrightText?: string;
  license?: string;
  attributionText?: string;
  takenAt?: string;
}

export interface PublicLineageSummary {
  assertionId: string;
  childId: string;
  parentId: string;
  parentRole: string;
  sourceIds: string[];
}

export interface PublicResidencySummary {
  residencyId: string;
  pandaId: string;
  placeId: string;
  residencyType: string;
  startOn?: string;
  startPrecision: string;
  endOn?: string;
  endPrecision?: string;
  status: string;
  sourceIds: string[];
}

export interface PublicLifeEventSummary {
  eventId: string;
  eventType: string;
  eventStatus: string;
  occurredOn?: string;
  occurredPrecision: string;
  fromPlaceId?: string;
  toPlaceId?: string;
  summary?: string;
  participantIds: string[];
  sourceIds: string[];
}

export interface PublicStats {
  pandaCount: number;
  institutionCount: number;
  placeCount: number;
  lineageCount: number;
  residencyCount: number;
  lifeEventCount: number;
  mediaCount: number;
  evidenceSourceCount: number;
}

export interface PublicPandaDetail {
  release: PublicReadRelease;
  panda: PublicPandaSummary;
  lineage: PublicLineageSummary[];
  residencies: PublicResidencySummary[];
  events: PublicLifeEventSummary[];
  media: PublicMediaSummary[];
  evidence: PublicEvidenceSummary[];
}

export type PublicReadResult<T> =
  | { kind: "unavailable" }
  | { kind: "not_found" }
  | { kind: "ok"; value: T };

export interface PublicReadPort {
  currentRelease(): Promise<PublicReadResult<PublicReadRelease>>;
  listPandas(): Promise<PublicReadResult<{ release: PublicReadRelease; items: PublicPandaSummary[] }>>;
  getPanda(slug: string): Promise<PublicReadResult<PublicPandaDetail>>;
  listPlaces(): Promise<PublicReadResult<{ release: PublicReadRelease; items: PublicPlaceSummary[] }>>;
  getPlace(slug: string): Promise<PublicReadResult<{ release: PublicReadRelease; place: PublicPlaceSummary }>>;
  listLineage(): Promise<PublicReadResult<{ release: PublicReadRelease; items: PublicLineageSummary[] }>>;
  listResidencies(): Promise<PublicReadResult<{ release: PublicReadRelease; items: PublicResidencySummary[] }>>;
  listLifeEvents(): Promise<PublicReadResult<{ release: PublicReadRelease; items: PublicLifeEventSummary[] }>>;
  getEvidence(sourceId: string): Promise<PublicReadResult<{ release: PublicReadRelease; source: PublicEvidenceSummary }>>;
  stats(): Promise<PublicReadResult<{ release: PublicReadRelease; stats: PublicStats }>>;
}

export const PUBLIC_READ_PORT = Symbol("PUBLIC_READ_PORT");
