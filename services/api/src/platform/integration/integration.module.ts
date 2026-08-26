import { Module } from "@nestjs/common";
import { IntegrationOutboxService } from "./integration-outbox.service.js";
import { PgmqService } from "./pgmq.service.js";

@Module({
  providers: [
    { provide: IntegrationOutboxService, useValue: new IntegrationOutboxService() },
    { provide: PgmqService, useValue: new PgmqService() },
  ],
  exports: [IntegrationOutboxService, PgmqService],
})
export class IntegrationModule {}
