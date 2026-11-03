import {
  acceptsToday,
  decideCancelLeave,
  decideLeave,
  decideVisit,
  summarizeDailyCheckins,
  type DailyCheckinDecision,
  type DailyCheckinRecord,
  type DailyCheckinRefusal,
  type DailyCheckinSummary,
} from "./daily-checkin.js";

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

export type DailyCheckinResult =
  | { ok: true; summary: DailyCheckinSummary }
  | { ok: false; refusal: DailyCheckinRefusal };

export interface EngagementRepository {
  listFavorites(accountId: string): Promise<FavoriteRecord[]>;
  favorite(accountId: string, pandaId: string): Promise<FavoriteRecord>;
  unfavorite(accountId: string, pandaId: string): Promise<boolean>;

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

  listDailyCheckins(accountId: string): Promise<DailyCheckinRecord[]>;
  /**
   * Serializes one member's check-in edits: reads their days, lets `decide`
   * choose a change, applies it and returns the days after the change.
   */
  editDailyCheckins(
    accountId: string,
    decide: (records: DailyCheckinRecord[]) => DailyCheckinDecision,
  ): Promise<{ decision: DailyCheckinDecision; records: DailyCheckinRecord[] }>;
}

export interface EngagementPort extends Omit<EngagementRepository, "listDailyCheckins" | "editDailyCheckins"> {
  dailyCheckins(accountId: string, today: string): Promise<DailyCheckinResult>;
  recordDailyVisit(accountId: string, today: string): Promise<DailyCheckinResult>;
  takeDailyLeave(accountId: string, day: string, today: string): Promise<DailyCheckinResult>;
  cancelDailyLeave(accountId: string, day: string, today: string): Promise<DailyCheckinResult>;
}

export const ENGAGEMENT_REPOSITORY = Symbol("ENGAGEMENT_REPOSITORY");
export const ENGAGEMENT_PORT = Symbol("ENGAGEMENT_PORT");

export class EngagementApplication implements EngagementPort {
  public constructor(
    private readonly repository: EngagementRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public listFavorites(accountId: string) { return this.repository.listFavorites(accountId); }
  public favorite(accountId: string, pandaId: string) { return this.repository.favorite(accountId, pandaId); }
  public unfavorite(accountId: string, pandaId: string) { return this.repository.unfavorite(accountId, pandaId); }
  public listCollections(accountId: string) { return this.repository.listCollections(accountId); }
  public createCollection(accountId: string, name: string) { return this.repository.createCollection(accountId, name); }
  public renameCollection(accountId: string, collectionId: string, name: string) { return this.repository.renameCollection(accountId, collectionId, name); }
  public deleteCollection(accountId: string, collectionId: string) { return this.repository.deleteCollection(accountId, collectionId); }
  public addPandaToCollection(accountId: string, collectionId: string, pandaId: string) { return this.repository.addPandaToCollection(accountId, collectionId, pandaId); }
  public removePandaFromCollection(accountId: string, collectionId: string, pandaId: string) { return this.repository.removePandaFromCollection(accountId, collectionId, pandaId); }
  public listCheckins(accountId: string) { return this.repository.listCheckins(accountId); }
  public createCheckin(accountId: string, input: CreateCheckinInput) { return this.repository.createCheckin(accountId, input); }
  public deleteCheckin(accountId: string, checkinId: string) { return this.repository.deleteCheckin(accountId, checkinId); }
  public listSeenPandas(accountId: string) { return this.repository.listSeenPandas(accountId); }
  public getSeenPanda(accountId: string, pandaId: string) { return this.repository.getSeenPanda(accountId, pandaId); }
  public saveSeenPanda(accountId: string, input: SaveSeenPandaInput) { return this.repository.saveSeenPanda(accountId, input); }
  public deleteSeenPanda(accountId: string, pandaId: string) { return this.repository.deleteSeenPanda(accountId, pandaId); }

  public async dailyCheckins(accountId: string, today: string): Promise<DailyCheckinResult> {
    if (!acceptsToday(today, this.now())) return { ok: false, refusal: "todayOutOfRange" };
    return { ok: true, summary: summarizeDailyCheckins(await this.repository.listDailyCheckins(accountId), today) };
  }

  public recordDailyVisit(accountId: string, today: string): Promise<DailyCheckinResult> {
    return this.editDailyCheckins(accountId, today, (records) => decideVisit(records, today));
  }

  public takeDailyLeave(accountId: string, day: string, today: string): Promise<DailyCheckinResult> {
    return this.editDailyCheckins(accountId, today, (records) => decideLeave(records, day, today));
  }

  public cancelDailyLeave(accountId: string, day: string, today: string): Promise<DailyCheckinResult> {
    return this.editDailyCheckins(accountId, today, (records) => decideCancelLeave(records, day, today));
  }

  private async editDailyCheckins(
    accountId: string,
    today: string,
    decide: (records: DailyCheckinRecord[]) => DailyCheckinDecision,
  ): Promise<DailyCheckinResult> {
    if (!acceptsToday(today, this.now())) return { ok: false, refusal: "todayOutOfRange" };
    const { decision, records } = await this.repository.editDailyCheckins(accountId, decide);
    if (!decision.ok) return { ok: false, refusal: decision.refusal };
    return { ok: true, summary: summarizeDailyCheckins(records, today) };
  }
}
