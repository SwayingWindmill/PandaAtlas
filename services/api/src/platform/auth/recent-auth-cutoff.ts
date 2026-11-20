export const RECENT_AUTH_CUTOFF = Symbol("RECENT_AUTH_CUTOFF");

/** Returns an epoch-millisecond cutoff for an account; interactive auth at or before it counts as lapsed. */
export type RecentAuthCutoff = (accountId: string) => number | undefined;
