import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * The quiet block a screen shows when there is nothing to show, or the load failed.
 * One sentence, and a button only when the fan can do something about it.
 */
export function ScreenState({
  message,
  actionLabel,
  onAction,
  className,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <View className={cn("items-center gap-3 px-6 py-8", className)}>
      <Text variant="body" className="text-center text-muted-foreground">
        {message}
      </Text>
      {onAction && actionLabel ? (
        <Button variant="secondary" onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
