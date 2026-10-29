import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** A pill for a short label that opens another screen. */
export function Chip({ label, onPress, className }: { label: string; onPress: () => void; className?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        "min-h-11 items-center justify-center rounded-full border-hairline border-border bg-card px-4 py-2 active:bg-accent",
        className,
      )}
    >
      <Text className="font-bold">{label}</Text>
    </Pressable>
  );
}
