import { useQuery } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import { useLayoutEffect, useState } from "react";
import { Pressable, Share, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { Chevron, ListCell, ListSection, useSingleColumn, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Compass, Eye, MapPin, ScanFace, Share as ShareIcon } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { Scrim } from "@/components/scrim";
import { SectionHeader } from "@/components/section-header";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import {
  type Filter,
  type GameEntry,
  type Group,
  type LifeEntry,
  type LifeList,
  type SeenEntry,
  baseGroups,
  basePercent,
  baseProgress,
  buildLifeList,
  catalogPercent,
  entryDetail,
  filterEntries,
  pickBaseLeadPandaId,
} from "@/features/book/book";
import { LitCard } from "@/features/book/lit-card";
import {
  loadGuestGames,
  loadGuestSeen,
  loadGuestVisits,
} from "@/features/engagement/guest-store";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex, loadPlaces, placeName } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { type Visit, loadVisits } from "@/features/visits/visits";
import { authedApi } from "@/lib/api";
import { RADIUS, pageColumn } from "@/lib/surface";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";
import { cn } from "@/lib/utils";

const GAP = 12;
const FIRST_TILES = 12;
const BASE_AVATAR = 42;

const VIEWS = [
  { value: "all", label: "全部" },
  { value: "seen", label: "见过" },
  { value: "recognized", label: "认出" },
] as const;

interface Book {
  list: LifeList;
  pandas: Map<string, PandaListItem>;
  placeNames: Map<string, string>;
  catalog: number;
  visitedPlaces: number;
  bases: Group[];
}

type PlacesMap = Awaited<ReturnType<typeof loadPlaces>>;

function assembleBook(
  games: GameEntry[],
  seen: SeenEntry[],
  visits: Visit[],
  index: PandaListItem[],
  places: PlacesMap,
): Book {
  const list = buildLifeList(games, seen);
  const known = new Set(list.entries.map((entry) => entry.pandaId));
  const placeNames = new Map(
    [...places].flatMap(([id, place]) => {
      const name = placeName(place);
      return name ? [[id, name] as const] : [];
    }),
  );
  const placeLike = new Map(
    [...places].map(([id, place]) => [id, { slug: place.slug, placeType: place.placeType, name: placeNames.get(id) ?? null }]),
  );
  return {
    list,
    pandas: new Map(index.map((panda) => [panda.id, panda])),
    placeNames,
    catalog: index.length,
    visitedPlaces: new Set(visits.map((visit) => visit.placeId)).size,
    bases: baseGroups(index.filter((panda) => !panda.deceased), placeLike, known, visits),
  };
}

async function loadBook(): Promise<Book> {
  const [games, seen, visits, index, places] = await Promise.all([
    authedApi.GET("/api/v2/me/panda-book"),
    authedApi.GET("/api/v2/me/seen-pandas"),
    loadVisits(),
    loadPandaIndex(),
    loadPlaces(),
  ]);
  if (!games.data || !seen.data) throw new Error("Panda book unavailable");
  return assembleBook(games.data.items, seen.data.items, visits, index, places);
}

async function loadGuestBook(): Promise<Book> {
  const [games, seenMap, visits, index, places] = await Promise.all([
    loadGuestGames(),
    loadGuestSeen(),
    loadGuestVisits(),
    loadPandaIndex(),
    loadPlaces(),
  ]);
  const seen: SeenEntry[] = Object.entries(seenMap).map(([pandaId, entry]) => ({
    pandaId,
    seenOn: entry.seenOn,
    placeId: entry.placeId ?? null,
    firstSeenAt: entry.firstSeenAt,
  }));
  return assembleBook(games, seen, visits, index, places);
}

function WaysIn({ title, footer }: { title: string; footer?: string }) {
  return (
    <ListSection title={title} footer={footer}>
      <ListCell
        icon={ScanFace}
        label="认出"
        detail="每日一猫和猜熊猫里猜中的熊猫，会自动记下"
        href="/daily"
        accessibilityLabel="认出：每日一猫和猜熊猫里猜中的熊猫会自动记下，去猜今天的每日一猫"
      />
      <ListCell
        icon={Eye}
        label="见过"
        detail="在现场见到了，就在它的资料页点「见过」"
        href="/find"
        accessibilityLabel="见过：在现场见到了，就在它的资料页点见过，去找熊猫"
      />
      <ListCell
        icon={MapPin}
        label="去过"
        detail="在基地和动物园的页面点「记下今天去过」"
        href="/institutions"
        accessibilityLabel="去过：在基地和动物园的页面点记下今天去过，去看基地和动物园"
        last
      />
    </ListSection>
  );
}

