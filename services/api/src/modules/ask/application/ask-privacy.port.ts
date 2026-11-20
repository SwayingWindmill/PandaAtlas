import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface AskQuestionCountExport {
  day: string;
  questions: number;
}

export interface AskPrivacyPort {
  exportPrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<AskQuestionCountExport[]>;
  erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void>;
}

export const ASK_PRIVACY_PORT = Symbol("ASK_PRIVACY_PORT");
