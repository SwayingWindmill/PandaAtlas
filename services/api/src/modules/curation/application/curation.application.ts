import type { EvidencePort } from "../../evidence/application/evidence.application.js";
import type { PandaReferencePort } from "../../panda/application/panda.application.js";

export type CurationJsonValue =
  | string
  | number
  | boolean
  | null
  | CurationJsonValue[]
  | { [key: string]: CurationJsonValue };

export interface ReviewCurationAssertionInput {
  assertionKey: string;
  fieldKey: string;
  value: CurationJsonValue;
  certainty: "confirmed" | "provisional";
  lastVerifiedOn: string;
  sourceIds: string[];
}

export interface ReviewCurationRecommendationInput {
  reviewCaseId: string;
  decisionId: string;
  submissionId: string;
  revisionNumber: number;
  targetPandaId: string;
  recommendedByAccountId: string;
  reason: string;
  assertions: ReviewCurationAssertionInput[];
}

export type CurationOwnerModule = "panda" | "lineage" | "life_history";
export type CurationOwnerOperation =
  | "fact.propose"
  | "fact.corroborate"
  | "fact.dispute"
  | "name.add"
  | "name.corroborate"
  | "external_identifier.add"
  | "external_identifier.corroborate"
  | "parentage.create"
  | "residency.create"
  | "event.create";

export interface AcquisitionCurationChangeInput {
  candidateId: string;
  ownerModule: CurationOwnerModule;
  operation: CurationOwnerOperation;
  payload: { [key: string]: CurationJsonValue };
  lastVerifiedOn: string;
  sourceIds: string[];
}

export interface AcquisitionCurationRecommendationInput {
  acquisitionBundleId: string;
  pipelineArtifactId: string;
  targetPandaId: string;
  recommendedByAccountId: string;
  reason: string;
  changes: AcquisitionCurationChangeInput[];
}

export interface CurationPandaFactChange {
  changeId: string;
  assertionKey: string;
  fieldKey: string;
  value: CurationJsonValue;
  certainty: "confirmed" | "provisional";
  lastVerifiedOn: string;
  sourceIds: string[];
  appliedAssertionId?: string;
}

export interface CurationOwnerChange {
  changeId: string;
  candidateId: string;
  ownerModule: CurationOwnerModule;
  operation: CurationOwnerOperation;
  payload: { [key: string]: CurationJsonValue };
  lastVerifiedOn: string;
  sourceIds: string[];
  appliedReference?: string;
}

export interface CurationChangeSet {
  changeSetId: string;
  originKind: "review" | "acquisition";
  reviewCaseId?: string;
  decisionId?: string;
  submissionId?: string;
  revisionNumber?: number;
  acquisitionBundleId?: string;
  pipelineArtifactId?: string;
  targetPandaId: string;
  state: "draft" | "validated" | "approved" | "applied" | "rejected";
  version: number;
  reason: string;
  createdByAccountId: string;
  validatedByAccountId?: string;
  approvedByAccountId?: string;
  changes: CurationPandaFactChange[];
  ownerChanges: CurationOwnerChange[];
}

export interface CurationRepository {
  createFromReview(input: ReviewCurationRecommendationInput): Promise<CurationChangeSet>;
  createFromAcquisition(input: AcquisitionCurationRecommendationInput): Promise<CurationChangeSet>;
  get(changeSetId: string): Promise<CurationChangeSet | undefined>;
  markValidated(changeSetId: string, actorAccountId: string): Promise<CurationChangeSet | undefined>;
}

export interface CurationApplyCoordinator {
  approveAndApply(
    changeSetId: string,
    actorAccountId: string,
    reason: string,
  ): Promise<CurationChangeSet | undefined>;
}

export interface CurationIntakePort {
  acceptReviewRecommendation(input: ReviewCurationRecommendationInput): Promise<CurationChangeSet>;
  acceptAcquisitionRecommendation(
    input: AcquisitionCurationRecommendationInput,
  ): Promise<CurationChangeSet>;
}

export interface CurationPort extends CurationIntakePort {
  get(changeSetId: string): Promise<CurationChangeSet | undefined>;
  validate(changeSetId: string, actorAccountId: string): Promise<CurationValidationResult>;
  approveAndApply(changeSetId: string, actorAccountId: string, reason: string): Promise<CurationApplyResult>;
}

