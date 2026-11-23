import AsyncStorage from "@react-native-async-storage/async-storage";

// The pandas picked on the welcome, kept on the device until they are followed: signing in leaves the welcome
// for a while, and the app can be closed meanwhile to read the code.

const PICKS_KEY = "welcome.picks";

export interface WelcomePicks {
  pandaIds: string[];
  /** The fan asked to follow them and went to sign in; following goes on once the session is there. */
  followAfterSignIn: boolean;
}

export async function readPicks(): Promise<WelcomePicks | null> {
  const stored = await AsyncStorage.getItem(PICKS_KEY).catch(() => null);
  if (!stored) return null;
  try {
    const picks = JSON.parse(stored) as Partial<WelcomePicks>;
    if (!Array.isArray(picks.pandaIds)) return null;
    return {
      pandaIds: picks.pandaIds.filter((id): id is string => typeof id === "string"),
      followAfterSignIn: picks.followAfterSignIn === true,
    };
  } catch {
    return null;
  }
}

export async function savePicks(picks: WelcomePicks): Promise<void> {
  await AsyncStorage.setItem(PICKS_KEY, JSON.stringify(picks)).catch(() => undefined);
}

export async function clearPicks(): Promise<void> {
  await AsyncStorage.removeItem(PICKS_KEY).catch(() => undefined);
}

/** The picked pandas still in the index, in the order they were picked. */
export function pickedPandas<P extends { id: string }>(pandas: readonly P[], pandaIds: readonly string[]): P[] {
  const byId = new Map(pandas.map((panda) => [panda.id, panda]));
  return pandaIds.flatMap((id) => byId.get(id) ?? []);
}
