import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { PublicationChangePort } from "../application/publication-change.port.js";
import {
  type PublicationInspectionPort,
  type PublicationReleaseInspection,
  type PublicationReleaseListQuery,
  type PublicationReleasePage,
  type PublicationReleaseSummary,
  type PublicationResourceCounts,
  pagePublicationChanges,
  summarizePublicationChanges,
} from "../application/publication-inspection.port.js";
import type { PublicRelease, ReleaseLifecycleState } from "../application/publication.application.js";

interface ReleaseRow {
  release_id: string;
  version: string;
  projection_schema_version: number;
  lifecycle_state: string;
  built_at: Date;
  sealed_at: Date | null;
  content_sha256: string | null;
}

const emptyCounts = (): PublicationResourceCounts => ({
  panda: 0,
  institution: 0,
  place: 0,
  lineage: 0,
  residency: 0,
  lifeEvent: 0,
  media: 0,
  evidence: 0,
});

function countKey(resourceKind: string): keyof PublicationResourceCounts | undefined {
  switch (resourceKind) {
    case "panda": return "panda";
    case "institution": return "institution";
    case "place": return "place";
    case "lineage": return "lineage";
    case "residency": return "residency";
    case "life_event": return "lifeEvent";
    case "media": return "media";
    case "evidence": return "evidence";
    default: return undefined;
  }
}

export class PostgresPublicationInspectionQuery implements PublicationInspectionPort {
  public constructor(
    private readonly database: DatabaseService,
    private readonly changes: PublicationChangePort,
  ) {}

