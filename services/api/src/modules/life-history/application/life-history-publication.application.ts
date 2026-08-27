import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type {
  DatePrecision,
  LifeEventStatus,
  LifeEventType,
  ResidencyStatus,
  ResidencyType,
} from "./life-history.application.js";

export interface ResidencyPublicationSource {
  residencyId: string;
  pandaId: string;
  placeId: string;
  residencyType: ResidencyType;
  startOn?: string;
  startPrecision: DatePrecision;
  endOn?: string;
  endPrecision?: DatePrecision;
  status: ResidencyStatus;
  sourceIds: string[];
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
}

export interface LifeEventPublicationSource {
  eventId: string;
  eventType: LifeEventType;
  eventStatus: LifeEventStatus;
  occurredOn?: string;
  occurredPrecision: DatePrecision;
  fromPlaceId?: string;
  toPlaceId?: string;
  summary?: string;
  participantIds: string[];
  sourceIds: string[];
  sourceRevision: string;
  sourceVersion: string;
  sourceSha256: string;
}

export interface LifeHistoryPublicationSnapshot {
  residencies: ResidencyPublicationSource[];
  events: LifeEventPublicationSource[];
}

export interface LifeHistoryPublicationPort {
  snapshot(transaction: DatabaseTransaction): Promise<LifeHistoryPublicationSnapshot>;
}

export const LIFE_HISTORY_PUBLICATION_PORT = Symbol("LIFE_HISTORY_PUBLICATION_PORT");
