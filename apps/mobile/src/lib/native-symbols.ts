import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

/**
 * Whether the bar glyphs can come from the app's own symbols. A development or release build runs
 * prebuild, where react-native-nano-icons turns the Lucide SVGs in `assets/symbols/` into custom SF
 * Symbols (iOS asset catalog) and VectorDrawables (Android). Expo Go has neither, so it keeps the
 * template PNGs; so does the web, which has no native bars. Expo Go on Android reports its execution
 * environment as "bare", so the check asks for the Expo Go module itself.
 */
export const NATIVE_SYMBOLS = Platform.OS !== "web" && !isRunningInExpoGo();

/** `assets/symbols/<name>.svg` as an iOS symbol (`nano.<name>`) and an Android drawable (`nano_<name>`). */
export function nanoSymbol(
  name: "today" | "search" | "atlas" | "me" | "share" | "back",
) {
  return { xcasset: `nano.${name}`, drawable: `nano_${name}` };
}
