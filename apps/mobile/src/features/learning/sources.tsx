import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";

import { type LearningSource, learningText } from "./catalog";
import { ReadingRule } from "./reading-page";

/** Citations under a learning page, numbered between hairlines as an article lists its references. */
export function LearningSources({ sources }: { sources: readonly LearningSource[] }) {
  const cited = sources.filter((source) => learningText(source.title));
  if (cited.length === 0) return null;
  return (
    <View className="gap-stack-tight">
      <Text variant="readingHeading">来源</Text>
      <View>
        {cited.map((source, index) => {
          const title = learningText(source.title);
          const row = "min-h-11 flex-row gap-row py-row";
          const number = (
            <Text variant="readingCaption" className="w-5 tabular-nums">
              {index + 1}
            </Text>
          );
          return (
            <View key={`${title}-${index}`}>
              <ReadingRule />
              {!source.url ? (
                <View className={row}>
                  {number}
                  <Text variant="subheadline" className="flex-1 text-muted-foreground">
                    {title}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => void WebBrowser.openBrowserAsync(source.url ?? "")}
                  accessibilityRole="link"
                  accessibilityLabel={title}
                  className={`${row} active:opacity-60`}
                >
                  {number}
                  <Text variant="subheadline" className="flex-1 font-semibold">
                    {title}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
