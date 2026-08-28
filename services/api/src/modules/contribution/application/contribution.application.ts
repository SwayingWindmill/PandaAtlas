export type ContributionSubmissionType = "correction" | "sourced_information";
export type ContributionSourceKind = "url" | "publication" | "document" | "other";
export type ContributionCertainty = "confirmed" | "provisional";

export type ContributionJsonValue =
  | string
  | number
  | boolean
  | null
  | ContributionJsonValue[]
  | { [key: string]: ContributionJsonValue };

export interface ContributionAssertionInput {
  assertionKey: string;
  fieldKey: string;
  value: ContributionJsonValue;
  certainty: ContributionCertainty;
  lastVerifiedOn: string;
  sourceKeys: string[];
}

export interface ContributionReviewAssertion {
  assertionKey: string;
  fieldKey: string;
  value: ContributionJsonValue;
  certainty: ContributionCertainty;
  lastVerifiedOn: string;
  sourceIds: string[];
}

export interface ContributionSourceInput {
  sourceKey: string;
  sourceKind: ContributionSourceKind;
  title: string;
  locator: string;
  publisher?: string;
  publishedOn?: string;
}

export interface SubmitContributionInput {
  accountId: string;
  submissionType: ContributionSubmissionType;
  targetPandaId: string;
  publicVersionSeen: string;
  assertions: ContributionAssertionInput[];
  sources: ContributionSourceInput[];
  correlationId: string;
}

export interface ContributionRecord {
  submissionId: string;
  submissionType: ContributionSubmissionType;
  targetPandaId: string;
  publicVersionSeen: string;
  revisionNumber: number;
  status: string;
  submittedAt: Date;
}

export interface ContributionSourceRecord extends Omit<ContributionSourceInput, "sourceKey"> {
  sourceId: string;
}

export interface ContributionAttachmentRecord {
  attachmentId: string;
  mediaType: string;
  byteSize: number;
  state: string;
}

export interface ContributionReviewSurface {
  submissionId: string;
  contributorAccountId?: string;
  targetPandaId: string;
  revisionNumber: number;
  publicVersionSeen: string;
  assertions: ContributionReviewAssertion[];
  sources: ContributionSourceRecord[];
  attachments: ContributionAttachmentRecord[];
}

export interface RegisterContributionAttachmentInput {
  accountId: string;
  submissionId: string;
  storageObjectKey: string;
  objectVersion: string;
  originalFilename: string;
  mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  contentSha256: string;
}

export interface ContributionRepository {
  submit(input: SubmitContributionInput): Promise<ContributionRecord>;
  listOwn(accountId: string): Promise<ContributionRecord[]>;
  getOwn(accountId: string, submissionId: string): Promise<ContributionRecord | undefined>;
  getReviewSurface(submissionId: string): Promise<ContributionReviewSurface | undefined>;
  registerAttachment(input: RegisterContributionAttachmentInput): Promise<ContributionAttachmentRecord | undefined>;
}

export interface ContributionReviewPort {
  getReviewSurface(submissionId: string): Promise<ContributionReviewSurface | undefined>;
}

export type ContributionPort = ContributionRepository;

export const CONTRIBUTION_REPOSITORY = Symbol("CONTRIBUTION_REPOSITORY");
export const CONTRIBUTION_PORT = Symbol("CONTRIBUTION_PORT");
export const CONTRIBUTION_REVIEW_PORT = Symbol("CONTRIBUTION_REVIEW_PORT");

export class ContributionApplication implements ContributionPort, ContributionReviewPort {
  public constructor(private readonly repository: ContributionRepository) {}

  public submit(input: SubmitContributionInput): Promise<ContributionRecord> {
    if (input.assertions.length === 0) {
      throw new Error("A contribution requires at least one assertion");
    }
    if (input.sources.length === 0) {
      throw new Error("A contribution requires at least one source");
    }
    const keys = input.assertions.map((assertion) => assertion.assertionKey);
    if (new Set(keys).size !== keys.length) {
      throw new Error("Contribution assertion keys must be unique within a revision");
    }
    const sourceKeys = input.sources.map((source) => source.sourceKey);
    if (new Set(sourceKeys).size !== sourceKeys.length) {
      throw new Error("Contribution source keys must be unique within a revision");
    }
    const knownSourceKeys = new Set(sourceKeys);
    if (
      input.assertions.some(
        (assertion) =>
          assertion.sourceKeys.length === 0 ||
          assertion.sourceKeys.some((sourceKey) => !knownSourceKeys.has(sourceKey)),
      )
    ) {
      throw new Error("Every contribution assertion must reference known sources");
    }
    return this.repository.submit(input);
  }

  public listOwn(accountId: string): Promise<ContributionRecord[]> {
    return this.repository.listOwn(accountId);
  }

  public getOwn(accountId: string, submissionId: string): Promise<ContributionRecord | undefined> {
    return this.repository.getOwn(accountId, submissionId);
  }

  public getReviewSurface(submissionId: string): Promise<ContributionReviewSurface | undefined> {
    return this.repository.getReviewSurface(submissionId);
  }

  public registerAttachment(input: RegisterContributionAttachmentInput): Promise<ContributionAttachmentRecord | undefined> {
    return this.repository.registerAttachment(input);
  }
}
