import type { PandaDetail } from "@/lib/types";

export interface PublicMomentOccurrence {
  id: string;
  occurrenceKind: "source_event" | "derived_anniversary";
  eventType: string;
  eventStatus: string;
  occurrenceDate: string;
  sourceEventId: string;
  anniversaryYear: number | null;
  participants: PandaDetail[];
  sourceIds: string[];
  fromFacilityId: string | null;
  fromCoarseLocation: string | null;
  toFacilityId: string | null;
  toCoarseLocation: string | null;
}

export interface MomentQuery {
  year?: number;
  month?: number;
  panda?: string;
  eventType?: string;
  includeAnniversaries?: boolean;
  sort?: "date_asc" | "date_desc";
}
