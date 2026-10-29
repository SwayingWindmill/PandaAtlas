import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface ContributionPrivacyPort {
  /** Keeps the correction and its review history, and removes the link to the account. */
  erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void>;
}

export const CONTRIBUTION_PRIVACY_PORT = Symbol("CONTRIBUTION_PRIVACY_PORT");
