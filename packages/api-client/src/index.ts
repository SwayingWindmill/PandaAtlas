import createClient from "openapi-fetch";
import type { paths } from "./schema.generated.js";

export type { components, operations, paths } from "./schema.generated.js";

export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type ApiClient = ReturnType<typeof createApiClient>;
