import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chevron, ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { MessageCircleQuestion } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { NO_WEB_BAR_TITLE } from "@/components/page";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { ScreenState } from "@/components/screen-state";
import { Scrim } from "@/components/scrim";
import { SectionHeader } from "@/components/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { askStatusQueryOptions } from "@/features/ask/ask";
import {
  type CatalogArticle,
  type CatalogFaceGuide,
  type LearningPanda,
  articleHero,
  learningText,
  readingMinutes,
  visibleTips,
} from "@/features/learning/catalog";
import { FeedArticle, openArticle } from "@/features/learning/feed-article";
import { useLearningCatalog, useLearningPandas } from "@/features/learning/use-catalog";
import { useAccount } from "@/features/session/account";
import { usePandaCover } from "@/lib/covers";
import { PAGE_COLUMN, RADIUS } from "@/lib/surface";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";

const CATEGORY_ORDER = ["外形与识别", "食性", "繁殖与成长", "保护"];
const TITLE = "认识大熊猫";

/**
 * 问问熊猫 shows only to a signed-in fan while the API has it switched on: signed out, the app cannot know
 * whether it is open, and an entry that leads to "closed" is worse than none.
 */
function AskEntry() {
  const { accountId } = useAccount();
  const status = useQuery({ ...askStatusQueryOptions(accountId ?? ""), enabled: accountId !== null });
  useRefetchOnFocus(status.refetch, accountId !== null);
  const enabled = accountId !== null && status.data?.enabled === true;
  if (!enabled) return null;
  return (
    <View className="px-gutter">
      <Pressable
        role="link"
        accessibilityLabel="问问熊猫，基于已核实科普回答"
        onPress={() => router.push("/learn/ask")}
        className="min-h-11 flex-row items-center gap-row rounded-group bg-highlight-soft px-4 py-3.5 active:opacity-80"
        style={{ borderCurve: "continuous" }}
      >
        <Icon icon={MessageCircleQuestion} size="body" tone="tint" strokeWidth={2} />
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline" className="text-primary">
            问问熊猫
          </Text>
          <Text variant="footnote" className="text-muted-foreground">
            基于已核实科普回答
          </Text>
        </View>
        <Chevron />
      </Pressable>
    </View>
  );
}

function Masthead({ count }: { count?: number }) {
  const stacked = useStacked();
  return (
    <View className={stacked ? "gap-hair-gap px-gutter" : "flex-row items-baseline justify-between gap-row px-gutter"}>
      <Text variant="display">{TITLE}</Text>
      {count ? (
        <Text variant="subheadline" className="text-muted-foreground tabular-nums">
          {`${count} 篇科普`}
        </Text>
      ) : null}
    </View>
  );
}

