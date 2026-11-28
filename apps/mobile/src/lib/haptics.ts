import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// One haptic per action, fired in the same frame as the visual change it confirms, and never the
// only feedback. Web has no Taptic Engine, so these do nothing there. Android uses the system's own
// haptic constants, which each phone maker tunes to its motor; the iOS-style calls are emulated
// with a vibration there and feel different from phone to phone.
const ios = Platform.OS === "ios";
const android = Platform.OS === "android";

function play(onIOS: () => Promise<void>, onAndroid: Haptics.AndroidHaptics) {
  if (ios) void onIOS().catch(() => undefined);
  else if (android) void Haptics.performAndroidHapticsAsync(onAndroid).catch(() => undefined);
}

/** A light tap: a toggle that flips at once, like 关注. */
export function tapHaptic() {
  play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), Haptics.AndroidHaptics.Virtual_Key);
}

/** A saved record the fan asked for, like 见过 once the server has it. */
export function successHaptic() {
  play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), Haptics.AndroidHaptics.Confirm);
}

/** A choice undone, like removing 见过. */
export function selectionHaptic() {
  play(() => Haptics.selectionAsync(), Haptics.AndroidHaptics.Segment_Tick);
}
