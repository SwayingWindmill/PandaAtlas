import { router } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Binoculars, Check, MapPin, ScanFace } from "@/components/icons";
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
  type Group,
  type LifeEntry,
  type LifeList,
  baseGroups,
  buildLifeList,
  entryDetail,
  familyGroups,
  groupProgress,
  monthDay,
} from "@/features/book/book";
import { localToday } from "@/features/engagement/seen";
import { MilestoneBadge } from "@/features/milestones/badge";
import { MILESTONE_CONFIG } from "@/features/milestones/milestones";
import { useMilestonesOn } from "@/features/milestones/prefs";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex, loadPlaces, placeName } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { LockedPhotoTile, StoryPhotoTile } from "@/features/today/story-photo-tile";
import { useStoryPhotos } from "@/features/today/story-photos";
import { loadVisits } from "@/features/visits/visits";
import { authedApi } from "@/lib/api";
import { loadLineage } from "@/lib/public-data";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

const GAP = 12;
const PHOTO = 56;
/** Rows the 清单 shows before 显示全部. */
const FIRST_ROWS = 12;

type Lens = "list" | "bases" | "families";
const VIEWS = [
  { value: "list", label: "清单" },
  { value: "bases", label: "按基地" },
  { value: "families", label: "按家族" },
] as const;

interface Book {
  list: LifeList;
  pandas: Map<string, PandaListItem>;
  placeNames: Map<string, string>;
  visitedPlaces: number;
  bases: Group[];
  families: Group[];
}

