import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationEventConsumer } from "../../platform/integration/integration-event-consumer.js";
import { IntegrationOutboxService } from "../../platform/integration/integration-outbox.service.js";
import {
  PUBLICATION_CHANGE_PORT,
  type PublicationChangePort,
} from "../publication/application/publication-change.port.js";
import { PublicationModule } from "../publication/publication.module.js";
import { UpdatesApplication } from "./application/updates.application.js";
import { UpdatesController } from "./http/updates.controller.js";
import { PostgresUpdatesRepository } from "./infrastructure/postgres-updates.repository.js";
import { UpdatesEventConsumerService } from "./infrastructure/updates-event-consumer.service.js";

@Module({
  imports: [DatabaseModule, IntegrationModule, PublicationModule],
  controllers: [UpdatesController],
  providers: [
    {
      provide: UpdatesApplication,
      useFactory: (database: DatabaseService) => new UpdatesApplication(new PostgresUpdatesRepository(database)),
      inject: [DatabaseService],
    },
    {
      provide: UpdatesEventConsumerService,
      useFactory: (
        consumer: IntegrationEventConsumer,
        outbox: IntegrationOutboxService,
        publicationChanges: PublicationChangePort,
      ) => new UpdatesEventConsumerService(consumer, outbox, publicationChanges),
      inject: [IntegrationEventConsumer, IntegrationOutboxService, PUBLICATION_CHANGE_PORT],
    },
  ],
  exports: [UpdatesEventConsumerService],
})
export class UpdatesModule {}
