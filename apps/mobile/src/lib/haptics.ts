import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// One haptic per action, fired in the same frame as the visual change it confirms, and never the
// only feedback. Web has no Taptic Engine, so these do nothing there.
const enabled = Platform.OS === "ios" || Platform.OS === "android";

/** A light tap: a toggle that flips at once, like 关注. */
export function tapHaptic() {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** A saved record the fan asked for, like 见过 once the server has it. */
export function successHaptic() {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** A choice undone, like removing 见过. */
export function selectionHaptic() {
  if (enabled) void Haptics.selectionAsync().catch(() => undefined);
}
