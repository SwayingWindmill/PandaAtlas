import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { EngagementPrivacyPort } from "../application/engagement-privacy.port.js";

export class PostgresEngagementPrivacyQuery implements EngagementPrivacyPort {
  public async exportPrivacySubject(
    transaction: DatabaseTransaction,
    accountId: string,
  ): Promise<Record<string, unknown>> {
    const [favorites, collections, checkins, seenPandas] = await Promise.all([
      transaction
        .selectFrom("engagement.favorites")
        .select(["panda_id", "favorited_at"])
        .where("account_id", "=", accountId)
        .orderBy("favorited_at")
        .execute(),
      transaction
        .selectFrom("engagement.collections as collection")
        .leftJoin("engagement.collection_pandas as item", "item.collection_id", "collection.collection_id")
        .select(["collection.collection_id", "collection.name", "collection.created_at", "collection.updated_at", "item.panda_id"])
        .where("collection.account_id", "=", accountId)
        .orderBy("collection.created_at")
        .orderBy("item.added_at")
        .execute(),
      transaction
        .selectFrom("engagement.location_checkins")
        .select(["checkin_id", "place_id", "visited_on", "note", "created_at"])
        .where("account_id", "=", accountId)
        .orderBy("created_at")
        .execute(),
      transaction
        .selectFrom("engagement.seen_pandas")
        .select(["seen_id", "panda_id", "seen_on", "place_id", "note", "first_seen_at", "updated_at"])
        .where("account_id", "=", accountId)
        .orderBy("first_seen_at")
        .execute(),
    ]);

    const collectionMap = new Map<string, { collectionId: string; name: string; pandaIds: string[]; createdAt: string; updatedAt: string }>();
    for (const row of collections) {
      const item = collectionMap.get(row.collection_id) ?? {
        collectionId: row.collection_id,
        name: row.name,
        pandaIds: [],
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
      if (row.panda_id !== null) item.pandaIds.push(row.panda_id);
      collectionMap.set(row.collection_id, item);
    }

    return {
      favorites: favorites.map((row) => ({ pandaId: row.panda_id, favoritedAt: row.favorited_at.toISOString() })),
      collections: [...collectionMap.values()],
      checkins: checkins.map((row) => ({
        checkinId: row.checkin_id,
        placeId: row.place_id,
        visitedOn: row.visited_on,
        note: row.note,
        createdAt: row.created_at.toISOString(),
      })),
      seenPandas: seenPandas.map((row) => ({
        seenId: row.seen_id,
        pandaId: row.panda_id,
        seenOn: row.seen_on,
        placeId: row.place_id,
        note: row.note,
        firstSeenAt: row.first_seen_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
    };
  }

  public async erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void> {
    await transaction.deleteFrom("engagement.favorites").where("account_id", "=", accountId).execute();
    await transaction.deleteFrom("engagement.collections").where("account_id", "=", accountId).execute();
    await transaction.deleteFrom("engagement.location_checkins").where("account_id", "=", accountId).execute();
    await transaction.deleteFrom("engagement.seen_pandas").where("account_id", "=", accountId).execute();
  }
}
