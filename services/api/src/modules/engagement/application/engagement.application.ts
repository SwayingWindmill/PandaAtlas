export interface VenueFollowRecord {
  institutionSlug: string;
  followedAt: Date;
}

export interface FavoriteRecord {
  pandaId: string;
  favoritedAt: Date;
}

export interface CollectionRecord {
  collectionId: string;
  name: string;
  pandaIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationCheckinRecord {
  checkinId: string;
  placeId: string;
  visitedOn: string;
  note: string | null;
  createdAt: Date;
}

export interface SeenPandaRecord {
  seenId: string;
  pandaId: string;
  seenOn: string | null;
  placeId: string | null;
  note: string | null;
  firstSeenAt: Date;
  updatedAt: Date;
}

export interface CreateCheckinInput {
  placeId: string;
  visitedOn: string;
  note: string | null;
}

export interface SaveSeenPandaInput {
  pandaId: string;
  seenOn: string | null;
  placeId: string | null;
  note: string | null;
}

export interface EngagementPort {
  listFavorites(accountId: string): Promise<FavoriteRecord[]>;
  favorite(accountId: string, pandaId: string): Promise<FavoriteRecord>;
  unfavorite(accountId: string, pandaId: string): Promise<boolean>;

  listFollowedVenues(accountId: string): Promise<VenueFollowRecord[]>;
  /** Undefined when no institution has this slug. */
  followVenue(accountId: string, institutionSlug: string): Promise<VenueFollowRecord | undefined>;
  unfollowVenue(accountId: string, institutionSlug: string): Promise<boolean>;

  listCollections(accountId: string): Promise<CollectionRecord[]>;
  createCollection(accountId: string, name: string): Promise<CollectionRecord>;
  renameCollection(accountId: string, collectionId: string, name: string): Promise<CollectionRecord | undefined>;
  deleteCollection(accountId: string, collectionId: string): Promise<boolean>;
  addPandaToCollection(accountId: string, collectionId: string, pandaId: string): Promise<CollectionRecord | undefined>;
  removePandaFromCollection(accountId: string, collectionId: string, pandaId: string): Promise<CollectionRecord | undefined>;

  listCheckins(accountId: string): Promise<LocationCheckinRecord[]>;
  createCheckin(accountId: string, input: CreateCheckinInput): Promise<LocationCheckinRecord>;
  deleteCheckin(accountId: string, checkinId: string): Promise<boolean>;

  listSeenPandas(accountId: string): Promise<SeenPandaRecord[]>;
  getSeenPanda(accountId: string, pandaId: string): Promise<SeenPandaRecord | undefined>;
  saveSeenPanda(accountId: string, input: SaveSeenPandaInput): Promise<SeenPandaRecord>;
  deleteSeenPanda(accountId: string, pandaId: string): Promise<boolean>;
}

export const ENGAGEMENT_PORT = Symbol("ENGAGEMENT_PORT");
