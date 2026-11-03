import { QueryClient } from "@tanstack/react-query";

// Public queries keep the existing network-first offline fallback available.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});