function useTiles() {
  const { width } = useWindowDimensions();
  const columns = useSingleColumn() ? 2 : 3;
  const column = pageColumn(width);
  return { columns, tile: Math.floor((column - GAP * (columns - 1)) / columns) };
}

function MetTile({
  entry,
  panda,
  detail,
  size,
  filter,
}: {
  entry: LifeEntry;
  panda: PandaListItem | undefined;
  detail: string;
  size: number;
  filter: Filter;
}) {
  const name = panda?.name ?? "熊猫";
  const badge = filter === "recognized" ? "认出" : entry.seen ? "见过" : "认出";
  return (
    <Pressable
      onPress={() => panda && openPanda(panda.slug)}
      disabled={!panda}
      role="link"
      accessibilityLabel={`No.${entry.number}，${name}，${detail}`}
      className="overflow-hidden rounded-tile bg-media-placeholder active:opacity-80"
      style={{ width: size, height: size, borderCurve: "continuous" }}
    >
      <PandaThumb pandaId={entry.pandaId} name={name} size={size} shape="tile" />
      <Scrim id={`book-tile-${entry.pandaId}`} height="55%" />
      <View
        aria-hidden
        className="absolute top-2 right-2 rounded-pill bg-glass-fallback px-2 py-0.5"
        style={{ borderCurve: "continuous" }}
      >
        <Text variant="footnote" className="font-semibold text-on-media" role="none">
          {badge}
        </Text>
      </View>
      <View aria-hidden className="absolute right-2.5 bottom-2 left-2.5">
        <Text variant="subheadline" className="font-semibold text-on-media" numberOfLines={1} role="none">
          {name}
        </Text>
      </View>
      <PhotoOutline radius={RADIUS.tile} />
    </Pressable>
  );
}

function DiscoveryRow({ count }: { count: number }) {
  const stacked = useStacked();
  return (
    <Pressable
      onPress={() => router.push("/find")}
      role="link"
      accessibilityLabel={`还有 ${count.toLocaleString("zh-CN")} 只待点亮，去找熊猫`}
      className={cn(
        "min-h-12 border-t-hairline border-border py-row active:opacity-70",
        stacked ? "gap-hair-gap" : "flex-row items-center justify-between gap-row",
      )}
    >
      <View className={cn("flex-row items-center gap-stack-tight", !stacked && "min-w-0 flex-1")}>
        <Icon icon={Compass} size="subhead" tone="tint" />
        <Text
          variant="subheadline"
          className={cn("text-muted-foreground tabular-nums", !stacked && "min-w-0 flex-1")}
          numberOfLines={stacked ? undefined : 2}
        >
          {`还有 ${count.toLocaleString("zh-CN")} 只待点亮`}
        </Text>
      </View>
      <View className="flex-row items-center gap-hair-gap">
        <Text variant="subheadline" className="font-semibold text-primary">
          去找熊猫
        </Text>
        <Chevron />
      </View>
    </Pressable>
  );
}

function Grid({ book, filter }: { book: Book; filter: Filter }) {
  const { tile } = useTiles();
  const [all, setAll] = useState(false);
  const entries = filterEntries(book.list.entries, filter);
  const shown = all ? entries : entries.slice(0, FIRST_TILES);
  const name = (placeId: string) => book.placeNames.get(placeId) ?? null;
  const unmet = book.catalog - book.list.entries.length;
  return (
    <View className="gap-row">
      {entries.length === 0 ? (
        <Text variant="footnote" className="py-stack-tight text-muted-foreground">
          {filter === "seen" ? "还没有标记过现场见到的熊猫" : "还没有通过每日一猫或猜熊猫认出熊猫"}
        </Text>
      ) : (
        <View className="flex-row flex-wrap" style={{ gap: GAP }}>
          {shown.map((entry) => (
            <MetTile
              key={entry.pandaId}
              entry={entry}
              panda={book.pandas.get(entry.pandaId)}
              detail={entryDetail(entry, name)}
              size={tile}
              filter={filter}
            />
          ))}
        </View>
      )}
      {entries.length > FIRST_TILES ? (
        <Button variant="plain" onPress={() => setAll((value) => !value)}>
          <Text>{all ? "收起" : `显示全部 ${entries.length} 只`}</Text>
        </Button>
      ) : null}
      {filter !== "recognized" && unmet > 0 ? <DiscoveryRow count={unmet} /> : null}
    </View>
  );
}

