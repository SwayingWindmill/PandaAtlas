import type { DatabaseTransaction } from "../../../platform/database/database.service.js";

export interface IdentityNotificationContactPort {
  getDeliverableEmail(transaction: DatabaseTransaction, accountId: string): Promise<string | undefined>;
}

export const IDENTITY_NOTIFICATION_CONTACT_PORT = Symbol("IDENTITY_NOTIFICATION_CONTACT_PORT");
