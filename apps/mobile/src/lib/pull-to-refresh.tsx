import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl } from "react-native";

import { useIOSColors } from "@/lib/theme";

/**
 * Pull to refresh for a scrolling page: refetches every query the screen is showing, so a page needs
 * no refresh function of its own. The spinner stays until the last of them has answered.
 */
export function usePullToRefresh() {
  const queryClient = useQueryClient();
  const colors = useIOSColors();
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      tintColor={colors.secondaryLabel}
      colors={[colors.tint]}
      progressBackgroundColor={colors.card}
    />
  );
}
