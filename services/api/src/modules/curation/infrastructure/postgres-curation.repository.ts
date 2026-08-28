import { sql } from "kysely";
import type {
  DatabaseService,
  DatabaseTransaction,
} from "../../../platform/database/database.service.js";
import type {
  AcquisitionCurationRecommendationInput,
  CurationChangeSet,
  CurationJsonValue,
  CurationOwnerChange,
  CurationOwnerModule,
  CurationOwnerOperation,
  CurationPandaFactChange,
  CurationRepository,
  ReviewCurationRecommendationInput,
} from "../application/curation.application.js";

function jsonValue(value: unknown): CurationJsonValue {
  return value as CurationJsonValue;
}

function jsonObject(value: unknown): { [key: string]: CurationJsonValue } {
  return value as { [key: string]: CurationJsonValue };
}

function state(value: string): CurationChangeSet["state"] {
  if (
    value === "draft" ||
    value === "validated" ||
    value === "approved" ||
    value === "applied" ||
    value === "rejected"
  ) {
    return value;
  }
  throw new Error(`Unsupported Curation state: ${value}`);
}

function originKind(value: string): CurationChangeSet["originKind"] {
  if (value === "review" || value === "acquisition") return value;
  throw new Error(`Unsupported Curation origin kind: ${value}`);
}

function ownerModule(value: string): CurationOwnerModule {
  if (value === "panda" || value === "lineage" || value === "life_history") return value;
  throw new Error(`Unsupported Curation owner module: ${value}`);
}

function ownerOperation(value: string): CurationOwnerOperation {
  if (
    value === "fact.propose" ||
    value === "fact.corroborate" ||
    value === "fact.dispute" ||
    value === "name.add" ||
    value === "name.corroborate" ||
    value === "external_identifier.add" ||
    value === "external_identifier.corroborate" ||
    value === "parentage.create" ||
    value === "residency.create" ||
    value === "event.create"
  ) {
    return value;
  }
  throw new Error(`Unsupported Curation owner operation: ${value}`);
}

