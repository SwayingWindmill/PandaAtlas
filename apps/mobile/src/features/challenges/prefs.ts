import { createStoredPref } from "@/lib/stored-pref";

import { type ChallengeState, parseChallengeState } from "./challenge";

// Kept on this device only, like 里程碑's switch: no account, no server.
const pref = createStoredPref<ChallengeState>({
  key: "monthly-challenge",
  parse: parseChallengeState,
  serialize: (next) => JSON.stringify(next),
});

export const saveChallengeState = pref.set;

/** Null until read, so nothing flashes. */
export const useChallengeState = pref.useValue;
