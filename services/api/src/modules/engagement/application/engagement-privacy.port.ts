import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface EngagementPrivacyPort {
  exportPrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<Record<string, unknown>>;
  erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void>;
}

export const ENGAGEMENT_PRIVACY_PORT = Symbol("ENGAGEMENT_PRIVACY_PORT");