export type CurationValidationResult =
  | { kind: "not_found" }
  | { kind: "invalid"; reason: string }
  | { kind: "validated"; changeSet: CurationChangeSet };

export type CurationApplyResult =
  | { kind: "not_found" }
  | { kind: "not_ready" }
  | { kind: "approval_conflict" }
  | { kind: "applied"; changeSet: CurationChangeSet };

export const CURATION_REPOSITORY = Symbol("CURATION_REPOSITORY");
export const CURATION_APPLY_COORDINATOR = Symbol("CURATION_APPLY_COORDINATOR");
export const CURATION_INTAKE_PORT = Symbol("CURATION_INTAKE_PORT");
export const CURATION_PORT = Symbol("CURATION_PORT");

function uniqueCandidateIds(changes: AcquisitionCurationChangeInput[]): boolean {
  return new Set(changes.map((change) => change.candidateId)).size === changes.length;
}

export class CurationApplication implements CurationPort {
  public constructor(
    private readonly repository: CurationRepository,
    private readonly applyCoordinator: CurationApplyCoordinator,
    private readonly pandas: PandaReferencePort,
    private readonly evidence: EvidencePort,
  ) {}

  public acceptReviewRecommendation(input: ReviewCurationRecommendationInput): Promise<CurationChangeSet> {
    if (input.assertions.length === 0) {
      throw new Error("Curation intake requires at least one recommended assertion");
    }
    return this.repository.createFromReview(input);
  }

  public acceptAcquisitionRecommendation(
    input: AcquisitionCurationRecommendationInput,
  ): Promise<CurationChangeSet> {
    if (input.changes.length === 0) {
      throw new Error("Acquisition Curation intake requires at least one reviewed candidate");
    }
    if (!uniqueCandidateIds(input.changes)) {
      throw new Error("Acquisition Curation intake contains duplicate candidate IDs");
    }
    if (input.changes.some((change) => change.sourceIds.length === 0)) {
      throw new Error("Every acquisition Curation change requires at least one evidence source");
    }
    return this.repository.createFromAcquisition(input);
  }

  public get(changeSetId: string): Promise<CurationChangeSet | undefined> {
    return this.repository.get(changeSetId);
  }

  public async validate(changeSetId: string, actorAccountId: string): Promise<CurationValidationResult> {
    const changeSet = await this.repository.get(changeSetId);
    if (changeSet === undefined) return { kind: "not_found" };
    if (changeSet.state !== "draft") {
      return changeSet.state === "validated"
        ? { kind: "validated", changeSet }
        : { kind: "invalid", reason: "Only draft Curation change sets can be validated." };
    }
    if (!(await this.pandas.exists(changeSet.targetPandaId))) {
      return { kind: "invalid", reason: "The target Panda does not exist." };
    }
    const sourceIds = new Set([
      ...changeSet.changes.flatMap((change) => change.sourceIds),
      ...changeSet.ownerChanges.flatMap((change) => change.sourceIds),
    ]);
    for (const sourceId of sourceIds) {
      if ((await this.evidence.getSource(sourceId)) === undefined) {
        return { kind: "invalid", reason: `Evidence source ${sourceId} does not exist.` };
      }
    }
    const validated = await this.repository.markValidated(changeSetId, actorAccountId);
    return validated === undefined
      ? { kind: "invalid", reason: "The Curation change set is no longer a draft." }
      : { kind: "validated", changeSet: validated };
  }

  public async approveAndApply(
    changeSetId: string,
    actorAccountId: string,
    reason: string,
  ): Promise<CurationApplyResult> {
    const current = await this.repository.get(changeSetId);
    if (current === undefined) return { kind: "not_found" };
    if (current.state === "applied") return { kind: "applied", changeSet: current };
    if (current.state !== "validated") return { kind: "not_ready" };
    if (current.createdByAccountId === actorAccountId) return { kind: "approval_conflict" };
    const applied = await this.applyCoordinator.approveAndApply(changeSetId, actorAccountId, reason);
    return applied === undefined ? { kind: "not_ready" } : { kind: "applied", changeSet: applied };
  }
}
