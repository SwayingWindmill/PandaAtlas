import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "../../platform/auth/auth.module.js";
import { SupabaseAuthGuard } from "../../platform/auth/supabase-auth.guard.js";
import { ConfigModule } from "../../platform/config/config.module.js";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import { IDENTITY_MODERATION_PARTICIPANT } from "./application/identity-moderation.port.js";
import { IDENTITY_NOTIFICATION_CONTACT_PORT } from "./application/identity-notification.port.js";
import { IDENTITY_PRIVACY_PORT } from "./application/identity-privacy.port.js";
import { IDENTITY_PORT } from "./application/identity.port.js";
import { ApplicationAccessGuard } from "./http/application-access.guard.js";
import { MeController } from "./http/me.controller.js";
import { PostgresIdentityRepository } from "./infrastructure/postgres-identity.repository.js";

@Module({
  imports: [AuthModule, ConfigModule, DatabaseModule, RequestContextModule],
  controllers: [MeController],
  providers: [
    {
      provide: PostgresIdentityRepository,
      useFactory: (database: DatabaseService) => new PostgresIdentityRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: IDENTITY_PORT,
      useExisting: PostgresIdentityRepository,
    },
    {
      provide: IDENTITY_MODERATION_PARTICIPANT,
      useExisting: PostgresIdentityRepository,
    },
    {
      provide: IDENTITY_NOTIFICATION_CONTACT_PORT,
      useExisting: PostgresIdentityRepository,
    },
    {
      provide: IDENTITY_PRIVACY_PORT,
      useExisting: PostgresIdentityRepository,
    },
    ApplicationAccessGuard,
    {
      provide: APP_GUARD,
      useExisting: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: ApplicationAccessGuard,
    },
  ],
  exports: [IDENTITY_MODERATION_PARTICIPANT, IDENTITY_NOTIFICATION_CONTACT_PORT, IDENTITY_PRIVACY_PORT],
})
export class IdentityModule {}
