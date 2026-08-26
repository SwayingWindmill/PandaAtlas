import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface ModerationAccountStateInput {
  accountId: string;
  suspended: boolean;
  actorAccountId: string;
  reason: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface IdentityModerationParticipant {
  setModerationSuspension(
    transaction: DatabaseTransaction,
    input: ModerationAccountStateInput,
  ): Promise<void>;
}

export const IDENTITY_MODERATION_PARTICIPANT = Symbol("IDENTITY_MODERATION_PARTICIPANT");
