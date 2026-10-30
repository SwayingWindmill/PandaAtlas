import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListCell, ListSection } from "@/components/grouped-list";
import { ScanFace } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { ScreenState } from "@/components/screen-state";
import { SectionHeader } from "@/components/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CONTENT_ENTER } from "@/design/motion";
import {
  articleHero,
  catalogIsEmpty,
  type CatalogArticle,
  learningText,
  readingMinutes,
} from "@/features/learning/catalog";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { HAIRLINE, RADIUS } from "@/lib/surface";

const CATEGORY_ORDER = ["外形与识别", "食性", "繁殖与成长", "保护"];
const TITLE = "认识大熊猫";

function openArticle(slug: string) {
  router.push({ pathname: "/learn/articles/[slug]", params: { slug } });
}

/** The large title kept in the column, as 科普 does on every platform. */
function Masthead({ count }: { count?: number }) {
  return (
    <View className="gap-hair-gap px-inset">
      <Text variant="display">{TITLE}</Text>
      {count ? <Text variant="subheadline" className="text-muted-foreground">{`${count} 篇科普`}</Text> : null}
    </View>
  );
}

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const { state, reload } = useLearningCatalog();
  const { pandas } = useLearningPandas();
  const bar = <Stack.Screen options={{ title: "", headerLargeTitleEnabled: false }} />;

  if (state.status !== "ready") {
    return (
      <View className="flex-1 gap-section bg-background pt-stack-tight">
        {bar}
        <Masthead />
        {state.status === "loading" ? (
          <View className="gap-row px-inset" accessibilityLabel="正在加载">
            <Skeleton className="h-72 w-full rounded-card" />
            <Skeleton className="h-28 w-full rounded-group" />
          </View>
        ) : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </View>
    );
  }

  const { catalog } = state;
  if (catalogIsEmpty(catalog) || catalog.articles.length === 0) {
    return (
      <View className="flex-1 gap-section bg-background pt-stack-tight">
        {bar}
        <Masthead />
        <ScreenState message="科普还在写。" />
      </View>
    );
  }

  const [featured, ...rest] = catalog.articles;
  if (featured === undefined) return null;
  const faceGuides = catalog.faceGuides.map((guide) => ({
    guide,
    panda: pandas?.find((item) => item.slug === guide.pandaSlug) ?? null,
  }));

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
    >
      {bar}
      <Animated.View entering={CONTENT_ENTER} className="gap-section pt-stack-tight">
        <Masthead count={catalog.articles.length} />

        <View className="px-inset">
          <FeaturedArticle article={featured} />
        </View>

        {CATEGORY_ORDER.map((category) => {
          const articles = rest.filter((article) => article.category === category);
          if (articles.length === 0) return null;
          return (
            <View key={category} className="gap-row px-inset">
              <SectionHeader title={category} count={`${articles.length} 篇`} />
              <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
                {articles.map((article, index) => (
                  <FeedArticle key={article.slug} article={article} last={index === articles.length - 1} />
                ))}
              </View>
            </View>
          );
        })}

        {faceGuides.length > 0 || catalog.challenges.length > 0 ? (
          <View className="gap-row">
            <View className="px-inset">
              <SectionHeader title="认脸" count={faceGuides.length > 0 ? `${faceGuides.length} 只` : undefined} />
            </View>
            {faceGuides.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-row px-inset"
              >
                {faceGuides.map(({ guide, panda }) => {
                  const title = learningText(guide.title);
                  return (
                    <PressScale
                      key={guide.slug}
                      accessibilityRole="button"
                      accessibilityLabel={`认脸指南：${title}`}
                      onPress={() => router.push({ pathname: "/learn/faces/[slug]", params: { slug: guide.slug } })}
                      className="w-36 gap-stack-tight"
                    >
                      <View className="overflow-hidden rounded-tile" style={{ borderCurve: "continuous" }}>
                        <PandaPhoto pandaId={panda?.id ?? null} label={title} aspect="4/5" rounded={false} decorative />
                        <PhotoOutline radius={RADIUS.tile} />
                      </View>
                      <View className="gap-hair-gap px-hair-gap">
                        <Text variant="headline" numberOfLines={2}>
                          {title}
                        </Text>
                        <Text variant="footnote" className="text-muted-foreground">
                          认脸指南
                        </Text>
                      </View>
                    </PressScale>
                  );
                })}
              </ScrollView>
            ) : null}
            {catalog.challenges.length > 0 ? (
              <View className="px-inset pt-stack-tight">
                <ListSection>
                  <ListCell
                    icon={ScanFace}
                    label="认脸挑战"
                    detail={learningText(catalog.challenges[0]?.prompt) || undefined}
                    href="/learn/challenge"
                    last
                  />
                </ListSection>
              </View>
            ) : null}
          </View>
        ) : null}

        {catalog.terms.length > 0 ? (
          <View className="px-inset">
            <ListSection title="名词">
              {catalog.terms.map((term, index) => (
                <ListCell
                  key={term.slug}
                  label={learningText(term.term)}
                  detail={learningText(term.definition)}
                  lines={1}
                  href={{ pathname: "/learn/terms/[slug]", params: { slug: term.slug } }}
                  last={index === catalog.terms.length - 1}
                />
              ))}
            </ListSection>
          </View>
        ) : null}

        {catalog.version ? (
          <Text variant="footnote" className="px-inset text-muted-foreground">{`资料版本 ${catalog.version}`}</Text>
        ) : null}
      </Animated.View>
    </ScrollView>
  );
}

/** The lead story, as News leads its feed: a photo plate, then the kicker, title and dek on the card. */
function FeaturedArticle({ article }: { article: CatalogArticle }) {
  const title = learningText(article.title);
  const hero = articleHero(article);
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => openArticle(article.slug)}
      className="overflow-hidden rounded-card bg-card"
      style={{ borderCurve: "continuous" }}
    >
      {hero?.asset ? (
        <Image
          source={hero.asset}
          style={{ width: "100%", aspectRatio: 4 / 3 }}
          contentFit="cover"
          accessible={false}
        />
      ) : null}
      <View className="gap-stack-tight p-stack">
        <Text variant="footnote" className="font-semibold text-primary">
          {article.category}
        </Text>
        <Text variant="title" role="none">
          {title}
        </Text>
        <Text variant="subheadline" className="text-muted-foreground" numberOfLines={3}>
          {learningText(article.dek)}
        </Text>
        <Text variant="footnote" className="text-muted-foreground">{`${readingMinutes(article)} 分钟`}</Text>
      </View>
      <PhotoOutline radius={RADIUS.card} />
    </PressScale>
  );
}

/** A story in a section: title and dek on the left, a square photo on the right, as News lists them. */
function FeedArticle({ article, last }: { article: CatalogArticle; last: boolean }) {
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
