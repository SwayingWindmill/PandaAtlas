import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type {
  LifeEventPublicationSource,
  LifeHistoryPublicationPort,
  LifeHistoryPublicationSnapshot,
  ResidencyPublicationSource,
} from "../application/life-history-publication.application.js";
import type {
  DatePrecision,
  LifeEventStatus,
  LifeEventType,
  ResidencyStatus,
  ResidencyType,
} from "../application/life-history.application.js";

function addToMap(map: Map<string, string[]>, key: string, value: string): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

export class PostgresLifeHistoryPublicationQuery implements LifeHistoryPublicationPort {
  public async snapshot(transaction: DatabaseTransaction): Promise<LifeHistoryPublicationSnapshot> {
    const residencyRows = await transaction
      .selectFrom("life_history.residencies")
      .selectAll()
      .where("status", "in", ["confirmed", "confirmed_country_level"])
      .orderBy("residency_id")
      .execute();
    const residencySourceRows = await transaction
      .selectFrom("life_history.residency_sources")
      .select(["residency_id", "source_id"])
      .orderBy("residency_id")
      .orderBy("source_id")
      .execute();
    const residencySources = new Map<string, string[]>();
    for (const row of residencySourceRows) addToMap(residencySources, row.residency_id, row.source_id);

    const eventRows = await transaction
      .selectFrom("life_history.events")
      .selectAll()
      .where("event_status", "in", ["announced", "completed"])
      .orderBy("event_id")
      .execute();
    const participantRows = await transaction
      .selectFrom("life_history.event_participants")
      .select(["event_id", "panda_id"])
      .orderBy("event_id")
      .orderBy("panda_id")
      .execute();
    const eventSourceRows = await transaction
      .selectFrom("life_history.event_sources")
      .select(["event_id", "source_id"])
      .orderBy("event_id")
      .orderBy("source_id")
      .execute();
    const participants = new Map<string, string[]>();
    const eventSources = new Map<string, string[]>();
    for (const row of participantRows) addToMap(participants, row.event_id, row.panda_id);
    for (const row of eventSourceRows) addToMap(eventSources, row.event_id, row.source_id);

    const residencies: ResidencyPublicationSource[] = residencyRows.map((row) => {
      const projection = {
        residencyId: row.residency_id,
        pandaId: row.panda_id,
        placeId: row.place_id,
        residencyType: row.residency_type as ResidencyType,
        ...(row.start_on === null ? {} : { startOn: row.start_on }),
        startPrecision: row.start_precision as DatePrecision,
        ...(row.end_on === null ? {} : { endOn: row.end_on }),
        ...(row.end_precision === null ? {} : { endPrecision: row.end_precision as DatePrecision }),
        status: row.status as ResidencyStatus,
        sourceIds: residencySources.get(row.residency_id) ?? [],
      };
      const revision = row.updated_at.toISOString();
      return {
        ...projection,
        sourceRevision: revision,
        sourceVersion: revision,
        sourceSha256: sha256Content(projection),
      };
    });

    const events: LifeEventPublicationSource[] = eventRows.map((row) => {
      const projection = {
        eventId: row.event_id,
        eventType: row.event_type as LifeEventType,
        eventStatus: row.event_status as LifeEventStatus,
        ...(row.occurred_on === null ? {} : { occurredOn: row.occurred_on }),
        occurredPrecision: row.occurred_precision as DatePrecision,
        ...(row.from_place_id === null ? {} : { fromPlaceId: row.from_place_id }),
        ...(row.to_place_id === null ? {} : { toPlaceId: row.to_place_id }),
        ...(row.summary === null ? {} : { summary: row.summary }),
        participantIds: participants.get(row.event_id) ?? [],
        sourceIds: eventSources.get(row.event_id) ?? [],
      };
      const revision = row.updated_at.toISOString();
      return {
        ...projection,
        sourceRevision: revision,
        sourceVersion: revision,
        sourceSha256: sha256Content(projection),
      };
    });

    return { residencies, events };
  }
}
