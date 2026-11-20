import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AsyncJobsModule } from "./jobs/async-jobs.module.js";
import { AskModule } from "./modules/ask/ask.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { ContributionModule } from "./modules/contribution/contribution.module.js";
import { DailyCheckinModule } from "./modules/daily-checkin/daily-checkin.module.js";
import { EngagementModule } from "./modules/engagement/engagement.module.js";
import { GameModule } from "./modules/game/game.module.js";
import { ApplicationAccessGuard } from "./modules/identity/http/application-access.guard.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { NotificationModule } from "./modules/notification/notification.module.js";
import { PopularityModule } from "./modules/popularity/popularity.module.js";
import { PrivacyModule } from "./modules/privacy/privacy.module.js";
import { PublicReadModule } from "./modules/public-read/public-read.module.js";
import { PublicationModule } from "./modules/publication/publication.module.js";
import { ReviewModule } from "./modules/review/review.module.js";
import { UpdatesModule } from "./modules/updates/updates.module.js";
import { AuthModule } from "./platform/auth/auth.module.js";
import { SupabaseAuthGuard } from "./platform/auth/supabase-auth.guard.js";
import { ConfigModule } from "./platform/config/config.module.js";
import { HealthModule } from "./platform/health/health.module.js";
import { HttpPlatformModule } from "./platform/http/http-platform.module.js";

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    HttpPlatformModule,
    HealthModule,
    IdentityModule,
    ContributionModule,
    ReviewModule,
    EngagementModule,
    DailyCheckinModule,
    GameModule,
    PublicReadModule,
    PublicationModule,
    CatalogModule,
    PopularityModule,
    AskModule,
    UpdatesModule,
    NotificationModule,
    PrivacyModule,
    AuditModule,
    AsyncJobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useExisting: SupabaseAuthGuard },
    { provide: APP_GUARD, useExisting: ApplicationAccessGuard },
  ],
})
export class AppModule {}
