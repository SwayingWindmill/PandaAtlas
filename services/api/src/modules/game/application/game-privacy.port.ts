import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface GamePrivacyPort {
  exportPrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<Record<string, unknown>>;
  erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void>;
}

export const GAME_PRIVACY_PORT = Symbol("GAME_PRIVACY_PORT");
