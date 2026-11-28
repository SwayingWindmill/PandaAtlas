import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface DailyCheckinPrivacyExport {
  day: string;
  kind: string;
  retroactive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyCheckinPrivacyPort {
  exportPrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<DailyCheckinPrivacyExport[]>;
  erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void>;
}

export const DAILY_CHECKIN_PRIVACY_PORT = Symbol("DAILY_CHECKIN_PRIVACY_PORT");
