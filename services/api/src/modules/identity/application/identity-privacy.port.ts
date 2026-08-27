import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface IdentityPrivacyPort {
  exportPrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<Record<string, unknown>>;
  erasePrivacySubject(
    transaction: DatabaseTransaction,
    accountId: string,
    requestId: string,
    correlationId: string,
  ): Promise<void>;
}

export const IDENTITY_PRIVACY_PORT = Symbol("IDENTITY_PRIVACY_PORT");
