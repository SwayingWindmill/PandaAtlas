import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface NotificationPrivacyPort {
  exportPrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<Record<string, unknown>>;
  erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void>;
}

export const NOTIFICATION_PRIVACY_PORT = Symbol("NOTIFICATION_PRIVACY_PORT");
