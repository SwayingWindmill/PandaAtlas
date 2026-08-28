import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type {
  CreateLifeEventInput,
  CreateResidencyInput,
  LifeHistoryCurationParticipant,
} from "../application/life-history.application.js";

export class PostgresLifeHistoryCurationParticipant implements LifeHistoryCurationParticipant {
  public async applyCuratedResidency(
    transaction: DatabaseTransaction,
    input: CreateResidencyInput,
  ): Promise<string> {
    if (input.sourceIds.length === 0) {
      throw new Error("Residencies require at least one evidence source");
    }
    const [panda, place] = await Promise.all([
      transaction
        .selectFrom("panda.pandas")
        .select("panda_id")
        .where("panda_id", "=", input.pandaId)
        .executeTakeFirst(),
      transaction
        .selectFrom("place.places")
        .select("place_id")
        .where("place_id", "=", input.placeId)
        .executeTakeFirst(),
    ]);
    if (panda === undefined) throw new Error(`Unknown panda ${input.pandaId}`);
    if (place === undefined) throw new Error(`Unknown place ${input.placeId}`);

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
      [...new Set(input.sourceIds)].map((sourceId) => ({
        residency_id: input.residencyId,
        source_id: sourceId,
      })),
    ).execute();
    return input.residencyId;
  }

  public async applyCuratedEvent(
    transaction: DatabaseTransaction,
    input: CreateLifeEventInput,
  ): Promise<string> {
    const participantIds = [...new Set(input.participantIds)];
    if (participantIds.length === 0) {
      throw new Error("Life events require at least one panda participant");
    }
    if (input.sourceIds.length === 0) {
      throw new Error("Life events require at least one evidence source");
    }

    const pandas = await transaction
      .selectFrom("panda.pandas")
      .select("panda_id")
      .where("panda_id", "in", participantIds)
      .execute();
    if (new Set(pandas.map((panda) => panda.panda_id)).size !== participantIds.length) {
      throw new Error("Curated life event references an unknown Panda");
    }
    const placeIds = [...new Set([input.fromPlaceId, input.toPlaceId].filter((value): value is string => value !== undefined))];
    if (placeIds.length > 0) {
      const places = await transaction
        .selectFrom("place.places")
        .select("place_id")
        .where("place_id", "in", placeIds)
        .execute();
      if (new Set(places.map((place) => place.place_id)).size !== placeIds.length) {
        throw new Error("Curated life event references an unknown place");
      }
    }

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
      participantIds.map((pandaId) => ({
        event_id: input.eventId,
        panda_id: pandaId,
        participant_role: "subject",
      })),
    ).execute();
    await transaction.insertInto("life_history.event_sources").values(
      [...new Set(input.sourceIds)].map((sourceId) => ({
        event_id: input.eventId,
        source_id: sourceId,
      })),
    ).execute();
    return input.eventId;
  }
}
