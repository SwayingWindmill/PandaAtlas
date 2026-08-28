import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  DatePrecision,
  LifeEventStatus,
  LifeEventType,
  LifeHistoryCurationParticipant,
  ResidencyStatus,
  ResidencyType,
} from "../../life-history/application/life-history.application.js";
import type {
  LineageCurationParticipant,
  ParentageStatus,
  ParentRole,
} from "../../lineage/application/lineage.application.js";
import type {
  CuratedFactMode,
  CuratedIdentityMode,
  FactCertainty,
  JsonValue,
  PandaCurationParticipant,
  PandaNameKind,
} from "../../panda/application/panda.application.js";
import type {
  CurationApplyCoordinator,
  CurationChangeSet,
  CurationJsonValue,
  CurationOwnerChange,
} from "../application/curation.application.js";
import type { PostgresCurationRepository } from "./postgres-curation.repository.js";

function requireString(
  payload: { [key: string]: CurationJsonValue },
  key: string,
): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Curation owner payload requires non-empty ${key}`);
  }
  return value;
}

function optionalString(
  payload: { [key: string]: CurationJsonValue },
  key: string,
): string | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Curation owner payload ${key} must be a non-empty string when present`);
  }
  return value;
}

function optionalBoolean(
  payload: { [key: string]: CurationJsonValue },
  key: string,
): boolean | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`Curation owner payload ${key} must be boolean when present`);
  }
  return value;
}

function requireJson(
  payload: { [key: string]: CurationJsonValue },
  key: string,
): JsonValue {
  if (!(key in payload)) throw new Error(`Curation owner payload requires ${key}`);
  return payload[key] as JsonValue;
}

function stringArray(
  payload: { [key: string]: CurationJsonValue },
  key: string,
): string[] | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`Curation owner payload ${key} must be a string array`);
  }
  return value as string[];
}

