import { useSession } from "@/features/session/session";

export function useAccount(): { accountId: string | null; unavailable: boolean } {
  const { state } = useSession();
  return {
    accountId: state.status === "signedIn" ? state.accountId : null,
    // Signed out, or the session cannot be checked: personal data will not load, so screens show their failed state.
    unavailable: state.status === "signedOut" || state.status === "unavailable",
  };
}
