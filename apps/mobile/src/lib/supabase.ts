import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

// Supabase Auth for the app; data goes through the V2 API, never the Data API (it is off in production).
// The URL and publishable key are public. Set EXPO_PUBLIC_SUPABASE_* to point a build at a local stack.
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://gsnpkwlezpdkdupizjdb.supabase.co").replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_-JoUNsIVaSHreJXJ0hrd2g_6Skn9Dmm";

// The session (with its refresh token) lives in the keychain/keystore. Android's SecureStore holds
// values of about 2 KB, and a session is larger, so values are split into numbered chunks.
const CHUNK = 1_800;

const keychain: SupportedStorage = {
  async getItem(key) {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)));
    return parts.some((part) => part === null) ? null : parts.join("");
  },
  async setItem(key, value) {
    const previous = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
    const parts = Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, index) => value.slice(index * CHUNK, (index + 1) * CHUNK));
    for (const [index, part] of parts.entries()) await SecureStore.setItemAsync(`${key}.${index}`, part);
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
    for (let index = parts.length; index < previous; index += 1) await SecureStore.deleteItemAsync(`${key}.${index}`);
  },
  async removeItem(key) {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
    for (let index = 0; index < count; index += 1) await SecureStore.deleteItemAsync(`${key}.${index}`);
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // The web build (used for previews and browser tests) has no keychain; the browser's storage stands in.
    ...(Platform.OS === "web" ? {} : { storage: keychain }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground, as Supabase recommends for React Native.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
