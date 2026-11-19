import { Module } from "@nestjs/common";
import { AppConfig } from "../../platform/config/app-config.js";
import { ConfigModule } from "../../platform/config/config.module.js";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { ObservabilityModule } from "../../platform/observability/observability.module.js";
import { StructuredLoggerService } from "../../platform/observability/structured-logger.service.js";
import { publishedCatalog } from "../catalog/application/learning-catalog.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { PostgresJsonCatalogStore } from "../catalog/infrastructure/postgres-json-catalog.store.js";
import { PUBLIC_READ_PORT, type PublicReadPort } from "../publication/application/public-read.application.js";
import { PublicationModule } from "../publication/publication.module.js";
import { AskIndexSync } from "./application/ask-index-sync.js";
import { ASK_PORT, AskApplication } from "./application/ask.application.js";
import { AskController } from "./http/ask.controller.js";
import { AskRuntimeService } from "./infrastructure/cloudflare-ask-runtime.js";
import { AskIndexSyncService } from "./infrastructure/ask-index-sync.service.js";
import { PostgresAskCorpus } from "./infrastructure/postgres-ask-corpus.js";
import { PostgresAskIndexRepository } from "./infrastructure/postgres-ask-index.repository.js";
import { PostgresAskQuotaRepository } from "./infrastructure/postgres-ask-quota.repository.js";

@Module({
  imports: [ConfigModule, DatabaseModule, ObservabilityModule, CatalogModule, PublicationModule],
  controllers: [AskController],
  providers: [
    AskRuntimeService,
    {
      provide: ASK_PORT,
      useFactory: (config: AppConfig, database: DatabaseService, runtime: AskRuntimeService, logger: StructuredLoggerService) =>
        new AskApplication(
          { enabled: config.askEnabled, globalDailyCap: config.askGlobalDailyCap },
          new PostgresAskQuotaRepository(database),
          new PostgresAskIndexRepository(database),
          () => runtime.current(),
          () => new Date(),
          // Metadata only: never the question or the answer.
          (trace) => logger.write("info", "Ask Panda question handled", { ask: trace }),
        ),
      inject: [AppConfig, DatabaseService, AskRuntimeService, StructuredLoggerService],
    },
    {
      provide: AskIndexSyncService,
      useFactory: (
        database: DatabaseService,
        catalogs: PostgresJsonCatalogStore,
        publicRead: PublicReadPort,
        runtime: AskRuntimeService,
        logger: StructuredLoggerService,
      ) =>
        new AskIndexSyncService(
          new AskIndexSync(
            new PostgresAskCorpus(
              database,
              { published: async () => publishedCatalog(await catalogs.current("learning.catalog")) },
              publicRead,
            ),
            new PostgresAskIndexRepository(database),
          ),
          runtime,
          logger,
        ),
      inject: [DatabaseService, PostgresJsonCatalogStore, PUBLIC_READ_PORT, AskRuntimeService, StructuredLoggerService],
    },
  ],
  exports: [AskRuntimeService, AskIndexSyncService],
})
export class AskModule {}
