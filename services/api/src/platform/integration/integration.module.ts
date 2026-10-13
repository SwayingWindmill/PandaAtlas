import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { DatabaseService } from "../database/database.service.js";
import { AsyncDownstreamHeartbeat } from "./async-downstream-heartbeat.js";
import { IntegrationEventRouter } from "./integration-event-router.js";
import { IntegrationOutboxService } from "./integration-outbox.service.js";
import { OutboxDispatcherService } from "./outbox-dispatcher.service.js";
import { PgmqService } from "./pgmq.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: IntegrationOutboxService, useValue: new IntegrationOutboxService() },
    { provide: PgmqService, useValue: new PgmqService() },
    { provide: IntegrationEventRouter, useValue: new IntegrationEventRouter() },
    {
      provide: AsyncDownstreamHeartbeat,
      useFactory: (database: DatabaseService) => new AsyncDownstreamHeartbeat(database),
      inject: [DatabaseService],
    },
    {
      provide: OutboxDispatcherService,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        pgmq: PgmqService,
        router: IntegrationEventRouter,
      ) => new OutboxDispatcherService(database, outbox, pgmq, router),
      inject: [DatabaseService, IntegrationOutboxService, PgmqService, IntegrationEventRouter],
    },
  ],
  exports: [IntegrationOutboxService, PgmqService, OutboxDispatcherService, AsyncDownstreamHeartbeat],
})
export class IntegrationModule {}
