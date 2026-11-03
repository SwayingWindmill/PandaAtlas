import { AsyncLocalStorage } from "node:async_hooks";

interface PublicReadRequestState {
  unavailable: boolean;
}

// One store per Worker request. The page render and the not-found fallback share it,
// so a failed public read can change that fallback without a client-controlled header.
const requests = new AsyncLocalStorage<PublicReadRequestState>();

export function withPublicReadRequest<T>(run: () => T): T {
  return requests.run({ unavailable: false }, run);
}

export function markPublicReadUnavailable(): void {
  const current = requests.getStore();
  if (current) current.unavailable = true;
}

export function publicReadUnavailableDuringRequest(): boolean {
  return requests.getStore()?.unavailable === true;
}

// vinext renders NEXT_HTTP_ERROR_FALLBACK as that status. 503 is not a cacheable
// status, and the edge policy also forces no-store on every 5xx.
export const PUBLIC_READ_UNAVAILABLE_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;503";

export interface PublicReadResult<T = unknown> {
  data?: T;
  error?: unknown;
  response?: Response;
}

export interface PublicReadFailureOptions {
  // Navigation search is optional chrome. Its failure must not mark the request,
  // or a genuine not-found rendered alongside an empty menu would show the outage copy.
  mark?: boolean;
}

function publicReadFailure(cause: unknown, options?: PublicReadFailureOptions): Error {
  if (options?.mark !== false) markPublicReadUnavailable();
  const error = new Error("Public information is temporarily unavailable");
  error.name = "PublicReadUnavailable";
  (error as Error & { digest?: string }).digest = PUBLIC_READ_UNAVAILABLE_DIGEST;
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function publicReadUnavailable(cause?: unknown): Error {
  return publicReadFailure(cause);
}

export function isPublicReadUnavailable(error: unknown): boolean {
  return error instanceof Error && (error as { digest?: unknown }).digest === PUBLIC_READ_UNAVAILABLE_DIGEST;
}

// generateMetadata must not throw this digest. vinext would answer the document with 200
// and the edge would cache that document as a successful page. Empty metadata lets the page
// throw, which keeps the 503.
export async function readPublicMetadata<T>(load: () => Promise<T | null>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isPublicReadUnavailable(error)) return null;
    throw error;
  }
}

function succeeded(result: PublicReadResult): boolean {
  const status = result.response?.status;
  return result.data != null && status !== undefined && status >= 200 && status < 300;
}

// A thrown fetch is a network, timeout, or service-binding failure.
export async function settlePublicRead<T extends PublicReadResult>(
  read: Promise<T>,
  options?: PublicReadFailureOptions,
): Promise<T> {
  try {
    return await read;
  } catch (cause) {
    throw publicReadFailure(cause, options);
  }
}

// List reads have no "missing slug". A 404, 5xx, or empty transport result is unavailable.
export function requirePublicCollection<T>(result: PublicReadResult<T>, options?: PublicReadFailureOptions): T {
  if (succeeded(result)) return result.data as T;
  throw publicReadFailure(result.error ?? result.response?.status, options);
}

// A resource read may be a genuine 404. Every other failure is unavailable.
export function readPublicResource<T>(result: PublicReadResult<T>, options?: PublicReadFailureOptions): T | null {
  if (succeeded(result)) return result.data as T;
  if (result.response?.status === 404) return null;
  throw publicReadFailure(result.error ?? result.response?.status, options);
}