function literal<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Unsupported ${label}: ${value}`);
}

const NAME_KINDS: readonly PandaNameKind[] = [
  "official",
  "official_romanization",
  "pinyin",
  "alias",
  "historic_spelling",
  "historical_name",
  "nickname",
];
const FACT_CERTAINTIES: readonly FactCertainty[] = ["confirmed", "provisional"];
const PARENT_ROLES: readonly ParentRole[] = ["father", "mother"];
const PARENTAGE_STATUSES: readonly ParentageStatus[] = [
  "confirmed",
  "tentative",
  "disputed",
  "superseded",
];
const DATE_PRECISIONS: readonly DatePrecision[] = ["day", "month", "year", "unknown"];
const RESIDENCY_TYPES: readonly ResidencyType[] = ["primary", "temporary", "transit", "quarantine"];
const RESIDENCY_STATUSES: readonly ResidencyStatus[] = [
  "confirmed",
  "confirmed_country_level",
  "provisional",
];
const EVENT_TYPES: readonly LifeEventType[] = [
  "birth",
  "arrival",
  "transfer",
  "return",
  "naming",
  "public_debut",
  "selection",
  "announcement",
  "observation",
  "death",
];
const EVENT_STATUSES: readonly LifeEventStatus[] = ["announced", "completed", "cancelled", "disputed"];

export class PostgresCurationApplyCoordinator implements CurationApplyCoordinator {
  public constructor(
    private readonly database: DatabaseService,
    private readonly repository: PostgresCurationRepository,
    private readonly pandas: PandaCurationParticipant,
    private readonly lineage: LineageCurationParticipant,
    private readonly lifeHistory: LifeHistoryCurationParticipant,
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

      const appliedOwnerReferences = new Map<string, string>();
      for (const change of changeSet.ownerChanges) {
        const reference = await this.applyOwnerChange(transaction, changeSet, change);
        appliedOwnerReferences.set(change.changeId, reference);
      }

      return this.repository.completeApply(
        transaction,
        changeSetId,
        actorAccountId,
        reason,
        appliedAssertions,
        appliedOwnerReferences,
      );
    });
  }

  private async applyOwnerChange(
    transaction: Parameters<PandaCurationParticipant["applyCuratedFact"]>[0],
    changeSet: CurationChangeSet,
    change: CurationOwnerChange,
  ): Promise<string> {
    if (change.ownerModule === "panda") {
      return this.applyPandaChange(transaction, changeSet, change);
    }
    if (change.ownerModule === "lineage") {
      if (change.operation !== "parentage.create") {
        throw new Error(`Unsupported Lineage Curation operation ${change.operation}`);
      }
      return this.lineage.applyCuratedParentage(transaction, {
        assertionId: `curation:${change.changeId}`,
        childId: changeSet.targetPandaId,
        parentId: requireString(change.payload, "parentId"),
        parentRole: literal(requireString(change.payload, "parentRole"), PARENT_ROLES, "parent role"),
        status: literal(
          requireString(change.payload, "status"),
          PARENTAGE_STATUSES,
          "parentage status",
        ),
        reviewedAt: new Date().toISOString(),
        sourceIds: change.sourceIds,
      });
    }
    if (change.operation === "residency.create") {
      return this.lifeHistory.applyCuratedResidency(transaction, {
        residencyId: `curation:${change.changeId}`,
        pandaId: changeSet.targetPandaId,
        placeId: requireString(change.payload, "placeId"),
        residencyType: literal(
          requireString(change.payload, "residencyType"),
          RESIDENCY_TYPES,
          "residency type",
        ),
        startOn: optionalString(change.payload, "startOn"),
        startPrecision: literal(
          requireString(change.payload, "startPrecision"),
          DATE_PRECISIONS,
          "start precision",
        ),
        endOn: optionalString(change.payload, "endOn"),
        endPrecision: optionalString(change.payload, "endPrecision") === undefined
          ? undefined
          : literal(
              requireString(change.payload, "endPrecision"),
              DATE_PRECISIONS,
              "end precision",
            ),
        status: literal(
          requireString(change.payload, "status"),
          RESIDENCY_STATUSES,
          "residency status",
        ),
        sourceIds: change.sourceIds,
      });
    }
    if (change.operation === "event.create") {
      const participantIds = stringArray(change.payload, "participantIds") ?? [changeSet.targetPandaId];
      if (!participantIds.includes(changeSet.targetPandaId)) participantIds.push(changeSet.targetPandaId);
      return this.lifeHistory.applyCuratedEvent(transaction, {
        eventId: `curation:${change.changeId}`,
        eventType: literal(requireString(change.payload, "eventType"), EVENT_TYPES, "life event type"),
        eventStatus: literal(
          requireString(change.payload, "eventStatus"),
          EVENT_STATUSES,
          "life event status",
        ),
        occurredOn: optionalString(change.payload, "occurredOn"),
        occurredPrecision: literal(
          requireString(change.payload, "occurredPrecision"),
          DATE_PRECISIONS,
          "event date precision",
        ),
        fromPlaceId: optionalString(change.payload, "fromPlaceId"),
        toPlaceId: optionalString(change.payload, "toPlaceId"),
        summary: optionalString(change.payload, "summary"),
        participantIds,
        sourceIds: change.sourceIds,
      });
    }
    throw new Error(`Unsupported LifeHistory Curation operation ${change.operation}`);
  }

  private applyPandaChange(
    transaction: Parameters<PandaCurationParticipant["applyCuratedFact"]>[0],
    changeSet: CurationChangeSet,
    change: CurationOwnerChange,
  ): Promise<string> {
    if (
      change.operation === "fact.propose" ||
      change.operation === "fact.corroborate" ||
      change.operation === "fact.refine" ||
      change.operation === "fact.dispute"
    ) {
      const mode: CuratedFactMode = change.operation.slice("fact.".length) as CuratedFactMode;
      return this.pandas.applyCuratedFact(
        transaction,
        {
          assertionId: `curation:${change.changeId}`,
          pandaId: changeSet.targetPandaId,
          fieldKey: requireString(change.payload, "fieldKey"),
          value: requireJson(change.payload, "value"),
          certainty: literal(
            requireString(change.payload, "certainty"),
            FACT_CERTAINTIES,
            "fact certainty",
          ),
          lastVerifiedOn: change.lastVerifiedOn,
          sourceIds: change.sourceIds,
        },
        mode,
      );
    }
    if (change.operation === "name.add" || change.operation === "name.corroborate") {
      const mode: CuratedIdentityMode = change.operation.endsWith("corroborate")
        ? "corroborate"
        : "add";
      return this.pandas.applyCuratedName(
        transaction,
        {
          pandaId: changeSet.targetPandaId,
          languageTag: requireString(change.payload, "languageTag"),
          nameKind: literal(requireString(change.payload, "nameKind"), NAME_KINDS, "Panda name kind"),
          value: requireString(change.payload, "value"),
          isPrimary: optionalBoolean(change.payload, "isPrimary"),
          validFrom: optionalString(change.payload, "validFrom"),
          validTo: optionalString(change.payload, "validTo"),
          sourceIds: change.sourceIds,
        },
        mode,
      );
    }
    if (
      change.operation === "external_identifier.add" ||
      change.operation === "external_identifier.corroborate"
    ) {
      const mode: CuratedIdentityMode = change.operation.endsWith("corroborate")
        ? "corroborate"
        : "add";
      return this.pandas.applyCuratedExternalIdentifier(
        transaction,
        {
          pandaId: changeSet.targetPandaId,
          system: requireString(change.payload, "system"),
          value: requireString(change.payload, "value"),
          sourceIds: change.sourceIds,
        },
        mode,
      );
    }
    throw new Error(`Unsupported Panda Curation operation ${change.operation}`);
  }
}
