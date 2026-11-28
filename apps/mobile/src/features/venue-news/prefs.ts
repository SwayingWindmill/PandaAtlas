import { createStoredPref } from "@/lib/stored-pref";

// 场馆动态 on 今天 is on until the fan turns it off in 设置. A viewing preference kept on this device: no
// account, no push, no server change.

const pref = createStoredPref<boolean>({
  key: "venueNewsOnToday",
  parse: (stored) => stored !== "off",
  serialize: (on) => (on ? "on" : "off"),
});

export const setVenueNewsOn = pref.set;

/** Null until read, so the switch and the 今天 card do not flash. */
export const useVenueNewsOn = pref.useValue;
