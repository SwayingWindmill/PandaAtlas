import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface EngagementNotificationAudiencePort {
  listAccountsFavoritingPandas(transaction: DatabaseTransaction, pandaIds: readonly string[]): Promise<string[]>;
  listFavoritedPandaIds(transaction: DatabaseTransaction): Promise<string[]>;
  listAccountsFollowingInstitutions(transaction: DatabaseTransaction, institutionIds: readonly string[]): Promise<string[]>;
}

export const ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT = Symbol("ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT");
