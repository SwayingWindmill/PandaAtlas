import { type Href, router } from "expo-router";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** A divided list row that opens another screen, with an optional short status on the right. */
export function NavRow({ label, meta, href, last }: { label: string; meta?: string; href: Href; last?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      role="button"
      accessibilityLabel={meta ? `${label}，${meta}` : label}
      className={cn(
        "flex-row items-center justify-between gap-3 border-t-hairline border-border py-3.5 active:bg-accent",
        last && "border-b-hairline",
      )}
    >
      <Text className="font-bold">{label}</Text>
      <View className="flex-row items-center gap-2">
        {meta ? <Text className="text-highlight-foreground">{meta}</Text> : null}
        <Text className="text-muted-foreground">›</Text>
      </View>
    </Pressable>
  );
}
