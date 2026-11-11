import { Image } from "expo-image";
import { router } from "expo-router";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Text } from "@/components/ui/text";
import { HAIRLINE, RADIUS } from "@/lib/surface";

import { type CatalogArticle, articleHero, learningText, readingMinutes } from "./catalog";

export function openArticle(slug: string) {
  router.push({ pathname: "/learn/articles/[slug]", params: { slug } });
}

/** A story in a section: title and dek on the left, a square photo on the right, as News lists them. */
export function FeedArticle({ article, last }: { article: CatalogArticle; last: boolean }) {
  const title = learningText(article.title);
  const hero = articleHero(article);
  return (
    <View>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => openArticle(article.slug)}
        className="flex-row items-start gap-row bg-card p-inset"
      >
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline" numberOfLines={3}>
            {title}
          </Text>
          <Text variant="subheadline" className="text-muted-foreground" numberOfLines={2}>
            {learningText(article.dek)}
          </Text>
          <Text
            variant="footnote"
            className="pt-hair-gap text-muted-foreground"
          >{`${readingMinutes(article)} 分钟`}</Text>
        </View>
        {hero?.asset ? (
          <View className="size-24 overflow-hidden rounded-control" style={{ borderCurve: "continuous" }}>
            <Image
              source={hero.asset}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              accessible={false}
            />
            <PhotoOutline radius={RADIUS.control} />
          </View>
        ) : null}
      </PressScale>
      {last ? null : <View className="ml-inset bg-border" style={{ height: HAIRLINE }} />}
    </View>
  );
}
