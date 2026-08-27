import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationOutboxService } from "../../platform/integration/integration-outbox.service.js";
import { PgmqService } from "../../platform/integration/pgmq.service.js";
import {
  PUBLICATION_CHANGE_PORT,
  type PublicationChangePort,
} from "../publication/application/publication-change.port.js";
import { PublicationModule } from "../publication/publication.module.js";
import {
  UPDATES_PORT,
  UPDATES_REPOSITORY,
  UpdatesApplication,
  type UpdatesRepository,
} from "./application/updates.application.js";
import { UpdatesController } from "./http/updates.controller.js";
import { PostgresUpdatesRepository } from "./infrastructure/postgres-updates.repository.js";
import { UpdatesEventConsumerService } from "./infrastructure/updates-event-consumer.service.js";

@Module({
  imports: [DatabaseModule, IntegrationModule, PublicationModule],
  controllers: [UpdatesController],
  providers: [
    {
      provide: UPDATES_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresUpdatesRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: UPDATES_PORT,
      useFactory: (repository: UpdatesRepository) => new UpdatesApplication(repository),
      inject: [UPDATES_REPOSITORY],
    },
    {
      provide: UpdatesEventConsumerService,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        pgmq: PgmqService,
        publicationChanges: PublicationChangePort,
      ) => new UpdatesEventConsumerService(database, outbox, pgmq, publicationChanges),
      inject: [DatabaseService, IntegrationOutboxService, PgmqService, PUBLICATION_CHANGE_PORT],
    },
  ],
  exports: [UPDATES_PORT, UpdatesEventConsumerService],
})
export class UpdatesModule {}
