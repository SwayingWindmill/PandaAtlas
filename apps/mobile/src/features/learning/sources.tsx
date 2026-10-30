import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { HAIRLINE } from "@/lib/surface";

import { type LearningSource, learningText } from "./catalog";

/** Citations under a learning page, one hairline row per source. */
export function LearningSources({ sources }: { sources: readonly LearningSource[] }) {
  const cited = sources.filter((source) => learningText(source.title));
  if (cited.length === 0) return null;
  return (
    <View className="gap-2">
      <Text variant="title2" className="px-4">来源</Text>
      <View className="overflow-hidden rounded-[10px] bg-card">
        {cited.map((source, index) => {
          const title = learningText(source.title);
          const last = index === cited.length - 1;
          const row = "min-h-11 justify-center px-4 py-3";
          const body = !source.url ? (
            <View className={row}>
              <Text className="text-muted-foreground">{title}</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => void WebBrowser.openBrowserAsync(source.url ?? "")}
              accessibilityRole="link"
              accessibilityLabel={title}
              className={`${row} active:bg-accent`}
            >
              <Text className="font-semibold">{title}</Text>
            </Pressable>
          );
          return (
            <View key={`${title}-${index}`}>
              {body}
              {last ? null : <View className="ml-4 bg-border" style={{ height: HAIRLINE }} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}
