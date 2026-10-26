import { supabase } from "@/lib/supabase";

// Two-step verification with Supabase Auth TOTP. Sensitive account actions (data export, account deletion)
// need an AAL2 session that verified recently; a fan sets up an authenticator app once and enters its code
// before such an action. Supabase upgrades the stored session, so later API calls carry the AAL2 token.

export interface Assurance {
  level: "aal1" | "aal2";
  /** The fan's verified authenticator, when one is set up. */
  factorId: string | null;
}

export interface Enrollment {
  factorId: string;
  /** SVG data URL of the QR code. */
  qrCode: string;
  secret: string;
  /** otpauth:// link an authenticator app on the same phone can open. */
  uri: string;
}

export async function loadAssurance(): Promise<Assurance> {
  const [assurance, factors] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assurance.error) throw assurance.error;
  if (factors.error) throw factors.error;
  return {
    level: assurance.data.currentLevel === "aal2" ? "aal2" : "aal1",
    factorId: factors.data.totp[0]?.id ?? null,
  };
}

/** Starts a new authenticator, first removing any set-up the fan abandoned before verifying it. */
export async function enrollAuthenticator(): Promise<Enrollment> {
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  for (const factor of factors.data.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "知熊猫 App" });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
}

/** Verifies a code from the authenticator; false when the code is wrong or expired. */
export async function verifyAuthenticator(factorId: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (!error) return true;
  if (error.code === "mfa_verification_failed" || error.code === "mfa_challenge_expired") return false;
  throw error;
}
