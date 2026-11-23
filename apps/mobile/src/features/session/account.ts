import { useSession } from "@/features/session/session";

export function useAccount(): { accountId: string | null; unavailable: boolean } {
  const { state } = useSession();
  return {
    accountId: state.status === "signedIn" ? state.accountId : null,
    unavailable: state.status === "signedOut" || state.status === "unavailable",
  };
}
