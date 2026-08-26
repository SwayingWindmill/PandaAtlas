import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  JsonValue,
  PandaCurationParticipant,
} from "../../panda/application/panda.application.js";
import type {
  CurationApplyCoordinator,
  CurationChangeSet,
} from "../application/curation.application.js";
import type { PostgresCurationRepository } from "./postgres-curation.repository.js";

export class PostgresCurationApplyCoordinator implements CurationApplyCoordinator {
  public constructor(
    private readonly database: DatabaseService,
    private readonly repository: PostgresCurationRepository,
    private readonly pandas: PandaCurationParticipant,
  ) {}

  public async approveAndApply(
    changeSetId: string,
    actorAccountId: string,
    reason: string,
  ): Promise<CurationChangeSet | undefined> {
    return this.database.transaction(async (transaction) => {
      const changeSet = await this.repository.getForUpdate(transaction, changeSetId);
      if (
        changeSet === undefined ||
        changeSet.state !== "validated" ||
        changeSet.createdByAccountId === actorAccountId
      ) {
        return undefined;
      }

      const appliedAssertions = new Map<string, string>();
      for (const change of changeSet.changes) {
        const assertionId = `curation:${change.changeId}`;
        await this.pandas.applyCuratedFact(transaction, {
          assertionId,
          pandaId: changeSet.targetPandaId,
          fieldKey: change.fieldKey,
          value: change.value as JsonValue,
          certainty: change.certainty,
          lastVerifiedOn: change.lastVerifiedOn,
          sourceIds: change.sourceIds,
        });
        appliedAssertions.set(change.changeId, assertionId);
      }

      return this.repository.completeApply(
        transaction,
        changeSetId,
        actorAccountId,
        reason,
        appliedAssertions,
      );
    });
  }
}
