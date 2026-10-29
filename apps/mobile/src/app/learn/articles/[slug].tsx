import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { BackButton } from "@/components/page";
import { LoadFailed } from "@/components/load-failed";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  articleHero,
  entryBySlug,
  learningText,
  readingMinutes,
  type CatalogArticle,
  type LearningArticleImage,
  type LearningText,
} from "@/features/learning/catalog";
import { useReadingTheme } from "@/features/learning/reading-theme";
import { useLearningCatalog } from "@/features/learning/use-catalog";

const TERM_MARK = /\[\[([a-z0-9]+(?:-[a-z0-9]+)*)\|([^\]]+)\]\]/g;

function slugParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function ArticleScreen() {
  const theme = useReadingTheme();
  const insets = useSafeAreaInsets();
  const slug = slugParam(useLocalSearchParams<{ slug: string }>().slug);
  const { state, reload } = useLearningCatalog();
  const [compact, setCompact] = useState(false);

  if (state.status !== "ready") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        {state.status === "loading" ? <Skeleton className="mt-16 h-80 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </View>
    );
  }

  const article = entryBySlug(state.catalog.articles, slug);
  if (!article) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }}>
        <BackButton />
        <Text style={{ fontSize: 28, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
          没有这一篇
        </Text>
      </View>
    );
  }

  const title = learningText(article.title);
  const hero = articleHero(article);
  const numbers = new Map(article.references.map((reference, index) => [reference.id, index + 1]));
  const related = article.relatedArticles.flatMap((relatedSlug) => {
    const item = entryBySlug(state.catalog.articles, relatedSlug);
    return item ? [item] : [];
  });
  const figures = groupFigures(article.images.filter((image) => image.role !== "hero"));

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper }}>
      <ScrollView
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > 300;
          if (next !== compact) setCompact(next);
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {hero?.asset ? (
          <Image source={hero.asset} style={{ width: "100%", height: 420 }} contentFit="cover" accessibilityLabel={learningText(hero.caption)} />
        ) : null}
        {hero ? (
          <Text style={{ paddingHorizontal: 20, paddingTop: 8, fontSize: 13, lineHeight: 18, color: theme.secondary }}>
            {`${learningText(hero.caption)}  ${hero.credit ?? ""}`}
          </Text>
        ) : null}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 10 }}>
          <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
            {title}
          </Text>
          <Text style={{ fontSize: 17, lineHeight: 26, color: theme.secondary }}>{learningText(article.dek)}</Text>
          <Text style={{ fontSize: 13, lineHeight: 18, color: theme.secondary }}>{`${article.category}    ${readingMinutes(article)} 分钟`}</Text>
        </View>
        <Text style={{ paddingHorizontal: 20, paddingTop: 28, fontSize: 22, lineHeight: 32, fontWeight: "600", color: theme.ink }}>
          {learningText(article.pullQuote)}
        </Text>
        <View style={{ paddingHorizontal: 20, paddingTop: 28, gap: 22 }}>
          {article.body.sections.map((section) => (
            <View key={learningText(section.heading)} style={{ gap: 14 }}>
              <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
                {learningText(section.heading)}
              </Text>
              {section.paragraphs.map((paragraph) => (
                <RichParagraph key={learningText(paragraph.text)} text={paragraph.text} refs={paragraph.refs} numbers={numbers} />
              ))}
            </View>
          ))}
        </View>
        {figures.length > 0 ? (
          <View style={{ paddingTop: 28, gap: 20 }}>
            {figures.map((group) => (
              <FigureGroup key={group.map((image) => learningText(image.caption)).join()} images={group} />
            ))}
          </View>
        ) : null}
        <View style={{ marginHorizontal: 20, marginTop: 32, backgroundColor: theme.fill, borderRadius: 12, padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: theme.ink }}>要点</Text>
          {article.keyFacts.map((fact, index) => (
            <View key={learningText(fact.text)} style={{ borderTopWidth: index === 0 ? 0 : 0.5, borderTopColor: theme.separator, paddingTop: index === 0 ? 0 : 10 }}>
              <RichParagraph text={fact.text} refs={fact.refs} numbers={numbers} />
            </View>
          ))}
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 36, gap: 8 }}>
          <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
            参考文献
          </Text>
          {article.references.map((reference, index) => (
            <Pressable
              key={reference.id}
              accessibilityRole="link"
              accessibilityLabel={reference.title}
              onPress={() => {
                if (reference.url) void WebBrowser.openBrowserAsync(reference.url);
              }}
              style={{ paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: theme.separator }}
            >
              <Text style={{ fontSize: 17, lineHeight: 24, fontWeight: "600", color: theme.ink }}>{`${index + 1}. ${reference.title}`}</Text>
              <Text style={{ fontSize: 13, lineHeight: 18, color: theme.secondary }}>{reference.publisher}</Text>
            </Pressable>
          ))}
        </View>
        {related.length > 0 ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 36, gap: 12 }}>
            <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
              相关文章
            </Text>
            {related.map((item) => (
              <RelatedArticle key={item.slug} article={item} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top,
          paddingHorizontal: 12,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: compact ? theme.paper : "transparent",
          borderBottomWidth: compact ? 0.5 : 0,
          borderBottomColor: theme.separator,
        }}
      >
        <BackButton />
        {compact ? (
          <Text style={{ flex: 1, fontSize: 17, fontWeight: "600", color: theme.ink }} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function groupFigures(images: LearningArticleImage[]): LearningArticleImage[][] {
  const groups: LearningArticleImage[][] = [];
  for (const image of images) {
    const previous = groups.at(-1);
    if (image.role === "compare" && previous?.every((item) => item.role === "compare") && previous.length < 2) previous.push(image);
    else groups.push([image]);
  }
  return groups;
}

function FigureGroup({ images }: { images: LearningArticleImage[] }) {
  const theme = useReadingTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: images.length > 1 ? 8 : 0, paddingHorizontal: images.length > 1 ? 20 : 0 }}>
        {images.map((image) => (
          <View key={learningText(image.caption)} style={{ flex: 1 }}>
            {image.type === "existing" && image.asset ? (
              <Image source={image.asset} style={{ width: "100%", height: images.length > 1 ? 180 : 240 }} contentFit="cover" accessibilityLabel={learningText(image.caption)} />
            ) : (
              <View style={{ height: 160, alignItems: "center", justifyContent: "center", backgroundColor: theme.fill, marginHorizontal: images.length > 1 ? 0 : 20 }}>
                <Text style={{ fontSize: 15, color: theme.secondary }}>配图待补</Text>
              </View>
            )}
          </View>
        ))}
      </View>
      {images.map((image) => (
        <Text key={`${learningText(image.caption)}-credit`} style={{ paddingHorizontal: 20, fontSize: 13, lineHeight: 18, color: theme.secondary }}>
          {image.type === "existing" ? `${learningText(image.caption)}  ${image.credit ?? ""}` : learningText(image.caption)}
        </Text>
      ))}
    </View>
  );
}

