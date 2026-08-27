import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { PlaceType } from "./places.application.js";

export interface InstitutionPublicationSource {
  institutionId: string;
  slug: string;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
}

export interface PlacePublicationSource {
  placeId: string;
  institutionId?: string;
  slug: string;
  placeType: PlaceType;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
  region?: string;
  longitude?: number;
  latitude?: number;
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
}

export interface PlacesPublicationSnapshot {
  institutions: InstitutionPublicationSource[];
  places: PlacePublicationSource[];
}

export interface PlacesPublicationPort {
  snapshot(transaction: DatabaseTransaction): Promise<PlacesPublicationSnapshot>;
}

export const PLACES_PUBLICATION_PORT = Symbol("PLACES_PUBLICATION_PORT");