export class PostgresCurationRepository implements CurationRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async createFromReview(input: ReviewCurationRecommendationInput): Promise<CurationChangeSet> {
    return this.database.transaction(async (transaction) => {
      const existing = await transaction
        .selectFrom("curation.change_sets")
        .select("change_set_id")
        .where("origin_review_case_id", "=", input.reviewCaseId)
        .executeTakeFirst();
      if (existing !== undefined) {
        const current = await this.getIn(transaction, existing.change_set_id);
        if (current === undefined) throw new Error("Existing Curation change set could not be reloaded");
        return current;
      }

      const changeSet = await transaction
        .insertInto("curation.change_sets")
        .values({
          origin_kind: "review",
          origin_review_case_id: input.reviewCaseId,
          origin_decision_id: input.decisionId,
          origin_submission_id: input.submissionId,
          origin_revision_number: input.revisionNumber,
          target_panda_id: input.targetPandaId,
          reason: input.reason,
          created_by_account_id: input.recommendedByAccountId,
        })
        .returning("change_set_id")
        .executeTakeFirstOrThrow();

      await transaction
        .insertInto("curation.panda_fact_changes")
        .values(
          input.assertions.map((assertion) => ({
            change_set_id: changeSet.change_set_id,
            origin_assertion_key: assertion.assertionKey,
            field_key: assertion.fieldKey,
            proposed_value: sql`${JSON.stringify(assertion.value)}::jsonb`,
            certainty: assertion.certainty,
            last_verified_on: assertion.lastVerifiedOn,
            source_ids: assertion.sourceIds,
          })),
        )
        .execute();

      const created = await this.getIn(transaction, changeSet.change_set_id);
      if (created === undefined) throw new Error("Created Curation change set could not be reloaded");
      return created;
    });
  }

  public async createFromAcquisition(
    input: AcquisitionCurationRecommendationInput,
  ): Promise<CurationChangeSet> {
    return this.database.transaction(async (transaction) => {
      const existing = await transaction
        .selectFrom("curation.change_sets")
        .select("change_set_id")
        .where("origin_pipeline_artifact_id", "=", input.pipelineArtifactId)
        .executeTakeFirst();
      if (existing !== undefined) {
        const current = await this.getIn(transaction, existing.change_set_id);
        if (current === undefined) throw new Error("Existing acquisition Curation change set could not be reloaded");
        return current;
      }

      const changeSet = await transaction
        .insertInto("curation.change_sets")
        .values({
          origin_kind: "acquisition",
          origin_pipeline_artifact_id: input.pipelineArtifactId,
          origin_acquisition_bundle_id: input.acquisitionBundleId,
          target_panda_id: input.targetPandaId,
          reason: input.reason,
          created_by_account_id: input.recommendedByAccountId,
        })
        .returning("change_set_id")
        .executeTakeFirstOrThrow();

      await transaction
        .insertInto("curation.owner_changes")
        .values(
          input.changes.map((change) => ({
            change_set_id: changeSet.change_set_id,
            origin_candidate_id: change.candidateId,
            owner_module: change.ownerModule,
            operation: change.operation,
            payload: sql`${JSON.stringify(change.payload)}::jsonb`,
            last_verified_on: change.lastVerifiedOn,
            source_ids: change.sourceIds,
          })),
        )
        .execute();

      const created = await this.getIn(transaction, changeSet.change_set_id);
      if (created === undefined) throw new Error("Created acquisition Curation change set could not be reloaded");
      return created;
    });
  }

  public get(changeSetId: string): Promise<CurationChangeSet | undefined> {
    return this.getIn(this.database.db, changeSetId);
  }

  public async markValidated(
    changeSetId: string,
    actorAccountId: string,
  ): Promise<CurationChangeSet | undefined> {
    const updated = await this.database.db
      .updateTable("curation.change_sets")
      .set({
        state: "validated",
        validated_by_account_id: actorAccountId,
        validated_at: new Date(),
        updated_at: new Date(),
        version: sql`version + 1`,
      })
      .where("change_set_id", "=", changeSetId)
      .where("state", "=", "draft")
      .returning("change_set_id")
      .executeTakeFirst();
    return updated === undefined ? undefined : this.get(changeSetId);
  }

  public async getForUpdate(
    transaction: DatabaseTransaction,
    changeSetId: string,
  ): Promise<CurationChangeSet | undefined> {
    const locked = await transaction
      .selectFrom("curation.change_sets")
      .select("change_set_id")
      .where("change_set_id", "=", changeSetId)
      .forUpdate()
      .executeTakeFirst();
    return locked === undefined ? undefined : this.getIn(transaction, changeSetId);
  }

  public async completeApply(
    transaction: DatabaseTransaction,
    changeSetId: string,
    actorAccountId: string,
    reason: string,
    appliedAssertions: ReadonlyMap<string, string>,
    appliedOwnerReferences: ReadonlyMap<string, string>,
  ): Promise<CurationChangeSet> {
    for (const [changeId, assertionId] of appliedAssertions) {
      await transaction
        .updateTable("curation.panda_fact_changes")
        .set({ applied_assertion_id: assertionId })
        .where("change_id", "=", changeId)
        .where("change_set_id", "=", changeSetId)
        .executeTakeFirstOrThrow();
    }
    for (const [changeId, reference] of appliedOwnerReferences) {
      await transaction
        .updateTable("curation.owner_changes")
        .set({ applied_reference: reference })
        .where("change_id", "=", changeId)
        .where("change_set_id", "=", changeSetId)
        .executeTakeFirstOrThrow();
    }

    await transaction
      .insertInto("curation.approval_decisions")
      .values({
        change_set_id: changeSetId,
        decision: "approved",
        reason,
        decided_by_account_id: actorAccountId,
      })
      .execute();

    const now = new Date();
    await transaction
      .updateTable("curation.change_sets")
      .set({
        state: "applied",
        approved_by_account_id: actorAccountId,
        approved_at: now,
        applied_at: now,
        updated_at: now,
        version: sql`version + 1`,
      })
      .where("change_set_id", "=", changeSetId)
      .where("state", "=", "validated")
      .executeTakeFirstOrThrow();

    const applied = await this.getIn(transaction, changeSetId);
    if (applied === undefined) throw new Error("Applied Curation change set could not be reloaded");
    return applied;
  }

  private async getIn(
    executor: DatabaseService["db"] | DatabaseTransaction,
    changeSetId: string,
  ): Promise<CurationChangeSet | undefined> {
    const set = await executor
      .selectFrom("curation.change_sets")
      .selectAll()
      .where("change_set_id", "=", changeSetId)
      .executeTakeFirst();
    if (set === undefined) return undefined;

    const [changeRows, ownerRows] = await Promise.all([
      executor
        .selectFrom("curation.panda_fact_changes")
        .selectAll()
        .where("change_set_id", "=", changeSetId)
        .orderBy("created_at")
        .orderBy("change_id")
        .execute(),
      executor
        .selectFrom("curation.owner_changes")
        .selectAll()
        .where("change_set_id", "=", changeSetId)
        .orderBy("created_at")
        .orderBy("change_id")
        .execute(),
    ]);
    const changes: CurationPandaFactChange[] = changeRows.map((change) => ({
      changeId: change.change_id,
      assertionKey: change.origin_assertion_key,
      fieldKey: change.field_key,
      value: jsonValue(change.proposed_value),
      certainty: change.certainty === "confirmed" ? "confirmed" : "provisional",
      lastVerifiedOn: change.last_verified_on,
      sourceIds: change.source_ids,
      ...(change.applied_assertion_id === null ? {} : { appliedAssertionId: change.applied_assertion_id }),
    }));
    const ownerChanges: CurationOwnerChange[] = ownerRows.map((change) => ({
      changeId: change.change_id,
      candidateId: change.origin_candidate_id,
      ownerModule: ownerModule(change.owner_module),
      operation: ownerOperation(change.operation),
      payload: jsonObject(change.payload),
      lastVerifiedOn: change.last_verified_on,
      sourceIds: change.source_ids,
      ...(change.applied_reference === null ? {} : { appliedReference: change.applied_reference }),
    }));

    const kind = originKind(set.origin_kind);
    if (kind === "review") {
      if (
        set.origin_review_case_id === null ||
        set.origin_decision_id === null ||
        set.origin_submission_id === null ||
        set.origin_revision_number === null
      ) {
        throw new Error(`Review-origin Curation change set ${changeSetId} has incomplete provenance`);
      }
    } else if (
      set.origin_pipeline_artifact_id === null ||
      set.origin_acquisition_bundle_id === null
    ) {
      throw new Error(`Acquisition-origin Curation change set ${changeSetId} has incomplete provenance`);
    }

    return {
      changeSetId: set.change_set_id,
      originKind: kind,
      ...(set.origin_review_case_id === null ? {} : { reviewCaseId: set.origin_review_case_id }),
      ...(set.origin_decision_id === null ? {} : { decisionId: set.origin_decision_id }),
      ...(set.origin_submission_id === null ? {} : { submissionId: set.origin_submission_id }),
      ...(set.origin_revision_number === null ? {} : { revisionNumber: set.origin_revision_number }),
      ...(set.origin_acquisition_bundle_id === null
        ? {}
        : { acquisitionBundleId: set.origin_acquisition_bundle_id }),
      ...(set.origin_pipeline_artifact_id === null
        ? {}
        : { pipelineArtifactId: set.origin_pipeline_artifact_id }),
      targetPandaId: set.target_panda_id,
      state: state(set.state),
      version: set.version,
      reason: set.reason,
      createdByAccountId: set.created_by_account_id,
      ...(set.validated_by_account_id === null ? {} : { validatedByAccountId: set.validated_by_account_id }),
      ...(set.approved_by_account_id === null ? {} : { approvedByAccountId: set.approved_by_account_id }),
      changes,
      ownerChanges,
    };
  }
}
