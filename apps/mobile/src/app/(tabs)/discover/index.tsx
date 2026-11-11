import { useQuery } from "@tanstack/react-query";
import { Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListSection } from "@/components/grouped-list";
import { BARLESS_TOP, ROOT_TITLE_IN_COLUMN } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Text } from "@/components/ui/text";
import { CalendarCard } from "@/features/discover/calendar-card";
import { PhotoCard } from "@/features/discover/photo-card";
import { type TopicId, arrangeDiscover } from "@/features/discover/topics";
import { localToday } from "@/features/engagement/seen";
import { articleHero, learningText } from "@/features/learning/catalog";
import { FeedArticle } from "@/features/learning/feed-article";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { loadOverseasStatus } from "@/features/overseas/overseas-status";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { StoryCard } from "@/features/today/story-card";
import { hasCuratedCover } from "@/features/today/story-order";
import { useStoryPhotos } from "@/features/today/story-photos";
import { loadVenueNews } from "@/features/venue-news/venue-news";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { usePandaCover } from "@/lib/covers";
import { pageColumn } from "@/lib/surface";

const GAP = 12;
/** 今天 takes the day's first four story photos; 发现 takes the ones after, so no panda repeats between them. */
const TODAY_STORIES = 4;
/** One photo each for a 专题 lead, three 专题 and four 玩一玩 cards. */
const PHOTOS = 8;
const ARTICLES_SHOWN = 3;

const PLAY = [
  { id: "daily", title: "每日一猫", href: "/daily" },
  { id: "guess", title: "猜熊猫", href: "/guess" },
  { id: "faces", title: "认脸挑战", href: "/learn/challenge" },
  { id: "challenge", title: "月度挑战", href: "/challenge" },
] as const;

/**
 * 发现: what to read and play when the fan is not looking for one panda, led by photographs as Daily Art's
 * discover page is. 今天 pushes what is timely and 找熊猫 finds a panda or a venue; this tab holds the
 * articles, 专题, the calendar and the games. A block with nothing real to show is left out.
 */
export default function DiscoverScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  // Android and the web have no bar on a tab root, so the column clears the status bar and draws the title.
  const top = Platform.OS === "android" ? insets.top + BARLESS_TOP : 0;
  const today = localToday();
  const column = pageColumn(width);
  const photos = useStoryPhotos(today, TODAY_STORIES + PHOTOS).slice(TODAY_STORIES);

  const overseas = useQuery({ queryKey: ["overseas-status"], queryFn: loadOverseasStatus });
  const news = useQuery({ queryKey: ["venue-news", "all"], queryFn: () => loadVenueNews() });
  const hasContent = (id: TopicId) =>
    id === "returning" ? (overseas.data?.length ?? 0) > 0 : id === "venue-news" ? (news.data?.length ?? 0) > 0 : true;
  const { state: learning } = useLearningCatalog();
  const articles = learning.status === "ready" ? learning.catalog.articles : [];
  // An article leads only with the panda its hero photo shows, through that panda's reviewed cover on our
  // own media host: the article's hotlinked original is too big and too slow for the first screen.
  const { data: pandas } = useQuery(pandaIndexQueryOptions());
  const pandaOf = (article: (typeof articles)[number]) => {
    const slug = articleHero(article)?.pandaSlug;
    const panda = slug ? pandas?.find((item) => item.slug === slug) : undefined;
    return panda && hasCuratedCover(panda.id) ? panda : undefined;
  };
  const illustrated = articles.filter((article) => pandaOf(article));
  const { lead, rail } = arrangeDiscover(illustrated, hasContent, today);
  const listed = articles.filter((article) => lead?.kind !== "article" || article !== lead.article).slice(0, ARTICLES_SHOWN);
  const leadPanda = lead?.kind === "article" ? pandaOf(lead.article) : undefined;
  const leadCover = usePandaCover(leadPanda?.id);

  const card = Math.round(Math.min(column * 0.42, 200));
  const square = Math.floor((column - GAP) / 2);
  const height = Math.round(column * 1.2);

  return (
    <>
      <StatusBarCover />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-section px-gutter"
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
      >
        <View className="gap-stack">
          {ROOT_TITLE_IN_COLUMN ? <Text variant="display">发现</Text> : null}
          {lead?.kind === "article" && leadPanda ? (
            <StoryCard
              featured
              id={`discover-${lead.article.slug}`}
              title={learningText(lead.article.title)}
              feature={`本期　${lead.article.category}`}
              href={{ pathname: "/learn/articles/[slug]", params: { slug: lead.article.slug } }}
              photo={leadCover ? { pandaId: leadPanda.id, slug: leadPanda.slug, name: leadPanda.name, url: leadCover } : undefined}
              height={height}
            />
          ) : lead?.kind === "topic" ? (
            <StoryCard
              featured
              id={`discover-${lead.topic.id}`}
              title={lead.topic.dek}
              feature={`本期专题　${lead.topic.title}`}
              href={lead.topic.href}
              photo={photos[0]}
              height={height}
            />
          ) : null}
        </View>

        <CalendarCard today={today} />

        {rail.length > 0 ? (
          <View className="gap-stack-tight">
            <SectionHeader title="专题" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-gutter"
              contentContainerClassName="px-gutter"
              contentContainerStyle={{ gap: GAP }}
              snapToInterval={card + GAP}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              {rail.map((topic, index) => (
                <PhotoCard
                  key={topic.id}
                  id={topic.id}
                  title={topic.title}
                  spoken={topic.spoken}
                  href={topic.href}
                  photo={photos[1 + index]}
                  width={card}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View className="gap-stack-tight">
          <SectionHeader title="玩一玩" />
          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {PLAY.map((game, index) => (
              <PhotoCard key={game.id} id={game.id} title={game.title} href={game.href} photo={photos[4 + index]} width={square} ratio={1} />
            ))}
          </View>
        </View>

        {listed.length > 0 ? (
          <View className="gap-stack-tight">
            <SectionHeader title="文章" action={{ label: "全部", href: "/learn", accessibilityLabel: "全部文章" }} />
            <ListSection>
              {listed.map((article, index) => (
                <FeedArticle key={article.slug} article={article} last={index === listed.length - 1} />
              ))}
            </ListSection>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
