import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { ParentRole } from "./lineage.application.js";

export interface LineagePublicationSource {
  assertionId: string;
  childId: string;
  parentId: string;
  parentRole: ParentRole;
  sourceIds: string[];
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
}

export interface LineagePublicationPort {
  snapshot(transaction: DatabaseTransaction): Promise<LineagePublicationSource[]>;
}

export const LINEAGE_PUBLICATION_PORT = Symbol("LINEAGE_PUBLICATION_PORT");
