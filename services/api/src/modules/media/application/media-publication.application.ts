import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { MediaUsageRole } from "./media.application.js";

export interface MediaPublicationSource {
  membershipId: string;
  assetId: string;
  pandaId: string;
  sourceId?: string;
  usageRole: MediaUsageRole;
  displayOrder: number;
  objectKey: string;
  contentSha256: string;
  mediaType: string;
  title?: string;
  creator?: string;
  copyrightText?: string;
  license?: string;
  attributionText?: string;
  takenAt?: string;
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
}

export interface MediaPublicationPort {
  snapshot(transaction: DatabaseTransaction): Promise<MediaPublicationSource[]>;
}

export const MEDIA_PUBLICATION_PORT = Symbol("MEDIA_PUBLICATION_PORT");
