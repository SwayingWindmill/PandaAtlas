import { View } from "react-native";

import { Text } from "@/components/ui/text";

export function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <Text variant="h2">{title}</Text>
      {meta ? <Text variant="small" className="text-highlight-foreground">{meta}</Text> : null}
    </View>
  );
}