function FaceGuideCard({
  guide,
  panda,
}: {
  guide: CatalogFaceGuide;
  panda: LearningPanda | null;
}) {
  const cover = usePandaCover(panda?.id);
  const title = learningText(guide.title);
  const tip = visibleTips(guide.tips)[0];
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`认脸指南：${title}`}
      onPress={() => router.push({ pathname: "/learn/faces/[slug]", params: { slug: guide.slug } })}
      className="w-36 overflow-hidden rounded-tile bg-media-placeholder"
      style={{ aspectRatio: 4 / 5, borderCurve: "continuous" }}
    >
      {cover ? (
        <RemoteImage
          source={cover}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          accessible={false}
          transition={200}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-muted pb-12">
          <Text variant="footnote" className="text-muted-foreground">
            暂无照片
          </Text>
        </View>
      )}
      {cover ? <Scrim id={`face-guide-${guide.slug}`} height="55%" /> : null}
      <View className="absolute right-0 bottom-0 left-0 gap-hair-gap p-3">
        <Text
          variant="headline"
          role="none"
          className={cover ? "text-on-media" : "text-foreground"}
          numberOfLines={2}
        >
          {title}
        </Text>
        {tip ? (
          <Text
            variant="footnote"
            role="none"
            className={cover ? "text-on-media/85" : "text-muted-foreground"}
            numberOfLines={1}
          >
            {learningText(tip.label)}
          </Text>
        ) : null}
      </View>
      <PhotoOutline radius={RADIUS.tile} />
    </PressScale>
  );
}

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const { state, reload } = useLearningCatalog();
  const { pandas } = useLearningPandas();
  const bar = <Stack.Screen options={{ title: "", headerLargeTitleEnabled: false, ...NO_WEB_BAR_TITLE }} />;

  if (state.status !== "ready") {
    return (
      <View className="flex-1 bg-background pt-stack-tight">
        {bar}
        <View style={PAGE_COLUMN} className="w-full flex-1 gap-section">
          <Masthead />
          {state.status === "loading" ? (
            <View className="gap-row px-gutter" accessibilityLabel="正在加载">
              <Skeleton className="h-72 w-full rounded-card" />
              <Skeleton className="h-28 w-full rounded-group" />
            </View>
          ) : null}
          {state.status === "failed" ? (
            <LoadFailed message="科普暂时打不开。" onRetry={reload} className="mx-gutter" />
          ) : null}
        </View>
      </View>
    );
  }

  const { catalog } = state;
  const hasContent =
    catalog.articles.length > 0 ||
    catalog.faceGuides.length > 0 ||
    catalog.challenges.length > 0 ||
    catalog.terms.length > 0;
  if (!hasContent) {
    return (
      <View className="flex-1 bg-background pt-stack-tight">
        {bar}
        <View style={PAGE_COLUMN} className="w-full flex-1 gap-section">
          <Masthead />
          <ScreenState message="科普内容准备中。" />
        </View>
      </View>
    );
  }

  const [featured, ...rest] = catalog.articles;
  const faceGuides = catalog.faceGuides.map((guide) => ({
    guide,
    panda: pandas?.find((item) => item.slug === guide.pandaSlug) ?? null,
  }));

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[PAGE_COLUMN, { width: "100%", paddingBottom: insets.bottom + 48 }]}
    >
      {bar}
      <Animated.View entering={PAGE_ENTER} className="gap-section pt-stack-tight">
        <Masthead count={catalog.articles.length} />
        <AskEntry />

        {featured ? (
          <View className="px-gutter">
            <FeaturedArticle article={featured} />
          </View>
        ) : null}

        {CATEGORY_ORDER.map((category) => {
          const articles = rest.filter((article) => article.category === category);
          if (articles.length === 0) return null;
          return (
            <View key={category} className="gap-row px-gutter">
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
            <View className="min-h-11 flex-row items-end justify-between gap-row px-gutter">
              <View className="min-w-0 flex-1">
                <SectionHeader title="认脸指南" count={faceGuides.length > 0 ? `${faceGuides.length} 只` : undefined} />
              </View>
              {catalog.challenges.length > 0 ? (
                <Pressable
                  role="button"
                  accessibilityLabel="认脸挑战"
                  onPress={() => router.push("/learn/challenge")}
                  className="min-h-11 justify-end pb-1 active:opacity-60"
                >
                  <Text variant="body" className="font-semibold text-primary">
                    认脸挑战
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {faceGuides.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-row px-gutter"
              >
                {faceGuides.map(({ guide, panda }) => (
                  <FaceGuideCard key={guide.slug} guide={guide} panda={panda} />
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {catalog.terms.length > 0 ? (
          <View className="px-gutter">
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
          <Text variant="footnote" className="px-gutter text-muted-foreground">
            {`资料版本 ${catalog.version}`}
          </Text>
        ) : null}
      </Animated.View>
    </ScrollView>
  );
}

/** Magazine lead story with bottom scrim overlay when a hero photo exists. */
function FeaturedArticle({ article }: { article: CatalogArticle }) {
  const title = learningText(article.title);
  const hero = articleHero(article);
  const metaLine = `${article.category}　${readingMinutes(article)} 分钟阅读`;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => openArticle(article.slug)}
      className="overflow-hidden rounded-card bg-card"
      style={{ borderCurve: "continuous" }}
    >
      {hero?.asset ? (
        <View style={{ aspectRatio: 4 / 3 }} className="w-full overflow-hidden bg-media-placeholder">
          <RemoteImage
            source={hero.asset}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            accessible={false}
          />
          <Scrim id="learn-featured" height="65%" />
          <View className="absolute right-0 bottom-0 left-0 gap-1 p-stack">
            <Text variant="footnote" className="text-on-media/85">
              {metaLine}
            </Text>
            <Text variant="title" role="none" className="text-on-media" numberOfLines={3}>
              {title}
            </Text>
            <Text variant="subheadline" className="text-on-media/85" numberOfLines={2}>
              {learningText(article.dek)}
            </Text>
          </View>
        </View>
      ) : (
        <View className="gap-stack-tight p-stack">
          <Text variant="title" role="none">
            {title}
          </Text>
          <Text variant="subheadline" className="text-muted-foreground" numberOfLines={3}>
            {learningText(article.dek)}
          </Text>
          <Text variant="footnote" className="text-muted-foreground">
            {metaLine}
          </Text>
        </View>
      )}
      <PhotoOutline radius={RADIUS.card} />
    </PressScale>
  );
}
