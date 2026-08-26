import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  CollectionRecord,
  CreateCheckinInput,
  EngagementRepository,
  FavoriteRecord,
  LocationCheckinRecord,
  SaveSeenPandaInput,
  SeenPandaRecord,
} from "../application/engagement.application.js";

export class PostgresEngagementRepository implements EngagementRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async listFavorites(accountId: string): Promise<FavoriteRecord[]> {
    const rows = await this.database.db
      .selectFrom("engagement.favorites")
      .select(["panda_id", "favorited_at"])
      .where("account_id", "=", accountId)
      .orderBy("favorited_at", "desc")
      .orderBy("panda_id")
      .execute();
    return rows.map((row) => ({ pandaId: row.panda_id, favoritedAt: row.favorited_at }));
  }

  public async favorite(accountId: string, pandaId: string): Promise<FavoriteRecord> {
    const inserted = await this.database.db
      .insertInto("engagement.favorites")
      .values({ account_id: accountId, panda_id: pandaId })
      .onConflict((conflict) => conflict.columns(["account_id", "panda_id"]).doNothing())
      .returning(["panda_id", "favorited_at"])
      .executeTakeFirst();
    if (inserted !== undefined) {
      return { pandaId: inserted.panda_id, favoritedAt: inserted.favorited_at };
    }
    const existing = await this.database.db
      .selectFrom("engagement.favorites")
      .select(["panda_id", "favorited_at"])
      .where("account_id", "=", accountId)
      .where("panda_id", "=", pandaId)
      .executeTakeFirstOrThrow();
    return { pandaId: existing.panda_id, favoritedAt: existing.favorited_at };
  }

  public async unfavorite(accountId: string, pandaId: string): Promise<boolean> {
    const deleted = await this.database.db
      .deleteFrom("engagement.favorites")
      .where("account_id", "=", accountId)
      .where("panda_id", "=", pandaId)
      .returning("panda_id")
      .executeTakeFirst();
    return deleted !== undefined;
  }

  public async listCollections(accountId: string): Promise<CollectionRecord[]> {
    const rows = await this.database.db
      .selectFrom("engagement.collections as collection")
      .leftJoin("engagement.collection_pandas as item", "item.collection_id", "collection.collection_id")
      .select([
        "collection.collection_id",
        "collection.name",
        "collection.created_at",
        "collection.updated_at",
        "item.panda_id",
      ])
      .where("collection.account_id", "=", accountId)
      .orderBy("collection.updated_at", "desc")
      .orderBy("collection.collection_id")
      .orderBy("item.added_at", "asc")
      .execute();

    const collections = new Map<string, CollectionRecord>();
    for (const row of rows) {
      let collection = collections.get(row.collection_id);
      if (collection === undefined) {
        collection = {
          collectionId: row.collection_id,
          name: row.name,
          pandaIds: [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        collections.set(row.collection_id, collection);
      }
      if (row.panda_id !== null) {
        collection.pandaIds.push(row.panda_id);
      }
    }
    return [...collections.values()];
  }

  public async createCollection(accountId: string, name: string): Promise<CollectionRecord> {
    const row = await this.database.db
      .insertInto("engagement.collections")
      .values({ account_id: accountId, name })
      .returning(["collection_id", "name", "created_at", "updated_at"])
      .executeTakeFirstOrThrow();
    return {
      collectionId: row.collection_id,
      name: row.name,
      pandaIds: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async renameCollection(
    accountId: string,
    collectionId: string,
    name: string,
  ): Promise<CollectionRecord | undefined> {
    const updated = await this.database.db
      .updateTable("engagement.collections")
      .set({ name, updated_at: new Date() })
      .where("account_id", "=", accountId)
      .where("collection_id", "=", collectionId)
      .returning("collection_id")
      .executeTakeFirst();
    return updated === undefined ? undefined : this.getCollection(accountId, collectionId);
  }

  public async deleteCollection(accountId: string, collectionId: string): Promise<boolean> {
    const deleted = await this.database.db
      .deleteFrom("engagement.collections")
      .where("account_id", "=", accountId)
      .where("collection_id", "=", collectionId)
      .returning("collection_id")
      .executeTakeFirst();
    return deleted !== undefined;
  }

  public async addPandaToCollection(
    accountId: string,
    collectionId: string,
    pandaId: string,
  ): Promise<CollectionRecord | undefined> {
    if ((await this.getCollection(accountId, collectionId)) === undefined) {
      return undefined;
    }
    await this.database.db
      .insertInto("engagement.collection_pandas")
      .values({ collection_id: collectionId, panda_id: pandaId })
      .onConflict((conflict) => conflict.columns(["collection_id", "panda_id"]).doNothing())
      .execute();
    await this.touchCollection(collectionId);
    return this.getCollection(accountId, collectionId);
  }

  public async removePandaFromCollection(
    accountId: string,
    collectionId: string,
    pandaId: string,
  ): Promise<CollectionRecord | undefined> {
    if ((await this.getCollection(accountId, collectionId)) === undefined) {
      return undefined;
    }
    await this.database.db
      .deleteFrom("engagement.collection_pandas")
      .where("collection_id", "=", collectionId)
      .where("panda_id", "=", pandaId)
      .execute();
    await this.touchCollection(collectionId);
    return this.getCollection(accountId, collectionId);
  }

  public async listCheckins(accountId: string): Promise<LocationCheckinRecord[]> {
    const rows = await this.database.db
      .selectFrom("engagement.location_checkins")
      .select(["checkin_id", "place_id", "visited_on", "note", "created_at"])
      .where("account_id", "=", accountId)
      .orderBy("visited_on", "desc")
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((row) => ({
      checkinId: row.checkin_id,
      placeId: row.place_id,
      visitedOn: row.visited_on,
      note: row.note,
      createdAt: row.created_at,
    }));
  }

  public async createCheckin(accountId: string, input: CreateCheckinInput): Promise<LocationCheckinRecord> {
    const row = await this.database.db
      .insertInto("engagement.location_checkins")
      .values({
        account_id: accountId,
        place_id: input.placeId,
        visited_on: input.visitedOn,
        note: input.note,
      })
      .returning(["checkin_id", "place_id", "visited_on", "note", "created_at"])
      .executeTakeFirstOrThrow();
    return {
      checkinId: row.checkin_id,
      placeId: row.place_id,
      visitedOn: row.visited_on,
      note: row.note,
      createdAt: row.created_at,
    };
  }

  public async deleteCheckin(accountId: string, checkinId: string): Promise<boolean> {
    const deleted = await this.database.db
      .deleteFrom("engagement.location_checkins")
      .where("account_id", "=", accountId)
      .where("checkin_id", "=", checkinId)
      .returning("checkin_id")
      .executeTakeFirst();
    return deleted !== undefined;
  }

  public async listSeenPandas(accountId: string): Promise<SeenPandaRecord[]> {
    const rows = await this.database.db
      .selectFrom("engagement.seen_pandas")
      .select(["seen_id", "panda_id", "seen_on", "place_id", "note", "first_seen_at", "updated_at"])
      .where("account_id", "=", accountId)
      .orderBy("seen_on", "desc")
      .orderBy("first_seen_at", "desc")
      .execute();
    return rows.map((row) => this.seenPanda(row));
  }

  public async getSeenPanda(accountId: string, pandaId: string): Promise<SeenPandaRecord | undefined> {
    const row = await this.database.db
      .selectFrom("engagement.seen_pandas")
      .select(["seen_id", "panda_id", "seen_on", "place_id", "note", "first_seen_at", "updated_at"])
      .where("account_id", "=", accountId)
      .where("panda_id", "=", pandaId)
      .executeTakeFirst();
    return row === undefined ? undefined : this.seenPanda(row);
  }

  public async saveSeenPanda(accountId: string, input: SaveSeenPandaInput): Promise<SeenPandaRecord> {
    const row = await this.database.db
      .insertInto("engagement.seen_pandas")
      .values({
        account_id: accountId,
        panda_id: input.pandaId,
        seen_on: input.seenOn,
        place_id: input.placeId,
        note: input.note,
      })
      .onConflict((conflict) =>
        conflict.columns(["account_id", "panda_id"]).doUpdateSet({
          seen_on: input.seenOn,
          place_id: input.placeId,
          note: input.note,
          updated_at: new Date(),
        }),
      )
      .returning(["seen_id", "panda_id", "seen_on", "place_id", "note", "first_seen_at", "updated_at"])
      .executeTakeFirstOrThrow();
    return this.seenPanda(row);
  }

  public async deleteSeenPanda(accountId: string, pandaId: string): Promise<boolean> {
    const deleted = await this.database.db
      .deleteFrom("engagement.seen_pandas")
      .where("account_id", "=", accountId)
      .where("panda_id", "=", pandaId)
      .returning("panda_id")
      .executeTakeFirst();
    return deleted !== undefined;
  }

  private async getCollection(accountId: string, collectionId: string): Promise<CollectionRecord | undefined> {
    const rows = await this.database.db
      .selectFrom("engagement.collections as collection")
      .leftJoin("engagement.collection_pandas as item", "item.collection_id", "collection.collection_id")
      .select([
        "collection.collection_id",
        "collection.name",
        "collection.created_at",
        "collection.updated_at",
        "item.panda_id",
      ])
      .where("collection.account_id", "=", accountId)
      .where("collection.collection_id", "=", collectionId)
      .orderBy("item.added_at", "asc")
      .execute();
    const first = rows[0];
    if (first === undefined) {
      return undefined;
    }
    return {
      collectionId: first.collection_id,
      name: first.name,
      pandaIds: rows.flatMap((row) => (row.panda_id === null ? [] : [row.panda_id])),
      createdAt: first.created_at,
      updatedAt: first.updated_at,
    };
  }

  private async touchCollection(collectionId: string): Promise<void> {
    await this.database.db
      .updateTable("engagement.collections")
      .set({ updated_at: new Date() })
      .where("collection_id", "=", collectionId)
      .execute();
  }

  private seenPanda(row: {
    seen_id: string;
    panda_id: string;
    seen_on: string | null;
    place_id: string | null;
    note: string | null;
    first_seen_at: Date;
    updated_at: Date;
  }): SeenPandaRecord {
    return {
      seenId: row.seen_id,
      pandaId: row.panda_id,
      seenOn: row.seen_on,
      placeId: row.place_id,
      note: row.note,
      firstSeenAt: row.first_seen_at,
      updatedAt: row.updated_at,
    };
  }
}
