import * as WebBrowser from "expo-web-browser";
import { ExternalLink } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Card } from "@/components/card";
import { Text } from "@/components/ui/text";

import { type LearningSource, learningText } from "./catalog";

/** Citations under a learning page, one tappable row per source. */
export function LearningSources({ sources }: { sources: readonly LearningSource[] }) {
  const ink = useCSSVariable("--color-muted-foreground");
  const cited = sources.filter((source) => learningText(source.title));
  if (cited.length === 0) return null;
  return (
    <View className="gap-3">
      <Text variant="h2">来源</Text>
      <Card>
        {cited.map((source, index) => {
          const title = learningText(source.title);
          const row = index > 0 ? "border-t-hairline border-border" : "";
          if (!source.url) {
            return (
              <View key={`${title}-${index}`} className={`px-4 py-3 ${row}`}>
                <Text className="text-muted-foreground">{title}</Text>
              </View>
            );
          }
          const url = source.url;
          return (
            <Pressable
              key={url}
              onPress={() => void WebBrowser.openBrowserAsync(url)}
              accessibilityRole="link"
              accessibilityLabel={title}
              className={`min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-accent ${row}`}
            >
              <ExternalLink size={16} color={String(ink)} strokeWidth={2} />
              <Text className="min-w-0 flex-1 font-bold">{title}</Text>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}