function RichParagraph({ text, refs, numbers }: { text: LearningText; refs: string[]; numbers: Map<string, number> }) {
  const theme = useReadingTheme();
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
    <Text style={{ fontSize: 17, lineHeight: 28, color: theme.ink }}>
      {pieces.map((piece) =>
        piece.term ? (
          <Text
            key={piece.key}
            style={{ fontSize: 17, lineHeight: 28, fontWeight: "600", color: theme.ink, textDecorationLine: "underline" }}
            onPress={() => router.push({ pathname: "/learn/terms/[slug]", params: { slug: piece.term ?? "" } })}
            accessibilityRole="link"
          >
            {piece.value}
          </Text>
        ) : (
          <Text key={piece.key} style={{ fontSize: 17, lineHeight: 28, color: theme.ink }}>
            {piece.value}
          </Text>
        ),
      )}
      {marks.length > 0 ? <Text style={{ fontSize: 13, lineHeight: 28, color: theme.secondary }}>{` ${marks.join(" ")}`}</Text> : null}
    </Text>
  );
}

function RelatedArticle({ article }: { article: CatalogArticle }) {
  const theme = useReadingTheme();
  const title = learningText(article.title);
  const hero = articleHero(article);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push({ pathname: "/learn/articles/[slug]", params: { slug: article.slug } })}
      style={{ flexDirection: "row", gap: 12, borderRadius: 12, backgroundColor: theme.fill, overflow: "hidden" }}
    >
      {hero?.asset ? <Image source={hero.asset} style={{ width: 88, height: 88 }} contentFit="cover" accessible={false} /> : null}
      <View style={{ flex: 1, justifyContent: "center", paddingRight: 12, gap: 4 }}>
        <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: "600", color: theme.ink }} numberOfLines={2}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: theme.secondary }}>{`${readingMinutes(article)} 分钟`}</Text>
      </View>
    </Pressable>
  );
}
