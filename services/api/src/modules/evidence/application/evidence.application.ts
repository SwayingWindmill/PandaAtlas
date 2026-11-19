export type EvidenceAccessState =
  | "accessible"
  | "redirected"
  | "changed"
  | "unavailable"
  | "archived"
  | "restricted";

export interface EvidenceSource {
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
  internalNotes?: string;
  contentSha256?: string;
}

export type CreateEvidenceSourceInput = EvidenceSource;

export interface UpdateEvidenceVerificationInput {
  sourceId: string;
  lastVerifiedOn: string;
  accessState: EvidenceAccessState;
  publicSummary?: string;
  internalNotes?: string;
  contentSha256?: string;
}

export interface EvidenceRepository {
  createSource(input: CreateEvidenceSourceInput): Promise<EvidenceSource>;
  getSource(sourceId: string): Promise<EvidenceSource | undefined>;
  updateVerification(input: UpdateEvidenceVerificationInput): Promise<EvidenceSource>;
}

export type EvidencePort = EvidenceRepository;

export const EVIDENCE_PORT = Symbol("EVIDENCE_PORT");