function BaseRow({
  group,
  pandas,
  last,
}: {
  group: Group;
  pandas: Map<string, PandaListItem>;
  last: boolean;
}) {
  const stacked = useStacked();
  const progress = baseProgress(group);
  const pct = basePercent(group);
  const done = group.members.length > 0 && group.known === group.members.length;
  const spoken = progress ? `认识 ${group.known} 只，共 ${group.members.length} 只` : "现在没有熊猫住在这里";
  const leadId = pickBaseLeadPandaId(group.members, pandas);
  const leadPanda = leadId ? pandas.get(leadId) : undefined;
  const statusText = group.visitedOn !== null ? "已到访" : progress ? `${pct}%` : "已到访";
  const href = group.slug ? ({ pathname: "/places/[slug]", params: { slug: group.slug } } as const) : ("/institutions" as const);
  const fillWidth = `${pct}%` as const;

  return (
    <Pressable
      role="link"
      onPress={() => router.push(href)}
      accessibilityLabel={[group.title, spoken, done ? "全部认识" : null].filter(Boolean).join("，")}
      className={cn(
        "min-h-14 flex-row items-center gap-row py-3.5 active:opacity-70",
        !last && "border-b-hairline border-border",
      )}
    >
      {leadPanda ? (
        <PandaThumb pandaId={leadPanda.id} name={leadPanda.name} size={BASE_AVATAR} shape="round" />
      ) : (
        <View className="items-center justify-center" style={{ width: BASE_AVATAR, height: BASE_AVATAR }}>
          <Icon icon={MapPin} size="body" tone="secondary" />
        </View>
      )}
      <View className="min-w-0 flex-1 gap-stack-tight">
        <View className={stacked ? "gap-hair-gap" : "flex-row items-baseline justify-between gap-row"}>
          <Text variant="headline" className={stacked ? undefined : "min-w-0 flex-1"} numberOfLines={stacked ? 2 : 1}>
            {group.title}
          </Text>
          {progress ? (
            <Text variant="subheadline" className="font-rounded font-semibold text-primary tabular-nums">
              {progress}
            </Text>
          ) : null}
        </View>
        <View className={stacked ? "gap-hair-gap" : "flex-row items-center gap-row"}>
          {progress ? (
            <View className={cn("h-1.5 overflow-hidden rounded-pill bg-fill", !stacked && "min-w-0 flex-1")} aria-hidden>
              <View className="h-full rounded-pill bg-graphic" style={{ width: fillWidth }} />
            </View>
          ) : null}
          <Text variant="footnote" className="text-muted-foreground tabular-nums">
            {statusText}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function Bases({ bases, pandas }: { bases: Group[]; pandas: Map<string, PandaListItem> }) {
  const [expanded, setExpanded] = useState(false);
  const started = bases.filter((group) => group.known > 0 || group.visitedOn !== null);
  const unstarted = bases.filter((group) => group.known === 0 && group.visitedOn === null && group.members.length > 0);
  if (started.length === 0) return null;
  const shown = expanded ? [...started, ...unstarted] : started;

  return (
    <View className="gap-stack-tight">
      <SectionHeader
        title="基地集邮进度"
        action={{ label: "逛园打卡 ›", href: "/institutions", accessibilityLabel: "去基地和动物园逛园打卡" }}
      />
      <View>
        {shown.map((group, index) => (
          <BaseRow key={group.key} group={group} pandas={pandas} last={index === shown.length - 1} />
        ))}
      </View>
      {unstarted.length > 0 ? (
        <Button variant="plain" onPress={() => setExpanded((value) => !value)}>
          <Text>{expanded ? "收起其余基地" : `查看其余 ${unstarted.length} 处基地`}</Text>
        </Button>
      ) : null}
    </View>
  );
}

function Loading() {
  return (
    <View className="gap-section" accessibilityLabel="正在加载图鉴">
      <Skeleton className="h-44 w-full rounded-card" />
      <Skeleton className="h-9 w-full rounded-control" />
      <Skeleton className="h-72 w-full rounded-group" />
    </View>
  );
}

function BookBody({ book, guest = false }: { book: Book; guest?: boolean }) {
  const navigation = useNavigation();
  const [filter, setFilter] = useState<Filter>("all");
  const met = book.list.entries.length;
  const empty = met === 0;
  const percent = catalogPercent(met, book.catalog);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          role="button"
          accessibilityLabel="分享我的图鉴"
          onPress={() => {
            void Share.share({
              message: `吱熊猫　我的图鉴：已点亮 ${met.toLocaleString("zh-CN")} / ${book.catalog.toLocaleString("zh-CN")} 只大熊猫（${percent}%），现场见过 ${book.list.seenCount} 只，猜谜认出 ${book.list.recognizedCount} 只，去过 ${book.visitedPlaces} 处场馆`,
            }).catch(() => undefined);
          }}
          hitSlop={8}
          className="min-h-11 flex-row items-center gap-hair-gap px-2 active:opacity-60"
        >
          <Icon icon={ShareIcon} size="subhead" tone="tint" strokeWidth={2} />
          <Text variant="subheadline" className="font-semibold text-primary">
            分享
          </Text>
        </Pressable>
      ),
    });
    return () => {
      navigation.setOptions({ headerRight: undefined });
    };
  }, [navigation, met, book.catalog, percent, book.list.seenCount, book.list.recognizedCount, book.visitedPlaces]);

  return (
    <Animated.View entering={PAGE_ENTER} className="gap-section">
      <LitCard
        met={met}
        catalog={book.catalog}
        seenCount={book.list.seenCount}
        recognizedCount={book.list.recognizedCount}
        visitedPlaces={book.visitedPlaces}
      />
      {empty ? (
        <>
          <View className="gap-hair-gap">
            <Text variant="title">从第一只开始</Text>
            <Text variant="subheadline" className="text-muted-foreground">
              认出、见过的熊猫会点亮在这里。
            </Text>
          </View>
          <WaysIn title="怎样记下" footer={guest ? "记录先保存在本机，绑定邮箱后可同步到云端。" : undefined} />
        </>
      ) : (
        <View className="gap-row">
          <Segmented value={filter} options={VIEWS} onChange={setFilter} accessibilityLabel="图鉴里看哪些熊猫" />
          <Grid key={filter} book={book} filter={filter} />
        </View>
      )}
      <Bases bases={book.bases} pandas={book.pandas} />
      {guest ? (
        <View className="items-center gap-hair-gap pt-stack-tight">
          {!empty ? (
            <Text variant="footnote" className="text-center text-muted-foreground">
              记录先保存在本机，绑定邮箱后可跨设备同步
            </Text>
          ) : null}
          <Button variant="plain" onPress={() => router.push("/sign-in")}>
            <Text>绑定同步</Text>
          </Button>
        </View>
      ) : null}
    </Animated.View>
  );
}

