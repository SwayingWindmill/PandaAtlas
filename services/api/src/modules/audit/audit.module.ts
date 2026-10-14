import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationEventConsumer } from "../../platform/integration/integration-event-consumer.js";
import {
  AUDIT_PORT,
  AUDIT_REPOSITORY,
  AuditApplication,
  type AuditRepository,
} from "./application/audit.application.js";
import { AuditController } from "./http/audit.controller.js";
import { AuditEventConsumerService } from "./infrastructure/audit-event-consumer.service.js";
import { PostgresAuditRepository } from "./infrastructure/postgres-audit.repository.js";

@Module({
  imports: [DatabaseModule, IntegrationModule],
  controllers: [AuditController],
  providers: [
    {
      provide: AUDIT_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresAuditRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: AUDIT_PORT,
      useFactory: (repository: AuditRepository) => new AuditApplication(repository),
      inject: [AUDIT_REPOSITORY],
    },
    {
      provide: AuditEventConsumerService,
      useFactory: (consumer: IntegrationEventConsumer) => new AuditEventConsumerService(consumer),
      inject: [IntegrationEventConsumer],
    },
  ],
  exports: [AUDIT_PORT, AuditEventConsumerService],
})
export class AuditModule {}