  public async listReleases(query: PublicationReleaseListQuery): Promise<PublicationReleasePage> {
    const currentReleaseId = await this.currentReleaseId();
    let releasesQuery = this.database.db
      .selectFrom("publication.releases")
      .select([
        "release_id",
        "version",
        "projection_schema_version",
        "lifecycle_state",
        "built_at",
        "sealed_at",
        "content_sha256",
      ]);
    let countQuery = this.database.db.selectFrom("publication.releases");
    if (query.lifecycleState !== undefined) {
      releasesQuery = releasesQuery.where("lifecycle_state", "=", query.lifecycleState);
      countQuery = countQuery.where("lifecycle_state", "=", query.lifecycleState);
    }
    const [rows, totalRow] = await Promise.all([
      releasesQuery
        .orderBy("built_at", "desc")
        .orderBy("release_id", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      countQuery.select(sql<number>`count(*)::int`.as("count")).executeTakeFirstOrThrow(),
    ]);
    const currentReleaseRow = currentReleaseId === undefined
      ? undefined
      : await this.database.db
          .selectFrom("publication.releases")
          .select([
            "release_id",
            "version",
            "projection_schema_version",
            "lifecycle_state",
            "built_at",
            "sealed_at",
            "content_sha256",
          ])
          .where("release_id", "=", currentReleaseId)
          .executeTakeFirst();
    const rowsToSummarize = [...rows as ReleaseRow[]];
    if (currentReleaseRow !== undefined && !rowsToSummarize.some((row) => row.release_id === currentReleaseId)) {
      rowsToSummarize.push(currentReleaseRow as ReleaseRow);
    }
    const summaries = await this.summarize(rowsToSummarize, currentReleaseId);
    const summaryById = new Map(summaries.map((summary) => [summary.releaseId, summary]));
    const currentRelease = currentReleaseId === undefined ? undefined : summaryById.get(currentReleaseId);
    return {
      ...(currentReleaseId === undefined ? {} : { currentReleaseId }),
      ...(currentRelease === undefined ? {} : { currentRelease }),
      items: rows.map((row) => summaryById.get(row.release_id)).filter((item): item is PublicationReleaseSummary => item !== undefined),
      total: totalRow.count,
      limit: query.limit,
      offset: query.offset,
    };
  }

  public async inspectRelease(
    releaseId: string,
    query: { changeLimit: number; changeOffset: number } = { changeLimit: 10, changeOffset: 0 },
  ): Promise<PublicationReleaseInspection | undefined> {
    const row = await this.database.db
      .selectFrom("publication.releases")
      .select([
        "release_id",
        "version",
        "projection_schema_version",
        "lifecycle_state",
        "built_at",
        "sealed_at",
        "content_sha256",
      ])
      .where("release_id", "=", releaseId)
      .executeTakeFirst();
    if (row === undefined) return undefined;

    const currentReleaseId = await this.currentReleaseId();
    const release = (await this.summarize([row as ReleaseRow], currentReleaseId))[0];
    if (release === undefined) return undefined;
    const transitions = await this.database.db
      .selectFrom("publication.release_transitions")
      .select([
        "transition_id",
        "transition_type",
        "from_release_id",
        "actor_account_id",
        "actor_system_key",
        "reason",
        "occurred_at",
      ])
      .where("release_id", "=", releaseId)
      .orderBy("occurred_at", "desc")
      .orderBy("transition_id", "desc")
      .limit(50)
      .execute();

    const changeSet = currentReleaseId === undefined || currentReleaseId === releaseId
      ? undefined
      : await this.database.transaction((transaction) =>
          this.changes.describeTransition(transaction, releaseId, currentReleaseId));

    return {
      ...(currentReleaseId === undefined ? {} : { currentReleaseId }),
      release,
      changes: changeSet === undefined ? [] : summarizePublicationChanges(changeSet.changes),
      ...pagePublicationChanges(changeSet?.changes ?? [], query),
      transitions: transitions.map((transition) => ({
        transitionId: transition.transition_id,
        transitionType: transition.transition_type,
        ...(transition.from_release_id === null ? {} : { fromReleaseId: transition.from_release_id }),
        actor: transition.actor_account_id !== null
          ? `account:${transition.actor_account_id}`
          : `system:${transition.actor_system_key ?? "unknown"}`,
        reason: transition.reason,
        occurredAt: transition.occurred_at.toISOString(),
      })),
    };
  }

  private async currentReleaseId(): Promise<string | undefined> {
    const row = await this.database.db
      .selectFrom("publication.current_release")
      .select("release_id")
      .where("singleton", "=", true)
      .executeTakeFirst();
    return row?.release_id;
  }

  private async summarize(rows: ReleaseRow[], currentReleaseId?: string): Promise<PublicationReleaseSummary[]> {
    if (rows.length === 0) return [];
    const releaseIds = rows.map((row) => row.release_id);
    const [countRows, controlRows, currentRow] = await Promise.all([
      this.database.db
        .selectFrom("publication.release_memberships")
        .select([
          "release_id",
          "resource_kind",
          sql<number>`count(*)::int`.as("count"),
        ])
        .where("release_id", "in", releaseIds)
        .groupBy(["release_id", "resource_kind"])
        .execute(),
      this.database.db
        .selectFrom("publication.delivery_control_events")
        .select(["release_id", "action", "occurred_at", "control_event_id"])
        .where("control_kind", "=", "release_suspension")
        .where("release_id", "in", releaseIds)
        .orderBy("occurred_at", "desc")
        .orderBy("control_event_id", "desc")
        .execute(),
      currentReleaseId === undefined
        ? Promise.resolve(undefined)
        : this.database.db
            .selectFrom("publication.releases")
            .select(["release_id", "projection_schema_version", "built_at"])
            .where("release_id", "=", currentReleaseId)
            .executeTakeFirst(),
    ]);

    const countsByRelease = new Map<string, PublicationResourceCounts>();
    for (const row of countRows) {
      const counts = countsByRelease.get(row.release_id) ?? emptyCounts();
      const key = countKey(row.resource_kind);
      if (key !== undefined) counts[key] = row.count;
      countsByRelease.set(row.release_id, counts);
    }
    const suspendedByRelease = new Map<string, boolean>();
    for (const row of controlRows) {
      if (row.release_id !== null && !suspendedByRelease.has(row.release_id)) {
        suspendedByRelease.set(row.release_id, row.action === "apply");
      }
    }

    return rows.map((row) => {
      const counts = countsByRelease.get(row.release_id) ?? emptyCounts();
      const suspended = suspendedByRelease.get(row.release_id) ?? false;
      const isCurrent = row.release_id === currentReleaseId;
      return {
        ...this.mapRelease(row),
        isCurrent,
        suspended,
        counts,
        blockers: this.blockers(row, counts, suspended, isCurrent, currentRow),
      };
    });
  }

  private blockers(
    release: ReleaseRow,
    counts: PublicationResourceCounts,
    suspended: boolean,
    isCurrent: boolean,
    current?: { release_id: string; projection_schema_version: number; built_at: Date },
  ): string[] {
    const blockers: string[] = [];
    const memberCount = counts.panda
      + counts.institution
      + counts.place
      + counts.lineage
      + counts.residency
      + counts.lifeEvent
      + counts.media
      + counts.evidence;
    if (memberCount === 0) blockers.push("No publishable resources are included; sealing is blocked.");
    if (release.lifecycle_state === "building") blockers.push("Seal this release before activation or rollback.");
    if (suspended) blockers.push("Restore this release before activation or rollback.");
    if (isCurrent) blockers.push("This is the current public release.");
    if (
      current !== undefined &&
      !isCurrent &&
      release.built_at < current.built_at &&
      release.projection_schema_version !== current.projection_schema_version
    ) {
      blockers.push("Projection schema differs from the current release; rollback is blocked.");
    }
    return blockers;
  }

  private mapRelease(row: ReleaseRow): PublicRelease {
    return {
      releaseId: row.release_id,
      version: row.version,
      projectionSchemaVersion: row.projection_schema_version,
      lifecycleState: row.lifecycle_state as ReleaseLifecycleState,
      builtAt: row.built_at.toISOString(),
      ...(row.sealed_at === null ? {} : { sealedAt: row.sealed_at.toISOString() }),
      ...(row.content_sha256 === null ? {} : { contentSha256: row.content_sha256 }),
    };
  }
}
