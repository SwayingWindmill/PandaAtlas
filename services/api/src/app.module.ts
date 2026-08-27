import { Module } from "@nestjs/common";
import { AsyncJobsModule } from "./jobs/async-jobs.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { ContributionModule } from "./modules/contribution/contribution.module.js";
import { CurationModule } from "./modules/curation/curation.module.js";
import { EvidenceModule } from "./modules/evidence/evidence.module.js";
import { EngagementModule } from "./modules/engagement/engagement.module.js";
import { GameModule } from "./modules/game/game.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { LifeHistoryModule } from "./modules/life-history/life-history.module.js";
import { LineageModule } from "./modules/lineage/lineage.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { ModerationModule } from "./modules/moderation/moderation.module.js";
import { NotificationModule } from "./modules/notification/notification.module.js";
import { PandaModule } from "./modules/panda/panda.module.js";
import { PlacesModule } from "./modules/places/places.module.js";
import { PublicationModule } from "./modules/publication/publication.module.js";
import { PrivacyModule } from "./modules/privacy/privacy.module.js";
import { ReviewModule } from "./modules/review/review.module.js";
import { UpdatesModule } from "./modules/updates/updates.module.js";
import { ConfigModule } from "./platform/config/config.module.js";
import { HealthModule } from "./platform/health/health.module.js";
import { HttpPlatformModule } from "./platform/http/http-platform.module.js";

@Module({
  imports: [
    ConfigModule,
    HttpPlatformModule,
    HealthModule,
    IdentityModule,
    ContributionModule,
    CurationModule,
    ReviewModule,
    ModerationModule,
    EngagementModule,
    GameModule,
    EvidenceModule,
    PandaModule,
    PlacesModule,
    LifeHistoryModule,
    LineageModule,
    MediaModule,
    PublicationModule,
    UpdatesModule,
    NotificationModule,
    PrivacyModule,
    AuditModule,
    AsyncJobsModule,
  ],
})
export class AppModule {}