function SignedIn({ accountId }: { accountId: string }) {
  const { data: book, isError, isFetching, refetch } = useQuery({
    queryKey: ["private", accountId, "book"],
    queryFn: loadBook,
  });
  useRefetchOnFocus(refetch);

  if (!book && isError && !isFetching) {
    return (
      <LoadFailed
        message="图鉴暂时打不开。"
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!book) return <Loading />;
  return <BookBody book={book} />;
}

function GuestBook() {
  const { data: book, isError, isFetching, refetch } = useQuery({
    queryKey: ["guest", "book"],
    queryFn: loadGuestBook,
    networkMode: "always",
  });
  useRefetchOnFocus(refetch);

  if (!book && isError && !isFetching) {
    return (
      <LoadFailed
        message="图鉴暂时打不开。"
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!book) return <Loading />;
  return <BookBody book={book} guest />;
}

export default function BookScreen() {
  const { state } = useSession();
  return (
    <Page title="我的图鉴">
      {state.status === "signedIn" ? <SignedIn key={state.accountId} accountId={state.accountId} /> : null}
      {state.status === "signedOut" ? <GuestBook /> : null}
      {state.status === "loading" ? <Loading /> : null}
      {state.status === "unavailable" ? (
        <Text variant="subheadline" className="text-muted-foreground">
          账号暂时不可用，请稍后再试。
        </Text>
      ) : null}
    </Page>
  );
}
