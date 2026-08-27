import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type {
  PublicationChange,
  PublicationChangePort,
  PublicationMemberKind,
  PublicationTransitionChanges,
} from "../application/publication-change.port.js";

interface MembershipDigest {
  resourceKind: PublicationMemberKind;
  resourceId: string;
  projectionSha256: string;
}

function membershipKey(item: Pick<MembershipDigest, "resourceKind" | "resourceId">): string {
  return `${item.resourceKind}:${item.resourceId}`;
}

export class PostgresPublicationChangeQuery implements PublicationChangePort {
  public async describeTransition(
    transaction: DatabaseTransaction,
    releaseId: string,
    previousReleaseId?: string,
  ): Promise<PublicationTransitionChanges> {
    const release = await transaction
      .selectFrom("publication.releases")
      .select(["release_id", "version"])
      .where("release_id", "=", releaseId)
      .where("lifecycle_state", "=", "sealed")
      .executeTakeFirstOrThrow();

    const current = await this.memberships(transaction, releaseId);
    const previous = previousReleaseId === undefined ? [] : await this.memberships(transaction, previousReleaseId);
    const currentByKey = new Map(current.map((item) => [membershipKey(item), item]));
    const previousByKey = new Map(previous.map((item) => [membershipKey(item), item]));
    const changes: PublicationChange[] = [];

    for (const item of current) {
      const before = previousByKey.get(membershipKey(item));
      if (before === undefined) {
        changes.push({ resourceKind: item.resourceKind, resourceId: item.resourceId, changeType: "added" });
      } else if (before.projectionSha256 !== item.projectionSha256) {
        changes.push({ resourceKind: item.resourceKind, resourceId: item.resourceId, changeType: "changed" });
      }
    }
    for (const item of previous) {
      if (!currentByKey.has(membershipKey(item))) {
        changes.push({ resourceKind: item.resourceKind, resourceId: item.resourceId, changeType: "removed" });
      }
    }

    changes.sort((left, right) => {
      const kind = left.resourceKind.localeCompare(right.resourceKind);
      return kind === 0 ? left.resourceId.localeCompare(right.resourceId) : kind;
    });

    return {
      releaseId: release.release_id,
      releaseVersion: release.version,
      ...(previousReleaseId === undefined ? {} : { previousReleaseId }),
      changes,
    };
  }

  private async memberships(transaction: DatabaseTransaction, releaseId: string): Promise<MembershipDigest[]> {
    const rows = await transaction
      .selectFrom("publication.release_memberships")
      .select(["resource_kind", "resource_id", "projection_sha256"])
      .where("release_id", "=", releaseId)
      .orderBy("resource_kind")
      .orderBy("resource_id")
      .execute();
    return rows.map((row) => ({
      resourceKind: row.resource_kind as PublicationMemberKind,
      resourceId: row.resource_id,
      projectionSha256: row.projection_sha256,
    }));
  }
}
