import { router } from "expo-router";
import type { ReactNode } from "react";
import { useNavigationState } from "expo-router/react-navigation";
import { Image } from "expo-image";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/components/page";
import { LoadFailed } from "@/components/load-failed";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { articleHero, catalogIsEmpty, type CatalogArticle, learningText, readingMinutes } from "@/features/learning/catalog";
import { PandaPhoto } from "@/features/learning/panda-photo";
import { useReadingTheme } from "@/features/learning/reading-theme";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";

const CATEGORY_ORDER = ["外形与识别", "食性", "繁殖与成长", "保护"];

function openArticle(slug: string) {
  router.push({ pathname: "/learn/articles/[slug]", params: { slug } });
}

export default function LearnScreen() {
  const theme = useReadingTheme();
  const insets = useSafeAreaInsets();
  const canGoBack = useNavigationState((state) => (state?.index ?? 0) > 0);
  const { state, reload } = useLearningCatalog();
  const { pandas } = useLearningPandas();

  if (state.status !== "ready") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.canvas, paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        {state.status === "loading" ? <Skeleton className="h-80 w-full" accessibilityLabel="正在加载" /> : null}
        {state.status === "failed" ? <LoadFailed message="科普暂时打不开。" onRetry={reload} /> : null}
      </View>
    );
  }

  const { catalog } = state;
  if (catalogIsEmpty(catalog) || catalog.articles.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.canvas, paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }}>
        {canGoBack ? <BackButton /> : null}
        <Text style={{ fontSize: 34, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
          认识大熊猫
        </Text>
        <Text style={{ fontSize: 17, color: theme.secondary }}>科普还在写。</Text>
      </View>
    );
  }

  const [featured, ...rest] = catalog.articles;
  if (featured === undefined) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.canvas }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, gap: 32 }}>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        {canGoBack ? <BackButton /> : null}
        <Text style={{ fontSize: 34, lineHeight: 40, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
          认识大熊猫
        </Text>
      </View>

      <FeaturedArticle article={featured} />

      {CATEGORY_ORDER.map((category) => {
        const articles = rest.filter((article) => article.category === category);
        if (articles.length === 0) return null;
        return (
          <View key={category} style={{ paddingHorizontal: 20, gap: 16 }}>
            <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
              {category}
            </Text>
            {articles.map((article) => (
              <FeedArticle key={article.slug} article={article} />
            ))}
          </View>
        );
      })}

      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: "700", color: theme.ink }} accessibilityRole="header">
          名词和认脸
        </Text>
        <View style={{ borderRadius: 12, backgroundColor: theme.card, overflow: "hidden" }}>
          {catalog.terms.map((term, index) => (
            <InsetRow
              key={term.slug}
              label={learningText(term.term)}
              first={index === 0}
              onPress={() => router.push({ pathname: "/learn/terms/[slug]", params: { slug: term.slug } })}
            />
          ))}
          {catalog.faceGuides.map((guide) => {
            const panda = pandas?.find((item) => item.slug === guide.pandaSlug);
            const title = learningText(guide.title);
            return (
              <InsetRow
                key={guide.slug}
                label={title}
                photo={<PandaPhoto pandaId={panda?.id ?? null} label={title} aspect="1/1" rounded={false} decorative />}
                onPress={() => router.push({ pathname: "/learn/faces/[slug]", params: { slug: guide.slug } })}
              />
            );
          })}
          {catalog.challenges.length > 0 ? (
            <InsetRow label="认脸挑战" detail={learningText(catalog.challenges[0]?.prompt)} onPress={() => router.push("/learn/challenge")} />
          ) : null}
        </View>
      </View>

      {catalog.version ? (
        <Text style={{ paddingHorizontal: 20, fontSize: 13, color: theme.secondary }}>{`资料版本 ${catalog.version}`}</Text>
      ) : null}
    </ScrollView>
  );
}

function FeaturedArticle({ article }: { article: CatalogArticle }) {
  const theme = useReadingTheme();
  const title = learningText(article.title);
  const hero = articleHero(article);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => openArticle(article.slug)}
      style={{ marginHorizontal: 20, borderRadius: 16, backgroundColor: theme.card, overflow: "hidden" }}
    >
      {hero?.asset ? <Image source={hero.asset} style={{ width: "100%", height: 280 }} contentFit="cover" accessible={false} /> : null}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, gap: 8 }}>
        <Text style={{ fontSize: 28, lineHeight: theme.dark ? 42 : 40, fontWeight: "700", color: theme.ink }}>{title}</Text>
        <Text style={{ fontSize: 17, lineHeight: theme.dark ? 30 : 28, color: theme.secondary }}>{learningText(article.dek)}</Text>
        <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: theme.secondary }}>
          {`${article.category}    ${readingMinutes(article)} 分钟`}
        </Text>
      </View>
    </Pressable>
  );
}

function FeedArticle({ article }: { article: CatalogArticle }) {
  const theme = useReadingTheme();
  const title = learningText(article.title);
  const hero = articleHero(article);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => openArticle(article.slug)}
      style={{ flexDirection: "row", gap: 16, borderRadius: 12, backgroundColor: theme.card, overflow: "hidden" }}
    >
      {hero?.asset ? <Image source={hero.asset} style={{ width: 120, height: 168 }} contentFit="cover" accessible={false} /> : null}
      <View style={{ flex: 1, justifyContent: "center", paddingTop: 16, paddingBottom: 16, paddingRight: 16, gap: 8 }}>
        <Text style={{ fontSize: 17, lineHeight: theme.dark ? 28 : 26, fontWeight: "600", color: theme.ink }} numberOfLines={2}>
          {title}
        </Text>
        <Text style={{ fontSize: 15, lineHeight: theme.dark ? 26 : 24, color: theme.secondary }} numberOfLines={2}>
          {learningText(article.dek)}
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: theme.secondary }}>{`${readingMinutes(article)} 分钟`}</Text>
      </View>
    </Pressable>
  );
}

function InsetRow({
  label,
  detail,
  photo,
  first,
  onPress,
}: {
  label: string;
  detail?: string;
  photo?: ReactNode;
  first?: boolean;
  onPress: () => void;
}) {
  const theme = useReadingTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: theme.separator,
      }}
    >
      {photo ? <View style={{ width: 44, height: 44, overflow: "hidden", borderRadius: 8 }}>{photo}</View> : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 17, lineHeight: 26, color: theme.ink }}>{label}</Text>
        {detail ? (
          <Text style={{ fontSize: 13, lineHeight: 20, color: theme.secondary }} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
