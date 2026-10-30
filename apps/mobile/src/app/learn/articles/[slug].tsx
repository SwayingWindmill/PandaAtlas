import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadFailed } from "@/components/load-failed";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CONTENT_ENTER } from "@/design/motion";
import {
  articleHero,
  entryBySlug,
  learningText,
  readingMinutes,
  type CatalogArticle,
  type LearningArticleImage,
  type LearningText,
} from "@/features/learning/catalog";
import { ReadingRule, ReadingSkeletonGround } from "@/features/learning/reading-page";
import { useReadingTheme } from "@/features/learning/reading-theme";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { RADIUS } from "@/lib/surface";

const TERM_MARK = /\[\[([a-z0-9]+(?:-[a-z0-9]+)*)\|([^\]]+)\]\]/g;

/** The lead photograph's height: a News-style plate, about half the first screen. */
const LEAD_HEIGHT = 420;

function slugParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** A caption and its credit, as News sets them under a photo: the credit after the sentence. */
function captionLine(image: LearningArticleImage): string {
  const caption = learningText(image.caption);
  return image.type === "existing" && image.credit ? `${caption}　${image.credit}` : caption;
}

export default function ArticleScreen() {
  const theme = useReadingTheme();
  const insets = useSafeAreaInsets();
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  const [compact, setCompact] = useState(false);

  if (state.status !== "ready") {
    return (
      <ReadingSkeletonGround>
        {state.status === "loading" ? (
          <View className="gap-row" accessibilityLabel="正在加载">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-6 w-full" />
          </View>
        ) : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </ReadingSkeletonGround>
    );
  }

  const article = entryBySlug(state.catalog.articles, slug);
  if (!article) {
    return (
      <ReadingSkeletonGround>
        <ScreenState message="没有这一篇。" actionLabel="回到科普" onAction={() => router.replace("/learn")} />
      </ReadingSkeletonGround>
    );
  }

  const title = learningText(article.title);
  const hero = articleHero(article);
  const numbers = new Map(article.references.map((reference, index) => [reference.id, index + 1]));
  const related = article.relatedArticles.flatMap((relatedSlug) => {
    const item = entryBySlug(state.catalog.articles, relatedSlug);
    return item ? [item] : [];
  });
  // A figure whose photo is not in yet shows as a 配图待补 slot for the writers in development only:
  // readers see the published figures, not a grey box.
  const figures = groupFigures(
    article.images.filter((image) => image.role !== "hero" && (__DEV__ || (image.type === "existing" && image.asset))),
  );

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen
        options={{
          title: compact ? title : "",
          headerLargeTitleEnabled: false,
          headerTransparent: Platform.OS === "ios" && !compact,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: compact || Platform.OS !== "ios" ? theme.paper : "transparent" },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > 300;
          if (next !== compact) setCompact(next);
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        <Animated.View entering={CONTENT_ENTER}>
          {hero?.asset ? (
            <View className="gap-stack-tight">
              <Image
                source={hero.asset}
                style={{ width: "100%", height: LEAD_HEIGHT }}
                contentFit="cover"
                accessibilityLabel={learningText(hero.caption)}
              />
              <Text variant="readingCaption" className="px-stack">
                {captionLine(hero)}
              </Text>
            </View>
          ) : null}

          <View
            className="gap-row px-stack pt-section"
            style={hero?.asset ? undefined : { paddingTop: insets.top + 64 }}
          >
            <Text variant="footnote" className="font-semibold text-primary">
              {`${article.category}　·　${readingMinutes(article)} 分钟`}
            </Text>
            <Text variant="readingTitle">{title}</Text>
            <Text variant="readingLead">{learningText(article.dek)}</Text>
          </View>

          <PullQuote text={learningText(article.pullQuote)} />

          <View className="gap-section px-stack">
            {article.body.sections.map((section) => (
              <View key={learningText(section.heading)} className="gap-row">
                <Text variant="readingHeading">{learningText(section.heading)}</Text>
                {section.paragraphs.map((paragraph) => (
                  <RichParagraph
                    key={learningText(paragraph.text)}
                    text={paragraph.text}
                    refs={paragraph.refs}
                    numbers={numbers}
                  />
                ))}
              </View>
            ))}
          </View>

          {figures.length > 0 ? (
            <View className="gap-section pt-section">
              {figures.map((group) => (
                <FigureGroup key={group.map((image) => learningText(image.caption)).join()} images={group} />
              ))}
            </View>
          ) : null}

          {article.keyFacts.length > 0 ? (
            <View
              className="mx-stack mt-page gap-row rounded-tile bg-secondary p-stack"
              style={{ borderCurve: "continuous" }}
            >
              <Text variant="headline" role="heading">
                要点
              </Text>
              {article.keyFacts.map((fact, index) => (
                <View key={learningText(fact.text)} className="gap-row">
                  {index > 0 ? <ReadingRule /> : null}
                  <RichParagraph text={fact.text} refs={fact.refs} numbers={numbers} />
                </View>
              ))}
            </View>
          ) : null}

          {article.references.length > 0 ? (
            <View className="gap-stack-tight px-stack pt-page">
              <Text variant="readingHeading">参考文献</Text>
              <View>
                {article.references.map((reference, index) => (
                  <View key={reference.id}>
                    <ReadingRule />
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={reference.title}
                      disabled={!reference.url}
                      onPress={() => {
                        if (reference.url) void WebBrowser.openBrowserAsync(reference.url);
                      }}
                      className="min-h-11 flex-row gap-row py-row active:opacity-60"
                    >
                      <Text variant="readingCaption" className="w-5 tabular-nums">
                        {index + 1}
                      </Text>
                      <View className="min-w-0 flex-1 gap-hair-gap">
                        <Text variant="subheadline" className="font-semibold">
                          {reference.title}
                        </Text>
                        {reference.publisher ? <Text variant="readingCaption">{reference.publisher}</Text> : null}
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {related.length > 0 ? (
            <View className="gap-row px-stack pt-page">
              <Text variant="readingHeading">相关文章</Text>
              {related.map((item) => (
                <RelatedArticle key={item.slug} article={item} />
              ))}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** The pull quote, set apart from the column by a jade rule, as News sets one in an article. */
function PullQuote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View className="mx-stack my-section flex-row gap-inset">
      <View className="w-1 rounded-pill bg-primary" />
      <Text variant="readingHeading" role="none" className="flex-1 font-semibold">
        {text}
      </Text>
    </View>
  );
}

function groupFigures(images: LearningArticleImage[]): LearningArticleImage[][] {
  const groups: LearningArticleImage[][] = [];
  for (const image of images) {
    const previous = groups.at(-1);
    if (image.role === "compare" && previous?.every((item) => item.role === "compare") && previous.length < 2)
      previous.push(image);
    else groups.push([image]);
  }
  return groups;
}

function FigureGroup({ images }: { images: LearningArticleImage[] }) {
  const pair = images.length > 1;
  return (
    <View className="gap-stack-tight">
      <View className={pair ? "flex-row gap-stack-tight px-stack" : undefined}>
        {images.map((image) => (
          <View key={learningText(image.caption)} className="flex-1">
            {image.type === "existing" && image.asset ? (
              <View className={pair ? "overflow-hidden rounded-tile" : undefined} style={{ borderCurve: "continuous" }}>
                <Image
                  source={image.asset}
                  style={{ width: "100%", height: pair ? 180 : 240 }}
                  contentFit="cover"
                  accessibilityLabel={learningText(image.caption)}
                />
                {pair ? <PhotoOutline radius={RADIUS.tile} /> : null}
              </View>
            ) : (
              <View
                className={
                  pair
                    ? "h-40 items-center justify-center rounded-tile bg-secondary"
                    : "mx-stack h-40 items-center justify-center rounded-tile bg-secondary"
                }
              >
                <Text variant="readingCaption">配图待补</Text>
              </View>
            )}
          </View>
        ))}
      </View>
      {images.map((image) => (
        <Text key={`${learningText(image.caption)}-credit`} variant="readingCaption" className="px-stack">
          {captionLine(image)}
        </Text>
      ))}
    </View>
  );
}

function RichParagraph({ text, refs, numbers }: { text: LearningText; refs: string[]; numbers: Map<string, number> }) {
  const source = learningText(text);
  const pieces: { key: string; term?: string; value: string }[] = [];
  let cursor = 0;
  for (const match of source.matchAll(TERM_MARK)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push({ key: `t${cursor}`, value: source.slice(cursor, index) });
    pieces.push({ key: `m${index}`, term: match[1], value: match[2] ?? "" });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) pieces.push({ key: `t${cursor}`, value: source.slice(cursor) });
  const marks = refs.flatMap((id) => {
    const number = numbers.get(id);
    return number === undefined ? [] : [number];
  });
  return (
    <Text variant="readingBody">
      {pieces.map((piece) =>
        piece.term ? (
          <Text
            key={piece.key}
            variant="readingBody"
            className="font-semibold text-primary"
            onPress={() => router.push({ pathname: "/learn/terms/[slug]", params: { slug: piece.term ?? "" } })}
            accessibilityRole="link"
          >
            {piece.value}
          </Text>
        ) : (
          <Text key={piece.key} variant="readingBody">
            {piece.value}
          </Text>
        ),
      )}
      {marks.length > 0 ? (
        <Text variant="readingCaption" className="tabular-nums">{` [${marks.join(", ")}]`}</Text>
      ) : null}
    </Text>
  );
}

function RelatedArticle({ article }: { article: CatalogArticle }) {
  const title = learningText(article.title);
  const hero = articleHero(article);
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push({ pathname: "/learn/articles/[slug]", params: { slug: article.slug } })}
      className="flex-row items-center gap-inset rounded-tile bg-secondary p-row"
      style={{ borderCurve: "continuous" }}
    >
      <View className="min-w-0 flex-1 gap-hair-gap">
        <Text variant="footnote" className="font-semibold text-primary">
          {article.category}
        </Text>
        <Text variant="headline" numberOfLines={3}>
          {title}
        </Text>
        <Text variant="footnote" className="text-muted-foreground">{`${readingMinutes(article)} 分钟`}</Text>
      </View>
      {hero?.asset ? (
        <View className="size-20 overflow-hidden rounded-control" style={{ borderCurve: "continuous" }}>
          <Image source={hero.asset} style={{ width: "100%", height: "100%" }} contentFit="cover" accessible={false} />
          <PhotoOutline radius={RADIUS.control} />
        </View>
      ) : null}
    </PressScale>
  );
}
