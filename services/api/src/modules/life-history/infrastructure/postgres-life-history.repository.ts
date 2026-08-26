import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  CreateLifeEventInput,
  CreateResidencyInput,
  DatePrecision,
  LifeEventRecord,
  LifeEventStatus,
  LifeEventType,
  LifeHistoryRecord,
  LifeHistoryRepository,
  ResidencyRecord,
  ResidencyStatus,
  ResidencyType,
} from "../application/life-history.application.js";

function dateOnly(value: string | null): string | undefined {
  return value === null ? undefined : value;
}

export class PostgresLifeHistoryRepository implements LifeHistoryRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async createResidency(input: CreateResidencyInput): Promise<ResidencyRecord> {
    await this.database.transaction(async (transaction) => {
      await transaction.insertInto("life_history.residencies").values({
        residency_id: input.residencyId,
        panda_id: input.pandaId,
        place_id: input.placeId,
        residency_type: input.residencyType,
        start_on: input.startOn,
        start_precision: input.startPrecision,
        end_on: input.endOn,
        end_precision: input.endPrecision,
        status: input.status,
      }).execute();
      await transaction.insertInto("life_history.residency_sources").values(
        input.sourceIds.map((sourceId) => ({ residency_id: input.residencyId, source_id: sourceId })),
      ).execute();
    });
    return {
      residencyId: input.residencyId,
      pandaId: input.pandaId,
      placeId: input.placeId,
      residencyType: input.residencyType,
      ...(input.startOn === undefined ? {} : { startOn: input.startOn }),
      startPrecision: input.startPrecision,
      ...(input.endOn === undefined ? {} : { endOn: input.endOn }),
      ...(input.endPrecision === undefined ? {} : { endPrecision: input.endPrecision }),
      status: input.status,
    };
  }

  public async closeResidency(
    residencyId: string,
    endOn: string,
    endPrecision: Exclude<DatePrecision, "unknown">,
    status?: ResidencyStatus,
  ): Promise<void> {
    await this.database.db
      .updateTable("life_history.residencies")
      .set(
        status === undefined
          ? { end_on: endOn, end_precision: endPrecision, updated_at: new Date() }
          : { end_on: endOn, end_precision: endPrecision, status, updated_at: new Date() },
      )
      .where("residency_id", "=", residencyId)
      .returning("residency_id")
      .executeTakeFirstOrThrow();
  }

  public async createEvent(input: CreateLifeEventInput): Promise<LifeEventRecord> {
    await this.database.transaction(async (transaction) => {
      await transaction.insertInto("life_history.events").values({
        event_id: input.eventId,
        event_type: input.eventType,
        event_status: input.eventStatus,
        occurred_on: input.occurredOn,
        occurred_precision: input.occurredPrecision,
        from_place_id: input.fromPlaceId,
        to_place_id: input.toPlaceId,
        summary: input.summary,
      }).execute();
      await transaction.insertInto("life_history.event_participants").values(
        [...new Set(input.participantIds)].map((pandaId) => ({
          event_id: input.eventId,
          panda_id: pandaId,
          participant_role: "subject",
        })),
      ).execute();
      await transaction.insertInto("life_history.event_sources").values(
        input.sourceIds.map((sourceId) => ({ event_id: input.eventId, source_id: sourceId })),
      ).execute();
    });
    return {
      eventId: input.eventId,
      eventType: input.eventType,
      eventStatus: input.eventStatus,
      ...(input.occurredOn === undefined ? {} : { occurredOn: input.occurredOn }),
      occurredPrecision: input.occurredPrecision,
      ...(input.fromPlaceId === undefined ? {} : { fromPlaceId: input.fromPlaceId }),
      ...(input.toPlaceId === undefined ? {} : { toPlaceId: input.toPlaceId }),
      ...(input.summary === undefined ? {} : { summary: input.summary }),
      participantIds: [...new Set(input.participantIds)],
    };
  }

  public async setEventStatus(eventId: string, status: LifeEventStatus): Promise<void> {
    await this.database.db
      .updateTable("life_history.events")
      .set({ event_status: status, updated_at: new Date() })
      .where("event_id", "=", eventId)
      .returning("event_id")
      .executeTakeFirstOrThrow();
  }

  public async getForPanda(pandaId: string): Promise<LifeHistoryRecord> {
    const [residencies, eventRows] = await Promise.all([
      this.database.db
        .selectFrom("life_history.residencies")
        .selectAll()
        .where("panda_id", "=", pandaId)
        .orderBy("start_on", "asc")
        .execute(),
      this.database.db
        .selectFrom("life_history.event_participants as participant")
        .innerJoin("life_history.events as event", "event.event_id", "participant.event_id")
        .select([
          "event.event_id",
          "event.event_type",
          "event.event_status",
          "event.occurred_on",
          "event.occurred_precision",
          "event.from_place_id",
          "event.to_place_id",
          "event.summary",
        ])
        .where("participant.panda_id", "=", pandaId)
        .orderBy("event.occurred_on", "asc")
        .execute(),
    ]);

    const eventIds = eventRows.map((event) => event.event_id);
    const participants = eventIds.length === 0
      ? []
      : await this.database.db
          .selectFrom("life_history.event_participants")
          .select(["event_id", "panda_id"])
          .where("event_id", "in", eventIds)
          .execute();

    return {
      residencies: residencies.map((row): ResidencyRecord => ({
        residencyId: row.residency_id,
        pandaId: row.panda_id,
        placeId: row.place_id,
        residencyType: row.residency_type as ResidencyType,
        ...(dateOnly(row.start_on) === undefined ? {} : { startOn: dateOnly(row.start_on) }),
        startPrecision: row.start_precision as DatePrecision,
        ...(dateOnly(row.end_on) === undefined ? {} : { endOn: dateOnly(row.end_on) }),
        ...(row.end_precision === null ? {} : { endPrecision: row.end_precision as DatePrecision }),
        status: row.status as ResidencyStatus,
      })),
      events: eventRows.map((row): LifeEventRecord => ({
        eventId: row.event_id,
        eventType: row.event_type as LifeEventType,
        eventStatus: row.event_status as LifeEventStatus,
        ...(dateOnly(row.occurred_on) === undefined ? {} : { occurredOn: dateOnly(row.occurred_on) }),
        occurredPrecision: row.occurred_precision as DatePrecision,
        ...(row.from_place_id === null ? {} : { fromPlaceId: row.from_place_id }),
        ...(row.to_place_id === null ? {} : { toPlaceId: row.to_place_id }),
        ...(row.summary === null ? {} : { summary: row.summary }),
        participantIds: participants
          .filter((participant) => participant.event_id === row.event_id)
          .map((participant) => participant.panda_id),
      })),
    };
  }
}
