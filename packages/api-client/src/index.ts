import createClient from "openapi-fetch";
import type { paths } from "./schema.generated.js";

export type { components, operations, paths } from "./schema.generated.js";

export function createApiClient(
  baseUrl: string,
  customFetch?: (input: Request) => Promise<Response>,
) {
  return createClient<paths>({ baseUrl, fetch: customFetch });
}

export type ApiClient = ReturnType<typeof createApiClient>;
