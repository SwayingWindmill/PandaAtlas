import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

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
