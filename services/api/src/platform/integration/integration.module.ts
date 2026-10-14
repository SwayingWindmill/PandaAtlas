import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { DatabaseService } from "../database/database.service.js";
import { ObservabilityModule } from "../observability/observability.module.js";
import { StructuredLoggerService } from "../observability/structured-logger.service.js";
import { AsyncDownstreamHeartbeat } from "./async-downstream-heartbeat.js";
import { IntegrationDeadLetters } from "./integration-dead-letters.js";
import { IntegrationEventConsumer } from "./integration-event-consumer.js";
import { IntegrationEventRouter } from "./integration-event-router.js";
import { IntegrationOutboxService } from "./integration-outbox.service.js";
import { OutboxDispatcherService } from "./outbox-dispatcher.service.js";
import { PgmqService } from "./pgmq.service.js";

@Module({
  imports: [DatabaseModule, ObservabilityModule],
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
      provide: IntegrationDeadLetters,
      useFactory: (database: DatabaseService) => new IntegrationDeadLetters(database),
      inject: [DatabaseService],
    },
    {
      provide: IntegrationEventConsumer,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        pgmq: PgmqService,
        logger: StructuredLoggerService,
      ) => new IntegrationEventConsumer(database, outbox, pgmq, logger),
      inject: [DatabaseService, IntegrationOutboxService, PgmqService, StructuredLoggerService],
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
  exports: [
    IntegrationOutboxService,
    PgmqService,
    IntegrationEventConsumer,
    OutboxDispatcherService,
    AsyncDownstreamHeartbeat,
    IntegrationDeadLetters,
  ],
})
export class IntegrationModule {}
