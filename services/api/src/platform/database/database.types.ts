import type { DB as IdentityDatabase } from "./database.identity.generated.js";
import type { DB as IntegrationDatabase } from "./database.integration.generated.js";
import type { DB as EvidenceDatabase } from "./database.evidence.generated.js";
import type { DB as PandaDatabase } from "./database.panda.generated.js";
import type { DB as PlaceDatabase } from "./database.place.generated.js";
import type { DB as LifeHistoryDatabase } from "./database.life-history.generated.js";
import type { DB as LineageDatabase } from "./database.lineage.generated.js";
import type { DB as MediaDatabase } from "./database.media.generated.js";

export type Database = IdentityDatabase &
  IntegrationDatabase &
  EvidenceDatabase &
  PandaDatabase &
  PlaceDatabase &
  LifeHistoryDatabase &
  LineageDatabase &
  MediaDatabase;
