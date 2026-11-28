import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../../../platform/config/app-config.js";
import type { AppleTokenRevocationPort } from "../application/apple-token-revocation.port.js";
import { authUserAlreadyGone, type AuthUserDeletion } from "../application/auth-user-deletion.js";

export class SupabaseAuthUserDeletion implements AuthUserDeletion {
  private readonly auth: SupabaseClient | undefined;

  public constructor(
    config: AppConfig,
    private readonly appleRevocation: AppleTokenRevocationPort,
  ) {
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
    await this.appleRevocation.revokeIfPresent(userId);
    const { error } = await this.auth.auth.admin.deleteUser(userId);
    if (error && !authUserAlreadyGone(error)) {
      throw new Error(error.message);
    }
  }
}
