import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Eye, MapPin, ScanFace } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ProgressRing } from "@/components/progress-ring";
import { SectionHeader } from "@/components/section-header";
import { Segmented } from "@/components/segmented";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import {
  type Filter,
  type Group,
  type LifeEntry,
  type LifeList,
  baseGroups,
  baseProgress,
  buildLifeList,
  catalogPercent,
  entryDetail,
  filterEntries,
} from "@/features/book/book";
import { localToday } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex, loadPlaces, placeName } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { LockedPhotoTile, StoryPhotoTile } from "@/features/today/story-photo-tile";
import { useStoryPhotos } from "@/features/today/story-photos";
import { loadVisits } from "@/features/visits/visits";
import { authedApi } from "@/lib/api";
import { RADIUS, pageColumn } from "@/lib/surface";

const GAP = 12;
/** Tiles the grid shows before 显示全部: three rows of four. */
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
  /** Every published panda: what 点亮 counts against. */
  catalog: number;
  visitedPlaces: number;
  bases: Group[];
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
  const list = buildLifeList(games.data.items, seen.data.items);
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

/** The three ways a panda or a place gets into the list, each a row that goes and does it. */
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

/** 点亮: the pandas met against every published panda, one ring, as Fitness shows a share. */
function Lit({ met, catalog }: { met: number; catalog: number }) {
  const percent = catalogPercent(met, catalog);
  return (
    <View
      className="flex-row items-center gap-stack rounded-group bg-card p-inset"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`点亮 ${met} 只，共收录 ${catalog.toLocaleString("zh-CN")} 只，${percent}%`}
    >
      <ProgressRing value={percent / 100} label={`${percent}%`} accessibilityLabel={`点亮 ${percent}%`} />
      <View className="min-w-0 flex-1 gap-hair-gap">
        <Text variant="footnote" className="text-muted-foreground" role="none">
          点亮
        </Text>
        <Text role="none">
          <Text variant="stat">{met.toLocaleString("zh-CN")}</Text>
          <Text variant="subheadline" className="text-muted-foreground tabular-nums">
            {` / ${catalog.toLocaleString("zh-CN")}`}
          </Text>
        </Text>
      </View>
    </View>
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

/** Four square tiles a row, as Photos lays out an album; three when rows stack. */
function useTiles() {
  const { width } = useWindowDimensions();
  const columns = useStacked() ? 3 : 4;
  const column = pageColumn(width);
  return { columns, tile: Math.floor((column - GAP * (columns - 1)) / columns) };
}

/** One panda met: its cover and its name. The spoken label says when and where. */
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

/** What is still to meet: one row of empty tiles, never the whole catalog. It opens 找熊猫. */
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

/** Each base the fan has met a panda at or been to: met out of those living there now. */
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

/** Keyed by account, so another fan signing in on this device starts from a fresh load. */
function SignedIn() {
  const [book, setBook] = useState<Book | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(() => {
    loadBook()
      .then(setBook)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) {
    return (
      <LoadFailed
        message="图鉴暂时打不开。"
        onRetry={() => {
          setFailed(false);
          load();
        }}
      />
    );
  }
  if (!book) return <Loading />;

  const empty = book.list.entries.length === 0;
  return (
    <Animated.View entering={PAGE_ENTER} className="gap-section">
      <View className="gap-row">
        <Lit met={book.list.entries.length} catalog={book.catalog} />
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
          <WaysIn title="怎样记下" />
        </>
      ) : (
        <View className="gap-row">
          <Segmented value={filter} options={VIEWS} onChange={setFilter} accessibilityLabel="图鉴里看哪些熊猫" />
          <Grid key={filter} book={book} filter={filter} />
        </View>
      )}
      <Bases bases={book.bases} />
    </Animated.View>
  );
}

/** Three portrait tiles a row, as Photos lays out an album; two when rows stack. */
function useGrid() {
  const { width } = useWindowDimensions();
  const columns = useStacked() ? 2 : 3;
  const column = pageColumn(width);
  return { columns, tile: Math.floor((column - GAP * (columns - 1)) / columns) };
}

/** Which tiles of the signed-out preview show a panda; the rest wait under a lock. */
function isOpenTile(index: number, columns: number) {
  return index === 0 || index === columns + 1;
}

/**
 * The signed-out 图鉴: a preview where two real pandas are lit and the rest wait under a lock, what
 * the list keeps, and the three ways in. The only number is the real catalog size.
 */
function SignedOut() {
  const { columns, tile } = useGrid();
  const photos = useStoryPhotos(localToday(), columns * 2);
  const [published, setPublished] = useState<number | null>(null);
  useEffect(() => {
    loadPandaIndex()
      .then((pandas) => setPublished(pandas.length))
      .catch(() => setPublished(null));
  }, []);
  const tiles = useMemo(() => Array.from({ length: columns * 2 }, (_, index) => index), [columns]);
  return (
    <>
      <View className="gap-stack">
        <View className="flex-row flex-wrap" style={{ gap: GAP }}>
          {tiles.map((index) =>
            isOpenTile(index, columns) ? (
              <StoryPhotoTile key={index} photo={photos[index]} width={tile} slot={`book-${index}`} />
            ) : (
              <LockedPhotoTile key={index} photo={photos[index]} width={tile} />
            ),
          )}
        </View>
        <View className="gap-hair-gap">
          <Text variant="title">你的熊猫清单</Text>
          <Text variant="subheadline" className="text-muted-foreground">
            {`认出的、见过的熊猫，去过的基地，都按先后记在这里，连第一次遇见的日子和地方。${
              published === null ? "" : `吱熊猫收录了 ${published} 只熊猫。`
            }`}
          </Text>
        </View>
      </View>
      <View className="gap-stack-tight">
        <Button onPress={() => router.push("/sign-in")}>
          <Text>登录，开始记</Text>
        </Button>
        <Button variant="plain" onPress={() => router.push("/daily")}>
          <Text>先去猜今天的每日一猫</Text>
        </Button>
      </View>
      <WaysIn title="三种记法" footer="清单只给你自己看，没有排行。" />
    </>
  );
}

export default function BookScreen() {
  const { state } = useSession();
  return (
    <Page title="图鉴" back={false}>
      {state.status === "signedIn" ? <SignedIn key={state.accountId} /> : null}
      {state.status === "signedOut" ? <SignedOut /> : null}
      {state.status === "loading" ? <Loading /> : null}
      {state.status === "unavailable" ? (
        <Text variant="subheadline" className="text-muted-foreground">
          账号暂时不可用，请稍后再试。
        </Text>
      ) : null}
    </Page>
  );
}
