export interface EngagementFollowCount {
  pandaId: string;
  followers: number;
}

export interface EngagementFollowCountPort {
  /** Distinct new followers per panda since `since`. */
  followCounts(since: Date): Promise<EngagementFollowCount[]>;
}

export const ENGAGEMENT_FOLLOW_COUNT_PORT = Symbol("ENGAGEMENT_FOLLOW_COUNT_PORT");
