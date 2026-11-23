import { useSession } from "@/features/session/session";

/**
 * The signed-in account for a private query: its id is the cache key and the query stays disabled while it is
 * null. `unavailable` is true once the session settled without an account, so a screen can fail instead of
 * waiting for a fetch that will never start.
 */
export function useAccount(): { accountId: string | null; unavailable: boolean } {
  const { state } = useSession();
  return {
    accountId: state.status === "signedIn" ? state.accountId : null,
    unavailable: state.status === "signedOut" || state.status === "unavailable",
  };
}
