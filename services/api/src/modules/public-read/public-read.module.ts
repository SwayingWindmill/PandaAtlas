import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { PgmqService } from "../../platform/integration/pgmq.service.js";
import { PUBLIC_READ_PORT } from "./application/public-read.application.js";
import { PublicReadController } from "./http/public-read.controller.js";
import { CachingPublicReadRepository } from "./infrastructure/caching-public-read.repository.js";
import { PostgresPublicReadRepository } from "./infrastructure/postgres-public-read.repository.js";
import { PublicCacheConsumerService } from "./infrastructure/public-cache-consumer.service.js";
import { PublicReadCache } from "./infrastructure/public-read-cache.js";

@Module({
  imports: [DatabaseModule, IntegrationModule],
  controllers: [PublicReadController],
  providers: [
    {
      provide: PublicReadCache,
      useFactory: () => new PublicReadCache(),
    },
    {
      provide: PUBLIC_READ_PORT,
      useFactory: (database: DatabaseService, cache: PublicReadCache) =>
        new CachingPublicReadRepository(new PostgresPublicReadRepository(database, cache), cache),
      inject: [DatabaseService, PublicReadCache],
    },
    {
      provide: PublicCacheConsumerService,
      useFactory: (database: DatabaseService, pgmq: PgmqService, cache: PublicReadCache) =>
        new PublicCacheConsumerService(database, pgmq, cache),
      inject: [DatabaseService, PgmqService, PublicReadCache],
    },
  ],
  exports: [PUBLIC_READ_PORT, PublicReadCache, PublicCacheConsumerService],
})
export class PublicReadModule {}
