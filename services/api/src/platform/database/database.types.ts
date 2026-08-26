import type { DB as IdentityDatabase } from "./database.identity.generated.js";
import type { DB as IntegrationDatabase } from "./database.integration.generated.js";

export type Database = IdentityDatabase & IntegrationDatabase;
