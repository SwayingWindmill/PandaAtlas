import { Image } from "expo-image";
import { View } from "react-native";
import { useUniwind } from "uniwind";

import { cardShadow } from "@/components/card";
import { Text } from "@/components/ui/text";

/** A photo header. The title and one short line sit on the picture. */
export function Hero({
  imageUrl,
  label,
  title,
  subtitle,
}: {
  imageUrl: string | null;
  label?: string;
  title: string;
  subtitle?: string;
}) {
  const { theme } = useUniwind();
  return (
    <View className="overflow-hidden rounded-xl bg-muted" style={cardShadow(theme)}>
      {imageUrl ? (
        <View className="h-72 w-full">
          <Image source={imageUrl} style={{ width: "100%", height: "100%" }} contentFit="cover" accessibilityLabel={title} />
          <View className="absolute inset-x-0 bottom-0 gap-1 bg-foreground/80 px-5 py-4">
            {label ? <Text variant="small" className="text-highlight">{label}</Text> : null}
            <Text variant="h2" className="text-background">
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-background" numberOfLines={3}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View className="gap-2 bg-highlight-soft px-5 py-6">
          {label ? <Text variant="small" className="text-highlight-foreground">{label}</Text> : null}
          <Text variant="h2">{title}</Text>
          {subtitle ? <Text numberOfLines={3}>{subtitle}</Text> : null}
        </View>
      )}
    </View>
  );
}
