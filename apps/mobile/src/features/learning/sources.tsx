import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type LearningSource, learningText } from "./catalog";

/** Citations under a learning page. A draft source has no link until a writer adds one. */
export function LearningSources({ sources }: { sources: readonly LearningSource[] }) {
  if (sources.length === 0) return null;
  return (
    <View className="gap-1">
      <Text variant="h2">来源</Text>
      <View>
        {sources.map((source, index) => {
          const title = learningText(source.title);
          const last = index === sources.length - 1;
          const row = cn("border-t-hairline border-border py-3", last && "border-b-hairline");
          if (!source.url) {
            return (
              <View key={`${title}-${index}`} className={row}>
                <Text className="text-muted-foreground">{title}</Text>
              </View>
            );
          }
          const url = source.url;
          return (
            <Pressable
              key={url}
              onPress={() => void WebBrowser.openBrowserAsync(url)}
              role="link"
              accessibilityLabel={title}
              className={cn(row, "active:bg-accent")}
            >
              <Text className="font-bold">{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
