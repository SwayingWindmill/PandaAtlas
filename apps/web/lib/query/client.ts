import { isServer, QueryClient } from "@tanstack/react-query";

import { ApiRequestError } from "@/lib/api/request";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // An answer from the server (signed out, refused, unavailable) is shown at once;
        // only a request that never got an answer is retried.
        retry: (failureCount, error) => !(error instanceof ApiRequestError) && failureCount < 2,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// One client per browser; a fresh one per server render.
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
