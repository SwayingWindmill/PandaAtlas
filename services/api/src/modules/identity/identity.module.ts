import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "../../platform/auth/auth.module.js";
import { SupabaseAuthGuard } from "../../platform/auth/supabase-auth.guard.js";
import { ConfigModule } from "../../platform/config/config.module.js";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import { IDENTITY_NOTIFICATION_CONTACT_PORT } from "./application/identity-notification.port.js";
import { IDENTITY_PRIVACY_PORT } from "./application/identity-privacy.port.js";
import { IDENTITY_PORT } from "./application/identity.port.js";
import { AUTH_USER_DELETION } from "./application/auth-user-deletion.js";
import { StaffInvitationsService } from "./infrastructure/staff-invitations.service.js";
import { SupabaseAuthUserDeletion } from "./infrastructure/supabase-auth-deletion.js";
import { StaffRolesService } from "./infrastructure/staff-roles.service.js";
import { StaffAccountLifecycleService } from "./infrastructure/staff-account-lifecycle.service.js";
import { ApplicationAccessGuard } from "./http/application-access.guard.js";
import { MeController } from "./http/me.controller.js";
import { AcceptStaffInvitationController, StaffInvitationsController } from "./http/staff-invitations.controller.js";
import { StaffRolesController } from "./http/staff-roles.controller.js";
import { PostgresIdentityRepository } from "./infrastructure/postgres-identity.repository.js";

@Module({
  imports: [AuthModule, ConfigModule, DatabaseModule, RequestContextModule],
  controllers: [MeController, StaffInvitationsController, AcceptStaffInvitationController, StaffRolesController],
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
    ApplicationAccessGuard,
    StaffInvitationsService,
    SupabaseAuthUserDeletion,
    { provide: AUTH_USER_DELETION, useExisting: SupabaseAuthUserDeletion },
    StaffRolesService,
    StaffAccountLifecycleService,
    {
      provide: APP_GUARD,
      useExisting: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: ApplicationAccessGuard,
    },
  ],
  exports: [IDENTITY_NOTIFICATION_CONTACT_PORT, IDENTITY_PRIVACY_PORT, AUTH_USER_DELETION],
})
export class IdentityModule {}
