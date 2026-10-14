import type { PandaReferencePort } from "../../panda/application/panda.application.js";
import { DomainError } from "../../../platform/errors/domain-error.js";

export type ParentRole = "father" | "mother";
export type ParentageStatus = "confirmed" | "tentative" | "disputed" | "superseded";

export interface ParentageAssertion {
  assertionId: string;
  childId: string;
  parentId: string;
  parentRole: ParentRole;
  status: ParentageStatus;
  reviewedAt?: string;
  sourceIds: string[];
}

export interface LineageFamily {
  assertions: ParentageAssertion[];
  parentIds: string[];
  childIds: string[];
  siblingIds: string[];
}

export interface LineageRepository {
  createAssertion(input: ParentageAssertion): Promise<ParentageAssertion>;
  setAssertionStatus(assertionId: string, status: ParentageStatus, reviewedAt?: string): Promise<void>;
  getFamily(pandaId: string): Promise<LineageFamily>;
}

export type LineagePort = LineageRepository;

export const LINEAGE_REPOSITORY = Symbol("LINEAGE_REPOSITORY");
export const LINEAGE_PORT = Symbol("LINEAGE_PORT");

export class LineageApplication implements LineagePort {
  public constructor(
    private readonly repository: LineageRepository,
    private readonly pandas: PandaReferencePort,
  ) {}

  public async createAssertion(input: ParentageAssertion): Promise<ParentageAssertion> {
    if (input.childId === input.parentId) {
      throw new DomainError("invalid", "lineage.selfParent", "A panda cannot be its own parent.");
    }
    if (!(await this.pandas.exists(input.childId))) {
      throw new DomainError("not_found", "lineage.pandaNotFound", `Unknown child panda ${input.childId}.`);
    }
    if (!(await this.pandas.exists(input.parentId))) {
      throw new DomainError("not_found", "lineage.pandaNotFound", `Unknown parent panda ${input.parentId}.`);
    }
    if (input.sourceIds.length === 0) {
      throw new DomainError("invalid", "lineage.evidenceRequired", "Parentage assertions require at least one evidence source.");
    }
    return this.repository.createAssertion(input);
  }

  public setAssertionStatus(
    assertionId: string,
    status: ParentageStatus,
    reviewedAt?: string,
  ): Promise<void> {
    return this.repository.setAssertionStatus(assertionId, status, reviewedAt);
  }

  public async getFamily(pandaId: string): Promise<LineageFamily> {
    if (!(await this.pandas.exists(pandaId))) {
      throw new DomainError("not_found", "lineage.pandaNotFound", `Unknown panda ${pandaId}.`);
    }
    return this.repository.getFamily(pandaId);
  }
}
