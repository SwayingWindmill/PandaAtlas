import { Module } from "@nestjs/common";
import { AppConfig } from "../../platform/config/app-config.js";
import { ConfigModule } from "../../platform/config/config.module.js";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationOutboxService } from "../../platform/integration/integration-outbox.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import { PUBLIC_READ_PORT, type PublicReadPort } from "../public-read/application/public-read.application.js";
import { PublicReadModule } from "../public-read/public-read.module.js";
import { NEWS_PORT, NewsApplication } from "./application/news.application.js";
import { NewsController } from "./http/news.controller.js";
import { PostgresNewsRepository } from "./infrastructure/postgres-news.repository.js";

@Module({
  imports: [ConfigModule, DatabaseModule, IntegrationModule, RequestContextModule, PublicReadModule],
  controllers: [NewsController],
  providers: [
    {
      provide: NEWS_PORT,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        publicRead: PublicReadPort,
        config: AppConfig,
      ) =>
        new NewsApplication(
          new PostgresNewsRepository(database, outbox),
          publicRead,
          new Set(config.newsAutoPublishTiers),
        ),
      inject: [DatabaseService, IntegrationOutboxService, PUBLIC_READ_PORT, AppConfig],
    },
  ],
  exports: [NEWS_PORT],
})
export class NewsModule {}
