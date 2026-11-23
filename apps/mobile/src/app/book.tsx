import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Eye, MapPin, ScanFace } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { SectionHeader } from "@/components/section-header";
import { Segmented } from "@/components/segmented";
import { StatTile } from "@/components/stat-tile";
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
  baseProgress,
  buildLifeList,
  entryDetail,
  filterEntries,
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

const GAP = 12;
const FIRST_TILES = 12;

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

function Stats({ book }: { book: Book }) {
  const stacked = useStacked();
  return (
    <View className={stacked ? "gap-row" : "flex-row gap-row"}>
      <StatTile icon={Eye} label="见过" value={`${book.list.seenCount} 只`} />
      <StatTile icon={ScanFace} label="认出" value={`${book.list.recognizedCount} 只`} />
      <StatTile icon={MapPin} label="去过" value={`${book.visitedPlaces} 处`} />
    </View>
  );
}

function useTiles() {
  const { width } = useWindowDimensions();
  const columns = useStacked() ? 3 : 4;
  const column = pageColumn(width);
  return { columns, tile: Math.floor((column - GAP * (columns - 1)) / columns) };
}

function MetTile({ entry, panda, detail, size }: { entry: LifeEntry; panda: PandaListItem | undefined; detail: string; size: number }) {
  const name = panda?.name ?? "熊猫";
  return (
    <Pressable
      onPress={() => panda && openPanda(panda.slug)}
      disabled={!panda}
      role="link"
      accessibilityLabel={`No.${entry.number}，${name}，${detail}`}
      className="items-center gap-stack-tight active:opacity-70"
      style={{ width: size }}
    >
      <PandaThumb pandaId={entry.pandaId} name={name} size={size} shape="tile" />
      <Text variant="footnote" className="font-semibold" numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

function Unmet({ count, columns, size }: { count: number; columns: number; size: number }) {
  const tiles = Array.from({ length: Math.min(count, columns) }, (_, index) => index);
  return (
    <Pressable
      onPress={() => router.push("/find")}
      role="link"
      accessibilityLabel={`还有 ${count.toLocaleString("zh-CN")} 只没见过，去找熊猫`}
      className="flex-row active:opacity-70"
      style={{ gap: GAP }}
    >
      {tiles.map((index) => (
        <View key={index} className="items-center gap-stack-tight" style={{ width: size }} accessible={false}>
          <View
            className="items-center justify-center bg-card"
            style={{ width: size, height: size, borderRadius: RADIUS.tile, borderCurve: "continuous" }}
          >
            <Icon icon={Eye} tone="tertiary" />
          </View>
          <Text variant="footnote" className="text-muted-foreground">
            未见过
          </Text>
        </View>
      ))}
    </Pressable>
  );
}

function Grid({ book, filter }: { book: Book; filter: Filter }) {
  const { columns, tile } = useTiles();
  const [all, setAll] = useState(false);
  const entries = filterEntries(book.list.entries, filter);
  const shown = all ? entries : entries.slice(0, FIRST_TILES);
  const name = (placeId: string) => book.placeNames.get(placeId) ?? null;
  const unmet = book.catalog - book.list.entries.length;
  return (
    <View className="gap-row">
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {shown.map((entry) => (
          <MetTile
            key={entry.pandaId}
            entry={entry}
            panda={book.pandas.get(entry.pandaId)}
            detail={entryDetail(entry, name)}
            size={tile}
          />
        ))}
      </View>
      {entries.length > FIRST_TILES ? (
        <Button variant="plain" onPress={() => setAll((value) => !value)}>
          <Text>{all ? "收起" : `显示全部 ${entries.length} 只`}</Text>
        </Button>
      ) : null}
      {filter !== "recognized" && unmet > 0 ? <Unmet count={unmet} columns={columns} size={tile} /> : null}
    </View>
  );
}

function Bases({ bases }: { bases: Group[] }) {
  const started = bases.filter((group) => group.known > 0 || group.visitedOn !== null);
  if (started.length === 0) return null;
  return (
    <View className="gap-row">
      <SectionHeader title="各个基地" />
      <ListSection>
        {started.map((group, index) => {
          const progress = baseProgress(group);
          const done = group.members.length > 0 && group.known === group.members.length;
          const spoken = progress ? `认识 ${group.known} 只，共 ${group.members.length} 只` : "现在没有熊猫住在这里";
          return (
            <ListCell
              key={group.key}
              icon={MapPin}
              label={group.title}
              meta={progress ?? undefined}
              href={group.slug ? { pathname: "/places/[slug]", params: { slug: group.slug } } : undefined}
              accessibilityLabel={[group.title, spoken, done ? "全部认识" : null].filter(Boolean).join("，")}
              last={index === started.length - 1}
            />
          );
        })}
      </ListSection>
    </View>
  );
}

function Loading() {
  return (
    <View className="gap-section" accessibilityLabel="正在加载图鉴">
      <Skeleton className="h-24 w-full rounded-tile" />
      <View className="flex-row gap-row">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-20 flex-1 rounded-tile" />
        ))}
      </View>
      <Skeleton className="h-9 w-full rounded-control" />
      <Skeleton className="h-72 w-full rounded-group" />
    </View>
  );
}

function BookBody({ book, guest = false }: { book: Book; guest?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const empty = book.list.entries.length === 0;
  return (
    <Animated.View entering={PAGE_ENTER} className="gap-section">
      <View className="gap-row">
        <LitCard met={book.list.entries.length} catalog={book.catalog} />
        <Stats book={book} />
      </View>
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
      <Bases bases={book.bases} />
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
