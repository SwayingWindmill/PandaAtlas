import type { components } from "@zhipanda/api-client";

type Schemas = components["schemas"];

export type FanSession = Schemas["CurrentAccountDto"];
export type Favorite = Schemas["FavoriteDto"];
export type FavoriteList = Schemas["FavoriteListDto"];
export type Unfavorite = Schemas["UnfavoriteDto"];
export type FanCollection = Schemas["CollectionDto"];
export type FanCollectionList = Schemas["CollectionListDto"];
export type DeletedCollection = Schemas["DeletedCollectionDto"];
export type Checkin = Schemas["CheckinDto"];
export type CheckinList = Schemas["CheckinListDto"];
export type CheckinInput = Schemas["CreateCheckinDto"];
export type DeletedCheckin = Schemas["DeletedCheckinDto"];
export type SeenPanda = Schemas["SeenPandaDto"];
export type SeenPandaList = Schemas["SeenPandaListDto"];
export type SeenPandaInput = Schemas["SaveSeenPandaDto"];
export type DeletedSeenPanda = Schemas["DeletedSeenPandaDto"];
export type GameAttempt = Schemas["GameAttemptDto"];
export type GameAttemptList = Schemas["GameAttemptListDto"];
export type GameAttemptInput = Schemas["GuessAnswerDto"];
export type SavedGameAttempt = Schemas["SavedGameAttemptDto"];
export type NotificationMessage = Schemas["NotificationMessageDto"];
export type NotificationBulkRead = Schemas["NotificationBulkReadResultDto"];
export type NotificationPreference = Schemas["NotificationPreferenceDto"];
export type NotificationPreferenceInput = Schemas["NotificationPreferenceInputDto"];

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
