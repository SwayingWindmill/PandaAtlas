import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationEventConsumer } from "../../platform/integration/integration-event-consumer.js";
import { AuditApplication } from "./application/audit.application.js";
import { AuditController } from "./http/audit.controller.js";
import { AuditEventConsumerService } from "./infrastructure/audit-event-consumer.service.js";
import { PostgresAuditRepository } from "./infrastructure/postgres-audit.repository.js";

@Module({
  imports: [DatabaseModule, IntegrationModule],
  controllers: [AuditController],
  providers: [
    {
      provide: AuditApplication,
      useFactory: (database: DatabaseService) => new AuditApplication(new PostgresAuditRepository(database)),
      inject: [DatabaseService],
    },
    {
      provide: AuditEventConsumerService,
      useFactory: (consumer: IntegrationEventConsumer) => new AuditEventConsumerService(consumer),
      inject: [IntegrationEventConsumer],
    },
  ],
  exports: [AuditEventConsumerService],
})
export class AuditModule {}
