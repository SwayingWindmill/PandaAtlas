import type { AskDocumentKind, AskIndexedDocument, AskSourceLink } from "./ask-corpus.js";
import type { ChatMessage } from "./ask-answer.js";

export interface RetrievedChunk {
  itemKey: string;
  text: string;
  score: number;
}

/** The AI Search instance that holds the passages. */
export interface AskSearchIndex {
  search(query: string, maxResults: number): Promise<RetrievedChunk[]>;
  upload(key: string, content: string, metadata: Record<string, string>): Promise<{ id: string }>;
  delete(itemId: string): Promise<void>;
}

export interface AskModelClient {
  /** Returns the model's text; throws when the model or the gateway fails. */
  complete(model: string, messages: ChatMessage[], maxTokens: number): Promise<string>;
}

export interface AskRateLimiter {
  /** False when the caller has asked too often in the last minute. */
  allow(key: string): Promise<boolean>;
}

/** What the runtime offers for one request; absent outside a Worker or before bindings exist. */
export interface AskRuntimeBindings {
  index: AskSearchIndex;
  model: AskModelClient;
  rateLimiter: AskRateLimiter;
}

export type QuotaReservation =
  | { ok: true; remainingToday: number }
  | { ok: false; scope: "account" | "global" };

export interface AskQuotaRepository {
  reserve(accountId: string, day: string, accountLimit: number, globalCap: number): Promise<QuotaReservation>;
  used(accountId: string, day: string): Promise<number>;
}

export interface AskIndexRow {
  itemKey: string;
  kind: AskDocumentKind;
  titleZh: string;
  titleEn: string | null;
  appPath: string;
  sources: AskSourceLink[];
  contentSha256: string;
  itemId: string | null;
  uploaded: boolean;
}

export interface AskIndexRepository {
  /** Rows for keys that are uploaded; unknown or never-uploaded keys are left out. */
  uploadedByKeys(keys: string[]): Promise<AskIndexRow[]>;
  byKinds(kinds: AskDocumentKind[]): Promise<AskIndexRow[]>;
  all(): Promise<AskIndexRow[]>;
  saveUploaded(document: AskIndexedDocument, itemId: string): Promise<void>;
  remove(itemKey: string): Promise<void>;
  fingerprint(): Promise<string | null>;
  saveFingerprint(fingerprint: string): Promise<void>;
}

export interface AskCorpusSource {
  documents(): Promise<AskIndexedDocument[]>;
}
