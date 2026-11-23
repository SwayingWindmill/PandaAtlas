import AsyncStorage from "@react-native-async-storage/async-storage";

import { type OfflineEntry, keepRecent, offlineEntry } from "@/lib/offline-keys";

// Network first: a public read always goes to the API, and a successful answer is saved on the device. Only when
// the request fails (no connection) does the saved copy answer, so an app started offline still shows what it
// last loaded. Photos are kept by expo-image's own disk cache.

const PREFIX = "offline:";
const PAGES = `${PREFIX}pages`;

async function save(entry: OfflineEntry, body: string): Promise<void> {
  await AsyncStorage.setItem(entry.key, body);
  if (!entry.page) return;
  const stored = await AsyncStorage.getItem(PAGES);
  const { pages, drop } = keepRecent(stored ? (JSON.parse(stored) as string[]) : [], entry.key);
  await AsyncStorage.setItem(PAGES, JSON.stringify(pages));
  if (drop.length > 0) await AsyncStorage.removeMany(drop);
}

/** openapi-fetch middleware for the public API client. */
export const offlineCache = {
  async onResponse({ request, response }: { request: Request; response: Response }) {
    if (request.method !== "GET" || !response.ok) return undefined;
    const entry = offlineEntry(request.url);
    if (entry) {
      const body = await response.clone().text();
      void save(entry, body).catch(() => undefined);
    }
    return undefined;
  },
  async onError({ request }: { request: Request }) {
    if (request.method !== "GET") return undefined;
    const entry = offlineEntry(request.url);
    const stored = entry ? await AsyncStorage.getItem(entry.key).catch(() => null) : null;
    if (stored === null) return undefined;
    return new Response(stored, { status: 200, headers: { "content-type": "application/json" } });
  },
};

/** Deletes every saved public read; the fan's own settings, under other keys, stay. Returns how many went. */
export async function clearOfflineCache(): Promise<number> {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
  if (keys.length > 0) await AsyncStorage.removeMany(keys);
  return keys.length;
}
