import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Android's back key undoes what is open on the focused screen (a sheet, a selection, an inline menu) before it
 * leaves the screen, as the system back gesture does in a native app. Elsewhere back has no such key.
 */
export function useBackToClose(open: boolean, close: () => void) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || !open) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        close();
        return true;
      });
      return () => subscription.remove();
    }, [open, close]),
  );
}
