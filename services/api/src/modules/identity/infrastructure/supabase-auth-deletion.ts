import { Injectable } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppConfig } from "../../../platform/config/app-config.js";
import { authUserAlreadyGone, type AuthUserDeletion } from "../application/auth-user-deletion.js";

@Injectable()
export class SupabaseAuthUserDeletion implements AuthUserDeletion {
  private readonly auth: SupabaseClient | undefined;

  public constructor(config: AppConfig) {
    if (config.supabaseUrl && config.supabaseSecretKey) {
      this.auth = createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    if (!this.auth) {
      throw new Error("Supabase Auth admin is not configured");
    }
    const { error } = await this.auth.auth.admin.deleteUser(userId);
    if (error && !authUserAlreadyGone(error)) {
      throw new Error(error.message);
    }
  }
}
