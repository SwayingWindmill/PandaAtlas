import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { authedApi } from "@/lib/api";
import { reportError } from "@/lib/error-reporting";
import { supabase } from "@/lib/supabase";

import { isAppleCancelError } from "./apple-provider";

export type { AuthProvider, AuthUserLike } from "./apple-provider";
export { resolveAuthProvider } from "./apple-provider";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (error) {
    reportError(error, "global");
    return false;
  }
}

export async function authenticateWithApple(): Promise<
  { status: "cancelled" } | { status: "authenticated"; authorizationCode: string | null }
> {
  const rawNonce = toHex(await Crypto.getRandomBytesAsync(32));
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (isAppleCancelError(error)) return { status: "cancelled" };
    throw error;
  }
  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token");
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  return { status: "authenticated", authorizationCode: credential.authorizationCode ?? null };
}

export async function storeAppleRevocationToken(authorizationCode: string | null): Promise<void> {
  if (!authorizationCode) return;
  try {
    const { response } = await authedApi.POST("/api/v2/me/apple-token", { body: { authorizationCode } });
    if (!response.ok) {
      reportError(new Error(`Apple revocation token sync failed (HTTP ${response.status})`), "mutation");
    }
  } catch (error) {
    reportError(error, "mutation");
  }
}
