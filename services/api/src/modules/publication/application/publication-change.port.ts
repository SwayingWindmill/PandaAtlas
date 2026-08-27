import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export type PublicationMemberKind =
  | "panda"
  | "institution"
  | "place"
  | "lineage"
  | "residency"
  | "life_event"
  | "media"
  | "evidence";

export type PublicationChangeType = "added" | "changed" | "removed";

export interface PublicationChange {
  resourceKind: PublicationMemberKind;
  resourceId: string;
  changeType: PublicationChangeType;
}

export interface PublicationTransitionChanges {
  releaseId: string;
  releaseVersion: string;
  previousReleaseId?: string;
  changes: PublicationChange[];
}

export interface PublicationChangePort {
  describeTransition(
    transaction: DatabaseTransaction,
    releaseId: string,
    previousReleaseId?: string,
  ): Promise<PublicationTransitionChanges>;
}

export const PUBLICATION_CHANGE_PORT = Symbol("PUBLICATION_CHANGE_PORT");
