import { router } from "expo-router";
import { View } from "react-native";

import { useStacked } from "@/components/grouped-list";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { Text } from "@/components/ui/text";
import { RADIUS } from "@/lib/surface";

import { type CatalogArticle, articleHero, learningText, readingMinutes } from "./catalog";

export function openArticle(slug: string) {
  router.push({ pathname: "/learn/articles/[slug]", params: { slug } });
}

/** A story in a section: title and dek on the left, a square photo on the right, directly on the canvas. */
export function FeedArticle({ article, last }: { article: CatalogArticle; last: boolean }) {
  const stacked = useStacked();
  const title = learningText(article.title);
  const hero = articleHero(article);
  return (
    <View className={last ? undefined : "border-b-hairline border-border"}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => openArticle(article.slug)}
        className={stacked ? "gap-row py-row" : "flex-row items-start gap-row py-row"}
      >
        {stacked && hero?.asset ? (
          <View className="w-full overflow-hidden rounded-control" style={{ aspectRatio: 16 / 9, borderCurve: "continuous" }}>
            <RemoteImage
              source={hero.asset}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              accessible={false}
            />
            <PhotoOutline radius={RADIUS.control} />
          </View>
        ) : null}
        <View className={stacked ? "gap-hair-gap" : "min-w-0 flex-1 gap-hair-gap"}>
          <Text variant="headline" numberOfLines={stacked ? undefined : 3}>
            {title}
          </Text>
          <Text variant="subheadline" className="text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
            {learningText(article.dek)}
          </Text>
          <Text variant="footnote" className="pt-hair-gap text-muted-foreground">
            {`${readingMinutes(article)} 分钟`}
          </Text>
        </View>
        {!stacked && hero?.asset ? (
          <View className="size-24 overflow-hidden rounded-control" style={{ borderCurve: "continuous" }}>
            <RemoteImage
              source={hero.asset}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              accessible={false}
            />
            <PhotoOutline radius={RADIUS.control} />
          </View>
        ) : null}
      </PressScale>
    </View>
  );
}
