import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { FactConclusionStatus, JsonValue, PandaNameKind } from "./panda.application.js";

export interface PublicPandaName {
  languageTag: string;
  nameKind: PandaNameKind;
  value: string;
  isPrimary: boolean;
}

export interface PublicPandaFact {
  fieldKey: string;
  value?: JsonValue;
  status: Exclude<FactConclusionStatus, "superseded">;
  lastVerifiedOn: string;
  conclusionVersion: number;
}

export interface PandaPublicationSource {
  pandaId: string;
  canonicalSlug: string;
  legacySlugs: string[];
  names: PublicPandaName[];
  facts: PublicPandaFact[];
  evidenceSourceIds: string[];
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
}

export interface PandaPublicationPort {
  snapshot(transaction: DatabaseTransaction): Promise<PandaPublicationSource[]>;
}

export const PANDA_PUBLICATION_PORT = Symbol("PANDA_PUBLICATION_PORT");
