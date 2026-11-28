import { createStoredPref } from "@/lib/stored-pref";

// The 生日周 reminder is off until the fan turns it on. It is a viewing preference kept on this device: no
// account, no push, no server change. When on, 今天 says which followed pandas have a birthday this week.

const pref = createStoredPref<boolean>({
  key: "birthdayReminder",
  parse: (stored) => stored === "on",
  serialize: (on) => (on ? "on" : "off"),
});

export const setBirthdayReminder = pref.set;

/** Null until read, so the switch and the 今天 card do not flash. */
export const useBirthdayReminder = pref.useValue;
