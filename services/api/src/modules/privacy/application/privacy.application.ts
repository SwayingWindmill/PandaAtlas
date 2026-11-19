export type PrivacyRequestKind = "access_export" | "account_deletion";
export type PrivacyRequestState = "pending" | "processing" | "completed" | "failed";

export interface PrivacyRequestRecord {
  requestId: string;
  kind: PrivacyRequestKind;
  state: PrivacyRequestState;
  reason: string;
  requestedAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  failureCode?: string;
}

export interface PrivacyExportRecord {
  requestId: string;
  createdAt: string;
  expiresAt: string;
  payload: Record<string, unknown>;
}

export interface CreatePrivacyRequestInput {
  kind: PrivacyRequestKind;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface PrivacyRepository {
  create(accountId: string, input: CreatePrivacyRequestInput): Promise<PrivacyRequestRecord>;
  get(accountId: string, requestId: string): Promise<PrivacyRequestRecord | undefined>;
  /** The account's requests, newest first. */
  list(accountId: string): Promise<PrivacyRequestRecord[]>;
  getExport(accountId: string, requestId: string): Promise<PrivacyExportRecord | undefined>;
}

export type PrivacyPort = PrivacyRepository;
export const PRIVACY_PORT = Symbol("PRIVACY_PORT");
