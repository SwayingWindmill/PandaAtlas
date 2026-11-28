import AsyncStorage from "@react-native-async-storage/async-storage";

/** Intentionally outside `offline:*` so Settings -> "清除本地缓存" never drops offline session continuity. */
export const SESSION_ACCOUNT_CACHE_KEY = "session:account-cache:v1";

interface CachedAccountMapping {
  userId: string;
  accountId: string;
}

function isValidMapping(value: unknown): value is CachedAccountMapping {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<CachedAccountMapping>;
  return (
    typeof candidate.userId === "string" &&
    candidate.userId.length > 0 &&
    typeof candidate.accountId === "string" &&
    candidate.accountId.length > 0
  );
}

/** Reads the cached app account ID when it matches the active Supabase user ID. */
export async function readCachedAccountId(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(SESSION_ACCOUNT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidMapping(parsed)) return null;
    return parsed.userId === userId ? parsed.accountId : null;
  } catch {
    return null;
  }
}

/** Stores the verified `(supabaseUserId, accountId)` mapping for offline restarts. */
export async function writeCachedAccountId(userId: string, accountId: string): Promise<void> {
  if (!userId || !accountId) return;
  try {
    const payload: CachedAccountMapping = { userId, accountId };
    await AsyncStorage.setItem(SESSION_ACCOUNT_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal: offline fallback simply stays unavailable without storage.
  }
}

/** Clears cached account continuity on explicit sign-out or revoked/suspended auth responses. */
export async function clearCachedAccountId(): Promise<void> {
  try {
    await AsyncStorage.removeMany([SESSION_ACCOUNT_CACHE_KEY]);
  } catch {
    // Best-effort cleanup.
  }
}
