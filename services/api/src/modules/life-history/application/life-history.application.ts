import type { PandaReferencePort } from "../../panda/application/panda.application.js";
import type { PlaceReferencePort } from "../../places/application/places.application.js";

export type DatePrecision = "day" | "month" | "year" | "unknown";
export type ResidencyType = "primary" | "temporary" | "transit" | "quarantine";
export type ResidencyStatus = "confirmed" | "confirmed_country_level" | "provisional";
export type LifeEventType =
  | "birth"
  | "arrival"
  | "transfer"
  | "return"
  | "naming"
  | "public_debut"
  | "selection"
  | "announcement"
  | "observation"
  | "death";
export type LifeEventStatus = "announced" | "completed" | "cancelled" | "disputed";

export interface ResidencyRecord {
  residencyId: string;
  pandaId: string;
  placeId: string;
  residencyType: ResidencyType;
  startOn?: string;
  startPrecision: DatePrecision;
  endOn?: string;
  endPrecision?: DatePrecision;
  status: ResidencyStatus;
}

export interface LifeEventRecord {
  eventId: string;
  eventType: LifeEventType;
  eventStatus: LifeEventStatus;
  occurredOn?: string;
  occurredPrecision: DatePrecision;
  fromPlaceId?: string;
  toPlaceId?: string;
  summary?: string;
  participantIds: string[];
}

export interface CreateResidencyInput extends ResidencyRecord {
  sourceIds: string[];
}

export interface CreateLifeEventInput extends Omit<LifeEventRecord, "participantIds"> {
  participantIds: string[];
  sourceIds: string[];
}

export interface LifeHistoryRecord {
  residencies: ResidencyRecord[];
  events: LifeEventRecord[];
}

export interface LifeHistoryRepository {
  createResidency(input: CreateResidencyInput): Promise<ResidencyRecord>;
  closeResidency(
    residencyId: string,
    endOn: string,
    endPrecision: Exclude<DatePrecision, "unknown">,
    status?: ResidencyStatus,
  ): Promise<void>;
  createEvent(input: CreateLifeEventInput): Promise<LifeEventRecord>;
  setEventStatus(eventId: string, status: LifeEventStatus): Promise<void>;
  getForPanda(pandaId: string): Promise<LifeHistoryRecord>;
}

export type LifeHistoryPort = LifeHistoryRepository;

export const LIFE_HISTORY_REPOSITORY = Symbol("LIFE_HISTORY_REPOSITORY");
export const LIFE_HISTORY_PORT = Symbol("LIFE_HISTORY_PORT");

export class LifeHistoryApplication implements LifeHistoryPort {
  public constructor(
    private readonly repository: LifeHistoryRepository,
    private readonly pandas: PandaReferencePort,
    private readonly places: PlaceReferencePort,
  ) {}

  public async createResidency(input: CreateResidencyInput): Promise<ResidencyRecord> {
    if (!(await this.pandas.exists(input.pandaId))) {
      throw new Error(`Unknown panda ${input.pandaId}`);
    }
    if (!(await this.places.exists(input.placeId))) {
      throw new Error(`Unknown place ${input.placeId}`);
    }
    if (input.sourceIds.length === 0) {
      throw new Error("Residencies require at least one evidence source");
    }
    return this.repository.createResidency(input);
  }

  public closeResidency(
    residencyId: string,
    endOn: string,
    endPrecision: Exclude<DatePrecision, "unknown">,
    status?: ResidencyStatus,
  ): Promise<void> {
    return this.repository.closeResidency(residencyId, endOn, endPrecision, status);
  }

  public async createEvent(input: CreateLifeEventInput): Promise<LifeEventRecord> {
    if (input.participantIds.length === 0) {
      throw new Error("Life events require at least one panda participant");
    }
    if (input.sourceIds.length === 0) {
      throw new Error("Life events require at least one evidence source");
    }
    for (const pandaId of new Set(input.participantIds)) {
      if (!(await this.pandas.exists(pandaId))) {
        throw new Error(`Unknown panda ${pandaId}`);
      }
    }
    for (const placeId of [input.fromPlaceId, input.toPlaceId]) {
      if (placeId !== undefined && !(await this.places.exists(placeId))) {
        throw new Error(`Unknown place ${placeId}`);
      }
    }
    return this.repository.createEvent(input);
  }

  public setEventStatus(eventId: string, status: LifeEventStatus): Promise<void> {
    return this.repository.setEventStatus(eventId, status);
  }

  public async getForPanda(pandaId: string): Promise<LifeHistoryRecord> {
    if (!(await this.pandas.exists(pandaId))) {
      throw new Error(`Unknown panda ${pandaId}`);
    }
    return this.repository.getForPanda(pandaId);
  }
}
