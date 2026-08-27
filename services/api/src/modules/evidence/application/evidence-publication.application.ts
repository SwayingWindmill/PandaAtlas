import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { EvidenceAccessState } from "./evidence.application.js";

export interface EvidencePublicationSource {
  sourceId: string;
  publisher: string;
  title: string;
  url: string;
  publishedOn?: string;
  lastVerifiedOn: string;
  languageTag: string;
  accessState: EvidenceAccessState;
  evidenceTier?: string;
  publicSummary?: string;
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
}

export interface EvidencePublicationPort {
  snapshot(transaction: DatabaseTransaction): Promise<EvidencePublicationSource[]>;
}

export const EVIDENCE_PUBLICATION_PORT = Symbol("EVIDENCE_PUBLICATION_PORT");
