import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Check } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { primitive } from "@/design/tokens";

const SHOWN_MS = 2000;
const { black, white } = primitive.palette.gray;

/**
 * A short confirmation that stays about two seconds: a black pill with a check, near the bottom of
 * the screen. Render `toast` as a sibling of the screen's scroll view and call `show` after the action.
 */
export function useToast(): { toast: ReactNode; show: (message: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const insets = useSafeAreaInsets();

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((next: string) => {
    clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), SHOWN_MS);
  }, []);

  const toast = (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 items-center px-gutter"
      style={{ bottom: insets.bottom + 24 }}
      role="status"
      accessibilityLiveRegion="polite"
    >
      {message ? (
        <View className="flex-row items-center gap-2 rounded-pill px-4 py-2.5" style={{ backgroundColor: black }}>
          <Icon icon={Check} size="body" color={white} strokeWidth={2.2} />
          <Text className="font-semibold" style={{ color: white }}>
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
  return { toast, show };
}
