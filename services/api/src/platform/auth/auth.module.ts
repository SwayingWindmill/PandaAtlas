import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module.js";
import { RequestContextModule } from "../request-context/request-context.module.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";
import { SupabaseJwtVerifier } from "./supabase-jwt.verifier.js";

@Module({
  imports: [ConfigModule, RequestContextModule],
  providers: [SupabaseJwtVerifier, SupabaseAuthGuard],
  exports: [SupabaseJwtVerifier, SupabaseAuthGuard],
})
export class AuthModule {}
