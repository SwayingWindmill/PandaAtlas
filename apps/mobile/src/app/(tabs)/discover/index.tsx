import { useQuery } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { CalendarDays, Columns, History, type LucideIcon, Network } from "@/components/icons";
import { BARLESS_TOP, ROOT_TITLE_IN_COLUMN } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Text } from "@/components/ui/text";
import { useBirthdayWeek } from "@/features/birthdays/use-week";
import { PhotoCard } from "@/features/discover/photo-card";
import { type TopicId, arrangeTopics } from "@/features/discover/topics";
import { VenueTile } from "@/features/discover/venue-tile";
import { localToday } from "@/features/engagement/seen";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { learningText } from "@/features/learning/catalog";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { useMemories } from "@/features/on-this-day/use-memories";
import { loadOverseasStatus } from "@/features/overseas/overseas-status";
import { StoryCard } from "@/features/today/story-card";
import { useStoryPhotos } from "@/features/today/story-photos";
import { loadWeek } from "@/features/today/week-data";
import { loadVenueNews } from "@/features/venue-news/venue-news";
import { useYearReview } from "@/features/year-review/load";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { pageColumn } from "@/lib/surface";

const GAP = 12;
/** 今天 takes the day's first four story photos; 发现 takes the ones after, so no panda repeats between them. */
const TODAY_STORIES = 4;
/** One photo each for the 本期专题, three 专题, four 玩一玩 and three 时间里的熊猫 cards. */
const PHOTOS = 11;
const VENUE = 88;
const ARTICLES_SHOWN = 3;

const PLAY = [
  { id: "daily", title: "每日一猫", href: "/daily" },
  { id: "guess", title: "猜熊猫", href: "/guess" },
  { id: "faces", title: "认脸挑战", href: "/learn/challenge" },
  { id: "challenge", title: "月度挑战", href: "/challenge" },
] as const;

/** A row of photo cards that scrolls sideways past the page's gutter and snaps card by card. */
function Rail({ snap, children }: { snap?: number; children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-gutter"
      contentContainerClassName="px-gutter"
      contentContainerStyle={{ gap: GAP }}
      snapToInterval={snap}
      snapToAlignment="start"
      decelerationRate={snap ? "fast" : "normal"}
    >
      {children}
    </ScrollView>
  );
}

/** A capsule link under 时间里的熊猫: a glyph and a name, for the pages that are always there. */
function PillLink({ label, icon, href }: { label: string; icon: LucideIcon; href: Href }) {
  return (
    <Pressable
      role="link"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      className="min-h-11 flex-row items-center gap-stack-tight rounded-full bg-card px-4 active:opacity-70"
    >
      <Icon icon={icon} size={18} tone="label" />
      <Text variant="subheadline" className="font-semibold">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * 发现: the standing directory of 熊猫图鉴's pages, led by photographs as Daily Art's discover page is. 今天
 * pushes what is timely; this tab keeps every page one tap away, including the ones 今天 only shows on a day
 * that has something. A block whose page has nothing to show is left out.
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
  const { hero, rail } = arrangeTopics(hasContent, today);

  const { memories } = useMemories();
  const birthdays = useBirthdayWeek();
  const week = useQuery({ queryKey: ["discover-week", today], queryFn: () => loadWeek() });
  const yearReview = useYearReview(Number(today.slice(0, 4)));
  const times = [
    ...(memories && memories.length > 0 ? [{ id: "on-this-day", title: "那年今天", href: "/on-this-day" as const }] : []),
    ...((birthdays.data?.length ?? 0) > 0 ? [{ id: "birthdays", title: "生日周", href: "/birthdays" as const }] : []),
    ...(week.data?.digest ? [{ id: "week", title: "本周新鲜事", href: "/week" as const }] : []),
  ];

  const { data: institutions } = useQuery(institutionListQueryOptions());
  const { state: learning } = useLearningCatalog();
  const articles = learning.status === "ready" ? learning.catalog.articles.slice(0, ARTICLES_SHOWN) : [];

  const card = Math.round(Math.min(column * 0.42, 200));
  const square = Math.floor((column - GAP) / 2);
  const railPhotos = photos.slice(1, 4);
  const playPhotos = photos.slice(4, 8);
  const timePhotos = photos.slice(8);

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
          {hero ? (
            <StoryCard
              featured
              id={`discover-${hero.id}`}
              title={hero.dek}
              feature={`本期专题　${hero.title}`}
              href={hero.href}
              photo={photos[0]}
              height={Math.round(column * 1.2)}
            />
          ) : null}
        </View>

        {rail.length > 0 ? (
          <View className="gap-stack-tight">
            <SectionHeader title="专题" />
            <Rail snap={card + GAP}>
              {rail.map((topic, index) => (
                <PhotoCard
                  key={topic.id}
                  id={topic.id}
                  title={topic.title}
                  spoken={topic.spoken}
                  href={topic.href}
                  photo={railPhotos[index]}
                  width={card}
                />
              ))}
            </Rail>
          </View>
        ) : null}

        <View className="gap-stack-tight">
          <SectionHeader title="玩一玩" />
          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {PLAY.map((game, index) => (
              <PhotoCard key={game.id} id={game.id} title={game.title} href={game.href} photo={playPhotos[index]} width={square} ratio={1} />
            ))}
          </View>
        </View>

        <View className="gap-stack-tight">
          <SectionHeader title="时间里的熊猫" />
          {times.map((entry, index) => (
            <PhotoCard
              key={entry.id}
              id={entry.id}
              title={entry.title}
              href={entry.href}
              photo={timePhotos[index]}
              width={column}
              ratio={14 / 9}
            />
          ))}
          <View className="flex-row flex-wrap gap-stack-tight">
            <PillLink label="熊猫日历" icon={CalendarDays} href="/calendar" />
            {yearReview.data && !yearReview.data.review.empty ? <PillLink label="年度回顾" icon={History} href="/year-review" /> : null}
          </View>
        </View>

        {institutions && institutions.length > 0 ? (
          <View className="gap-stack-tight">
            <SectionHeader title="按场馆逛" action={{ label: "全部", href: "/institutions", accessibilityLabel: "全部场馆" }} />
            <Rail>
              {institutions.map((institution) => (
                <VenueTile
                  key={institution.slug}
                  slug={institution.slug}
                  name={institution.nameZh ?? institution.nameEn ?? institution.slug}
                  size={VENUE}
                />
              ))}
            </Rail>
          </View>
        ) : null}

        {articles.length > 0 ? (
          <View className="gap-stack-tight">
            <SectionHeader title="认识大熊猫" action={{ label: "全部", href: "/learn", accessibilityLabel: "认识大熊猫全部" }} />
            <ListSection>
              {articles.map((article, index) => (
                <ListCell
                  key={article.slug}
                  label={learningText(article.title)}
                  detail={learningText(article.dek) || undefined}
                  href={{ pathname: "/learn/articles/[slug]", params: { slug: article.slug } }}
                  last={index === articles.length - 1}
                />
              ))}
            </ListSection>
          </View>
        ) : null}

        <ListSection title="工具">
          <ListCell label="比一比" icon={Columns} href="/compare" accessibilityLabel="比一比两只熊猫" />
          <ListCell label="查关系" icon={Network} href="/relationship" accessibilityLabel="查两只熊猫的关系" last />
        </ListSection>
      </ScrollView>
    </>
  );
}
