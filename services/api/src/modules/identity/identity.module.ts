import { Module } from "@nestjs/common";
import { AppConfig } from "../../platform/config/app-config.js";
import { ConfigModule } from "../../platform/config/config.module.js";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import { APPLE_TOKEN_REVOCATION_PORT, type AppleTokenRevocationPort } from "./application/apple-token-revocation.port.js";
import { AUTH_USER_DELETION } from "./application/auth-user-deletion.js";
import { IDENTITY_NOTIFICATION_CONTACT_PORT } from "./application/identity-notification.port.js";
import { IDENTITY_PRIVACY_PORT } from "./application/identity-privacy.port.js";
import { IDENTITY_PORT } from "./application/identity.port.js";
import { ApplicationAccessGuard } from "./http/application-access.guard.js";
import { MeController } from "./http/me.controller.js";
import {
  AppleTokenRevocationService,
  PostgresAppleRevocationTokenStore,
} from "./infrastructure/apple-token-revocation.service.js";
import { PostgresIdentityRepository } from "./infrastructure/postgres-identity.repository.js";
import { SupabaseAuthUserDeletion } from "./infrastructure/supabase-auth-deletion.js";

@Module({
  imports: [ConfigModule, DatabaseModule, RequestContextModule],
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
      provide: IDENTITY_NOTIFICATION_CONTACT_PORT,
      useExisting: PostgresIdentityRepository,
    },
    {
      provide: IDENTITY_PRIVACY_PORT,
      useExisting: PostgresIdentityRepository,
    },
    {
      provide: AppleTokenRevocationService,
      useFactory: (config: AppConfig, database: DatabaseService) =>
        new AppleTokenRevocationService(config, new PostgresAppleRevocationTokenStore(database)),
      inject: [AppConfig, DatabaseService],
    },
    {
      provide: APPLE_TOKEN_REVOCATION_PORT,
      useExisting: AppleTokenRevocationService,
    },
    ApplicationAccessGuard,
    {
      provide: SupabaseAuthUserDeletion,
      useFactory: (config: AppConfig, appleRevocation: AppleTokenRevocationPort) =>
        new SupabaseAuthUserDeletion(config, appleRevocation),
      inject: [AppConfig, APPLE_TOKEN_REVOCATION_PORT],
    },
    { provide: AUTH_USER_DELETION, useExisting: SupabaseAuthUserDeletion },
  ],
  exports: [
    ApplicationAccessGuard,
    IDENTITY_NOTIFICATION_CONTACT_PORT,
    IDENTITY_PRIVACY_PORT,
    AUTH_USER_DELETION,
  ],
})
export class IdentityModule {}
