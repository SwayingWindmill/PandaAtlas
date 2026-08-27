import type { DB as IdentityDatabase } from "./database.identity.generated.js";
import type { DB as IntegrationDatabase } from "./database.integration.generated.js";
import type { DB as EvidenceDatabase } from "./database.evidence.generated.js";
import type { DB as PandaDatabase } from "./database.panda.generated.js";
import type { DB as PlaceDatabase } from "./database.place.generated.js";
import type { DB as LifeHistoryDatabase } from "./database.life-history.generated.js";
import type { DB as LineageDatabase } from "./database.lineage.generated.js";
import type { DB as MediaDatabase } from "./database.media.generated.js";
import type { DB as EngagementDatabase } from "./database.engagement.generated.js";
import type { DB as GameDatabase } from "./database.game.generated.js";
import type { DB as ContributionDatabase } from "./database.contribution.generated.js";
import type { DB as ReviewModerationDatabase } from "./database.review-moderation.generated.js";
import type { DB as CurationDatabase } from "./database.curation.generated.js";
import type { DB as PublicationDatabase } from "./database.publication.generated.js";
import type { DB as PublicReadDatabase } from "./database.public-read.generated.js";
import type { DB as UpdatesDatabase } from "./database.updates.generated.js";
import type { DB as NotificationDatabase } from "./database.notification.generated.js";
import type { DB as PrivacyDatabase } from "./database.privacy.generated.js";
import type { DB as AuditDatabase } from "./database.audit.generated.js";

export type Database = IdentityDatabase &
  IntegrationDatabase &
  EvidenceDatabase &
  PandaDatabase &
  PlaceDatabase &
  LifeHistoryDatabase &
  LineageDatabase &
  MediaDatabase &
  EngagementDatabase &
  GameDatabase &
  ContributionDatabase &
  ReviewModerationDatabase &
  CurationDatabase &
  PublicationDatabase &
  PublicReadDatabase &
  UpdatesDatabase &
  NotificationDatabase &
  PrivacyDatabase &
  AuditDatabase;
