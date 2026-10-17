import type { components } from "@zhipanda/api-client";

export type FanSession = components["schemas"]["CurrentAccountDto"];
export type Favorite = components["schemas"]["FavoriteDto"];
export type FanCollection = components["schemas"]["CollectionDto"];
export type Checkin = components["schemas"]["CheckinDto"];
export type SeenPanda = components["schemas"]["SeenPandaDto"];
export type GameAttempt = components["schemas"]["GameAttemptDto"];
export type NotificationMessage = components["schemas"]["NotificationMessageDto"];
export type NotificationPreference = components["schemas"]["NotificationPreferenceDto"];

// Composed by the Web app's own routes rather than one API operation.
export interface PassportEntry {
  pandaId: string;
  relationshipState: "active" | "inactive" | null;
  firstFollowedAt: string | null;
  contributionCount: number;
}

export interface NotificationInbox {
  items: NotificationMessage[];
  unreadCount: number;
}

export interface GuessQuestion {
  questionId: string;
  imageUrl: string;
  imageAlt: string;
  difficulty: "easy" | "medium" | "hard";
  options: Array<{ pandaId: string; name: string }>;
}

export interface GuessAnswer {
  correct: boolean;
  answer: { pandaId: string; name: string; slug: string };
  recognitionTips: string[];
}
