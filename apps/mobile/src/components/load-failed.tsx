import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** The empty-state block a screen shows when its data could not load: one short line and 重试. */
export function LoadFailed({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <View className={cn("items-start gap-3 rounded-lg bg-muted p-5", className)}>
      <Text>{message}</Text>
      <Button onPress={onRetry}>
        <Text>重试</Text>
      </Button>
    </View>
  );
}
