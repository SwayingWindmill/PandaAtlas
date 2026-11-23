import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/** Refetches when the screen regains focus. A fetch already in flight is joined, not cancelled and restarted. */
export function useRefetchOnFocus(refetch: (options: { cancelRefetch: boolean }) => unknown, enabled = true): void {
  const mountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      if (enabled) void refetch({ cancelRefetch: false });
    }, [enabled, refetch]),
  );
}
