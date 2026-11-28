import { Global, Module } from "@nestjs/common";
import { AsyncJobsModule } from "../jobs/async-jobs.module.js";
import { EvidenceModule } from "../modules/evidence/evidence.module.js";
import { LifeHistoryModule } from "../modules/life-history/life-history.module.js";
import { LineageModule } from "../modules/lineage/lineage.module.js";
import { MediaModule } from "../modules/media/media.module.js";
import { PandaModule } from "../modules/panda/panda.module.js";
import { PlacesModule } from "../modules/places/places.module.js";
import { PublicationModule } from "../modules/publication/publication.module.js";
import { RECENT_AUTH_CUTOFF, type RecentAuthCutoff } from "../platform/auth/recent-auth-cutoff.js";
import { AppConfig } from "../platform/config/app-config.js";
import { ConfigModule } from "../platform/config/config.module.js";
import { DatabaseModule } from "../platform/database/database.module.js";
import { E2eFixtureController } from "./e2e-fixture.controller.js";
import { E2E_FIXTURE_TOKEN, E2eFixtureGuard, assertE2eFixtureEnvironment } from "./e2e-fixture.guard.js";
import { E2eFixtureService } from "./e2e-fixture.service.js";
import { RecentAuthCutoffStore } from "./recent-auth-cutoff.store.js";

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EvidenceModule,
    PandaModule,
    LineageModule,
    PlacesModule,
    LifeHistoryModule,
    MediaModule,
    PublicationModule,
    AsyncJobsModule,
  ],
  controllers: [E2eFixtureController],
  providers: [
    RecentAuthCutoffStore,
    {
      provide: RECENT_AUTH_CUTOFF,
      useFactory: (store: RecentAuthCutoffStore): RecentAuthCutoff => (accountId) =>
        store.cutoffFor(accountId),
      inject: [RecentAuthCutoffStore],
    },
    {
      provide: E2E_FIXTURE_TOKEN,
      useFactory: (config: AppConfig) =>
        assertE2eFixtureEnvironment(config.environment, config.host, process.env.E2E_FIXTURE_TOKEN),
      inject: [AppConfig],
    },
    E2eFixtureGuard,
    E2eFixtureService,
  ],
  exports: [RECENT_AUTH_CUTOFF],
})
export class E2eFixtureModule {}