async function loadBook(): Promise<Book> {
  const [games, seen, visits, index, places, lineage] = await Promise.all([
    authedApi.GET("/api/v2/me/panda-book"),
    authedApi.GET("/api/v2/me/seen-pandas"),
    loadVisits(),
    loadPandaIndex(),
    loadPlaces(),
    // Families are a bonus: the list still opens if the lineage does not.
    loadLineage().catch(() => []),
  ]);
  if (!games.data || !seen.data) throw new Error("Panda book unavailable");
  const list = buildLifeList(games.data.items, seen.data.items);
  const known = new Set(list.entries.map((entry) => entry.pandaId));
  const pandas = new Map(index.map((panda) => [panda.id, panda]));
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
    pandas,
    placeNames,
    visitedPlaces: new Set(visits.map((visit) => visit.placeId)).size,
    bases: baseGroups(index.filter((panda) => !panda.deceased), placeLike, known, visits),
    families: familyGroups(lineage, pandas, known),
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
        icon={Binoculars}
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

/**
 * One panda in the list, as Music lists songs in an album: the photo, the name, the story, its number. A
 * number that is a 里程碑 (the 1st, 10th, 50th…) is a 笋金 chip, while 里程碑 is on.
 */
function LifeRow({
  entry,
  panda,
  detail,
  milestone,
  last,
}: {
  entry: LifeEntry;
  panda: PandaListItem | undefined;
  detail: string;
  milestone: boolean;
  last: boolean;
}) {
  const stacked = useStacked();
  const name = panda?.name ?? "熊猫";
  const number = `No.${entry.number}`;
  return (
    <View>
      <Pressable
        onPress={() => panda && openPanda(panda.slug)}
        disabled={!panda}
        role="button"
        accessibilityLabel={[number, milestone ? "里程碑" : null, name, detail].filter(Boolean).join("，")}
        className={cn("min-h-11 gap-row px-inset py-stack-tight active:bg-accent", stacked ? "items-start" : "flex-row items-center")}
      >
        <PandaThumb pandaId={entry.pandaId} name={name} size={PHOTO} />
        <View className={cn("min-w-0 gap-hair-gap", stacked ? "self-stretch" : "flex-1")}>
          <View className="flex-row items-baseline gap-stack-tight">
            <Text variant="headline" className="min-w-0 flex-1" numberOfLines={stacked ? undefined : 1}>
              {name}
            </Text>
            {milestone ? (
              <MilestoneBadge label={number} />
            ) : (
              <Text variant="footnote" className="text-muted-foreground tabular-nums">
                {number}
              </Text>
            )}
          </View>
          <View className="flex-row items-start gap-hair-gap">
            <View className="flex-row gap-hair-gap pt-0.5" accessible={false}>
              {entry.seen ? <Icon icon={Binoculars} size="footnote" tone="secondary" /> : null}
              {entry.recognized ? <Icon icon={ScanFace} size="footnote" tone="secondary" /> : null}
            </View>
            <Text variant="footnote" className="min-w-0 flex-1 text-muted-foreground" numberOfLines={stacked ? undefined : 2}>
              {detail}
            </Text>
          </View>
        </View>
      </Pressable>
      {last ? null : <View className="bg-border" style={{ height: HAIRLINE, marginLeft: stacked ? 16 : 16 + PHOTO + 12 }} />}
    </View>
  );
}

/** A finite goal's progress: a neutral track, as Fitness draws a ring's share, never the tint. */
function Track({ known, total }: { known: number; total: number }) {
  if (total === 0) return null;
  return (
    <View className="h-1 overflow-hidden rounded-pill bg-secondary" accessible={false}>
      <View className="h-1 rounded-pill bg-foreground" style={{ width: `${(known / total) * 100}%`, minWidth: known ? 4 : 0 }} />
    </View>
  );
}

/** Up to three faces from a group, overlapping as Messages shows a group's members. */
function Faces({ ids, pandas }: { ids: string[]; pandas: Map<string, PandaListItem> }) {
  const shown = ids.slice(0, 3);
  return (
    <View className="flex-row" style={{ width: PHOTO }} accessible={false}>
      {shown.map((id, index) => (
        <View
          key={id}
          className="rounded-full border-2 border-card"
          style={{ marginLeft: index === 0 ? 0 : -24, zIndex: shown.length - index }}
        >
          <PandaThumb pandaId={id} name={pandas.get(id)?.name ?? "熊"} size={32} shape="round" />
        </View>
      ))}
    </View>
  );
}

function GroupRow({ group, leading, onPress, last }: { group: Group; leading: ReactNode; onPress: () => void; last: boolean }) {
  const stacked = useStacked();
  const progress = groupProgress(group);
  const visited = group.visitedOn ? `${monthDay(group.visitedOn)}去过` : null;
  const done = group.members.length > 0 && group.known === group.members.length;
  return (
    <View>
      <Pressable
        onPress={onPress}
        role="button"
        accessibilityLabel={[group.title, progress, visited].filter(Boolean).join("，")}
        className={cn("min-h-11 gap-row px-inset py-row active:bg-accent", stacked ? "items-start" : "flex-row items-center")}
      >
        {leading}
        <View className={cn("min-w-0 gap-hair-gap", stacked ? "self-stretch" : "flex-1")}>
          <Text variant="body" numberOfLines={stacked ? undefined : 2}>
            {group.title}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-stack-tight">
            <Text variant="footnote" className="text-muted-foreground tabular-nums">
              {progress}
            </Text>
            {visited ? (
              <View className="flex-row items-center gap-hair-gap">
                <Icon icon={MapPin} size="footnote" tone="tint" />
                <Text variant="footnote" className="text-primary">
                  {visited}
                </Text>
              </View>
            ) : null}
          </View>
          <Track known={group.known} total={group.members.length} />
        </View>
        {done ? <Icon icon={Check} tone="tint" /> : null}
      </Pressable>
      {last ? null : <View className="bg-border" style={{ height: HAIRLINE, marginLeft: stacked ? 16 : 16 + PHOTO + 12 }} />}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
      {children}
    </View>
  );
}

function Bases({ book }: { book: Book }) {
  return (
    <View className="gap-row">
      <Card>
        {book.bases.map((group, index) => (
          <GroupRow
            key={group.key}
            group={group}
            leading={<Faces ids={group.members.length ? group.members : []} pandas={book.pandas} />}
            onPress={() => group.slug && router.push({ pathname: "/places/[slug]", params: { slug: group.slug } })}
            last={index === book.bases.length - 1}
          />
        ))}
      </Card>
      <Text variant="footnote" className="px-inset text-muted-foreground">
        只算现在住在那里的熊猫，熊猫搬家后会跟着变。
      </Text>
      <ListSection>
        <ListCell icon={MapPin} label="去过的地点" meta={`${book.visitedPlaces} 个`} href="/visits" last />
      </ListSection>
    </View>
  );
}

function Families({ book }: { book: Book }) {
  if (book.families.length === 0) {
    return <Text variant="subheadline" className="px-inset text-muted-foreground">家族资料暂时打不开。</Text>;
  }
  return (
    <View className="gap-row">
      <Card>
        {book.families.map((group, index) => (
          <GroupRow
            key={group.key}
            group={group}
            leading={<Faces ids={group.members} pandas={book.pandas} />}
            onPress={() => group.slug && router.push({ pathname: "/pandas/[slug]/family", params: { slug: group.slug } })}
            last={index === book.families.length - 1}
          />
        ))}
      </Card>
      <Text variant="footnote" className="px-inset text-muted-foreground">
        家族来自公开的谱系资料，有出处的亲缘才算进来。
      </Text>
    </View>
  );
}

function List({ book }: { book: Book }) {
  const [all, setAll] = useState(false);
  const entries = all ? book.list.entries : book.list.entries.slice(0, FIRST_ROWS);
  const name = (placeId: string) => book.placeNames.get(placeId) ?? null;
  const milestonesOn = useMilestonesOn();
  const nodes = new Set<number>(MILESTONE_CONFIG.pandas);
  return (
    <View className="gap-section">
      <View className="gap-row">
        <Card>
          {entries.map((entry, index) => (
            <LifeRow
              key={entry.pandaId}
              entry={entry}
              panda={book.pandas.get(entry.pandaId)}
              detail={entryDetail(entry, name)}
              milestone={milestonesOn && nodes.has(entry.number)}
              last={index === entries.length - 1}
            />
          ))}
        </Card>
        {book.list.entries.length > FIRST_ROWS ? (
          <Button variant="plain" onPress={() => setAll((value) => !value)}>
            <Text>{all ? "收起" : `显示全部 ${book.list.entries.length} 只`}</Text>
          </Button>
        ) : null}
      </View>
      <WaysIn title="怎样记下" footer="见过可以随时在熊猫的资料页补记或取消。这份清单只给你自己看。" />
    </View>
  );
}

function Stats({ book }: { book: Book }) {
  const stacked = useStacked();
  return (
    <View className={stacked ? "gap-row" : "flex-row gap-row"}>
      <StatTile icon={Binoculars} label="见过" value={`${book.list.seenCount} 只`} />
      <StatTile icon={ScanFace} label="认出" value={`${book.list.recognizedCount} 只`} />
      <StatTile icon={MapPin} label="去过" value={`${book.visitedPlaces} 处`} />
    </View>
  );
}

function Loading() {
  return (
    <View className="gap-section" accessibilityLabel="正在加载图鉴">
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
  const [view, setView] = useState<Lens>("list");

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
      <Stats book={book} />
      {empty ? (
        <>
          <View className="gap-hair-gap px-inset">
            <Text variant="title">从第一只开始</Text>
            <Text variant="subheadline" className="text-muted-foreground">
              认出、见过的熊猫会按先后编号，第一只就是 No.1。
            </Text>
          </View>
          <WaysIn title="怎样记下" />
          <View className="gap-row">
            <View className="px-inset">
              <SectionHeader title="各个基地" />
            </View>
            <Bases book={book} />
          </View>
        </>
      ) : (
        <>
          <Segmented value={view} options={VIEWS} onChange={setView} accessibilityLabel="图鉴的看法" />
          {view === "list" ? <List book={book} /> : view === "bases" ? <Bases book={book} /> : <Families book={book} />}
        </>
      )}
    </Animated.View>
  );
}

/** Three portrait tiles a row, as Photos lays out an album; two when rows stack. */
function useGrid() {
  const { width } = useWindowDimensions();
  const columns = useStacked() ? 2 : 3;
  const column = Math.min(width, 700) - 32;
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
