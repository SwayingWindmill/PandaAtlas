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

export interface EvidenceAttachment {
  attachmentId: string;
  sourceId: string;
  storageBucket: string;
  storageKey: string;
  objectVersion: string;
  contentSha256: string;
  byteSize: number;
  mediaType: string;
}

export type CreateEvidenceAttachmentInput = Omit<EvidenceAttachment, "attachmentId">;

export interface EvidenceRepository {
  createSource(input: CreateEvidenceSourceInput): Promise<EvidenceSource>;
  getSource(sourceId: string): Promise<EvidenceSource | undefined>;
  updateVerification(input: UpdateEvidenceVerificationInput): Promise<EvidenceSource>;
  addAttachment(input: CreateEvidenceAttachmentInput): Promise<EvidenceAttachment>;
}

export type EvidencePort = EvidenceRepository;

export const EVIDENCE_REPOSITORY = Symbol("EVIDENCE_REPOSITORY");
export const EVIDENCE_PORT = Symbol("EVIDENCE_PORT");

export class EvidenceApplication implements EvidencePort {
  public constructor(private readonly repository: EvidenceRepository) {}

  public createSource(input: CreateEvidenceSourceInput): Promise<EvidenceSource> {
    return this.repository.createSource(input);
  }

  public getSource(sourceId: string): Promise<EvidenceSource | undefined> {
    return this.repository.getSource(sourceId);
  }

  public updateVerification(input: UpdateEvidenceVerificationInput): Promise<EvidenceSource> {
    return this.repository.updateVerification(input);
  }

  public addAttachment(input: CreateEvidenceAttachmentInput): Promise<EvidenceAttachment> {
    return this.repository.addAttachment(input);
  }
}
