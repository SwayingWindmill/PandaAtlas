import type { V2ContributionInput, V2ContributionList, V2ContributionRecord } from "@/features/contribute/types";
import type { PublicLocale } from "@/foundation/content/locales";
import { ApiRequestError, requestJson } from "@/lib/api/request";

import type {
  Checkin,
  DailyPandaGuessResult,
  DailyPandaPuzzle,
  CheckinInput,
  CheckinList,
  DeletedCheckin,
  DeletedCollection,
  DeletedSeenPanda,
  FanCollection,
  FanCollectionList,
  FanSession,
  Favorite,
  FavoriteList,
  GameAttempt,
  GameAttemptInput,
  GameAttemptList,
  GuessAnswer,
  GuessQuestion,
  NotificationBulkRead,
  NotificationInbox,
  NotificationMessage,
  NotificationPreference,
  NotificationPreferenceInput,
  PandaBook,
  PassportEntry,
  SavedGameAttempt,
  SeenPanda,
  SeenPandaInput,
  SeenPandaList,
  Unfavorite,
} from "./types";

const encode = encodeURIComponent;

export function getFanSession(): Promise<FanSession> {
  return requestJson("/api/identity/session");
}

export async function listFavorites(): Promise<Favorite[]> {
  return (await requestJson<FavoriteList>("/api/engagement/favorites")).items;
}

export function setFavorite(pandaId: string, favorite: boolean): Promise<Favorite | Unfavorite> {
  return requestJson(`/api/engagement/favorites/${encode(pandaId)}`, { method: favorite ? "POST" : "DELETE" });
}

export async function getSeenPanda(pandaId: string): Promise<SeenPanda | null> {
  try {
    return await requestJson<SeenPanda>(`/api/engagement/seen-pandas/${encode(pandaId)}`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export async function listSeenPandas(): Promise<SeenPanda[]> {
  return (await requestJson<SeenPandaList>("/api/engagement/seen-pandas")).items;
}

export function saveSeenPanda(pandaId: string, record: SeenPandaInput): Promise<SeenPanda> {
  return requestJson(`/api/engagement/seen-pandas/${encode(pandaId)}`, { method: "PUT", body: JSON.stringify(record) });
}

export function removeSeenPanda(pandaId: string): Promise<DeletedSeenPanda> {
  return requestJson(`/api/engagement/seen-pandas/${encode(pandaId)}`, { method: "DELETE" });
}

export async function listCheckins(): Promise<Checkin[]> {
  return (await requestJson<CheckinList>("/api/engagement/checkins")).items;
}

export function createCheckin(record: CheckinInput): Promise<Checkin> {
  return requestJson("/api/engagement/checkins", { method: "POST", body: JSON.stringify(record) });
}

export function removeCheckin(checkinId: string): Promise<DeletedCheckin> {
  return requestJson(`/api/engagement/checkins/${encode(checkinId)}`, { method: "DELETE" });
}

export async function listCollections(): Promise<FanCollection[]> {
  return (await requestJson<FanCollectionList>("/api/engagement/collections")).items;
}

export function createCollection(name: string): Promise<FanCollection> {
  return requestJson("/api/engagement/collections", { method: "POST", body: JSON.stringify({ name }) });
}

export function renameCollection(collectionId: string, name: string): Promise<FanCollection> {
  return requestJson(`/api/engagement/collections/${encode(collectionId)}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export function deleteCollection(collectionId: string): Promise<DeletedCollection> {
  return requestJson(`/api/engagement/collections/${encode(collectionId)}`, { method: "DELETE" });
}

export function setCollectionMembership(collectionId: string, pandaId: string, member: boolean): Promise<FanCollection> {
  return requestJson(`/api/engagement/collections/${encode(collectionId)}/pandas/${encode(pandaId)}`, {
    method: member ? "POST" : "DELETE",
  });
}

export async function listGameAttempts(): Promise<GameAttempt[]> {
  return (await requestJson<GameAttemptList>("/api/engagement/game-attempts")).items;
}

export function saveGameAttempt(attempt: GameAttemptInput): Promise<SavedGameAttempt> {
  return requestJson("/api/engagement/game-attempts", { method: "POST", body: JSON.stringify(attempt) });
}

export function getPandaBook(): Promise<PandaBook> {
  return requestJson("/api/engagement/panda-book");
}

// The response also carries the evaluated result; the caller already has it from playing.
export function saveDailyPandaResult(guessPandaIds: string[]): Promise<{ saved: boolean }> {
  return requestJson("/api/engagement/daily-panda-results", { method: "POST", body: JSON.stringify({ guessPandaIds }) });
}

export async function listPassportEntries(): Promise<PassportEntry[]> {
  return (await requestJson<{ entries: PassportEntry[] }>("/api/engagement/passport")).entries;
}

export function getInbox(): Promise<NotificationInbox> {
  return requestJson("/api/notification/inbox");
}

export function markNotificationRead(messageId: string): Promise<NotificationMessage> {
  return requestJson(`/api/notification/inbox/${encode(messageId)}/read`, { method: "PATCH", body: "{}" });
}

export function markAllNotificationsRead(): Promise<NotificationBulkRead> {
  return requestJson("/api/notification/inbox/read-all", { method: "PATCH", body: "{}" });
}

export function listNotificationPreferences(): Promise<NotificationPreference[]> {
  return requestJson("/api/notification/preferences");
}

export function updateNotificationPreference(preference: NotificationPreferenceInput): Promise<NotificationPreference> {
  return requestJson("/api/notification/preferences", { method: "PUT", body: JSON.stringify(preference) });
}

export function listSubmissions(): Promise<V2ContributionList> {
  return requestJson("/api/community-intake/submissions");
}

export function getSubmission(submissionId: string): Promise<V2ContributionRecord> {
  return requestJson(`/api/community-intake/submissions/${encode(submissionId)}`);
}

export function submitContribution(body: V2ContributionInput): Promise<V2ContributionRecord> {
  return requestJson("/api/community-intake/submissions", { method: "POST", body: JSON.stringify(body) });
}

// The guess game is public: every question is a fresh server-side draw, so it is requested, not cached.
export function getGuessQuestion(locale: PublicLocale): Promise<GuessQuestion> {
  return requestJson(`/api/games/guess/question?locale=${locale}`);
}

export function getDailyPanda(): Promise<DailyPandaPuzzle> {
  return requestJson("/api/games/daily-panda");
}

export function guessDailyPanda(guessPandaIds: string[]): Promise<DailyPandaGuessResult> {
  return requestJson("/api/games/daily-panda/guesses", { method: "POST", body: JSON.stringify({ guessPandaIds }) });
}

export function answerGuess(answer: GameAttemptInput & { locale: PublicLocale }): Promise<GuessAnswer> {
  return requestJson("/api/games/guess/answer", { method: "POST", body: JSON.stringify(answer) });
}
