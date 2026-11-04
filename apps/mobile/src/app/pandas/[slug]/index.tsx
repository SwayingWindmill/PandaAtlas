import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/chip";
import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  BadgeCheck,
  Cake,
  CalendarHeart,
  Clock,
  Flag,
  Flower,
  FolderHeart,
  History,
  Hourglass,
  type LucideIcon,
  MapPin,
  Mars,
  Network,
  Newspaper,
  Plane,
  Venus,
} from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { PressScale } from "@/components/press-scale";
import { HeroHeader, useHeroScroll } from "@/components/hero-header";
import { HeroFade } from "@/components/scrim";
import { SectionHeader } from "@/components/section-header";
import { Segmented } from "@/components/segmented";
import { StretchyHero } from "@/components/stretchy-hero";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { PAGE_ENTER } from "@/design/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CompareRows } from "@/features/compare/compare-rows";
import { PandaActions } from "@/features/engagement/panda-actions";
import { type Family, type FamilyMember } from "@/features/family/family";
import { sourceLine } from "@/features/on-this-day/memory-group";
import { useMilestonesOn } from "@/features/milestones/prefs";
import { DECEASED_POLICY, isCubDay } from "@/features/on-this-day/on-this-day";
import { openPanda } from "@/features/pandas/panda-row";
import { type Photo, type Profile, longDate, profileQueryOptions, shortPublisher } from "@/features/pandas/profile";
import type { Stat } from "@/features/pandas/profile-facts";
import type { MilestoneKind } from "@/features/timeline/timeline";
import { RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** Hero height below the status bar. The photo runs under the status bar too. */
const HERO = 320;
/** How far the name block rides up onto the photo's faded bottom. */
const OVERLAP = 64;

function correct(slug: string) {
  router.push({ pathname: "/pandas/[slug]/correct", params: { slug } });
}

function statIcon(stat: Stat, deceased: boolean): LucideIcon {
  if (stat.key === "birth") return Cake;
  if (stat.key === "age") return deceased ? Hourglass : Clock;
  return deceased ? Flower : MapPin;
}

/** The word after an event's date: what kind of thing happened. */
const KIND_WORD: Record<MilestoneKind, string> = {
  birth: "出生",
  cub: "产仔",
  move: "迁居",
  arrive: "迁居",
  home: "回国",
  debut: "亮相",
  naming: "命名",
  death: "离世",
  stay: "入住",
  leave: "迁出",
  month: "满月",
  hundred: "百天",
  age: "生日",
  parent: "产仔",
};

/** One of the three tiles: the tint glyph and label on top, the value large with its unit under it. */
function StatTile({
  stat,
  confirmed,
  onPress,
  stacked,
  deceased,
}: {
  stat: Stat;
  deceased: boolean;
  /** Read out with the birthday when the date is confirmed. */
  confirmed: boolean;
  onPress?: () => void;
  stacked: boolean;
}) {
  const label = stat.key === "place" ? (stat.detail ?? stat.label) : stat.label;
  const spoken = `${stat.label}，${stat.value}${stat.unit ?? ""}${stat.detail ? `，${stat.detail}` : ""}${confirmed ? "，已确认" : ""}`;
  const body = (
    <View className="flex-1 bg-card px-3 py-3" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
      <View className="flex-row items-center gap-1">
        <Icon icon={statIcon(stat, deceased)} size="footnote" tone="tint" strokeWidth={2.3} />
        <Text variant="footnote" className="shrink font-semibold text-muted-foreground" numberOfLines={stacked ? undefined : 1}>
          {label}
        </Text>
      </View>
      <View className="mt-1.5 flex-row items-baseline gap-0.5">
        <Text variant="stat" className="shrink" numberOfLines={stacked ? undefined : 1} adjustsFontSizeToFit={!stacked}>
          {stat.value}
        </Text>
        {stat.unit ? <Text className="text-footnote font-semibold">{stat.unit}</Text> : null}
      </View>
    </View>
  );
  const style = stacked ? undefined : { flex: 1 };
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }
  return (
    <PressScale onPress={onPress} role="link" accessibilityLabel={spoken} containerStyle={style} style={{ flex: 1 }}>
      {body}
    </PressScale>
  );
}

function Stats({ profile }: { profile: Profile }) {
  const stacked = useStacked();
  const visit = profile.visit;
  return (
    <View className={stacked ? "gap-2.5" : "flex-row gap-2.5"}>
      {profile.stats.map((stat) => (
        <StatTile
          key={stat.key}
          stat={stat}
          stacked={stacked}
          deceased={profile.deceased}
          confirmed={stat.key === "birth" && profile.certainty.birth === "confirmed"}
          onPress={
            stat.key === "place" && visit
              ? () => router.push({ pathname: "/institutions/[slug]", params: { slug: visit.institutionSlug } })
              : undefined
          }
        />
      ))}
    </View>
  );
}

/** A panda's round face: the photo, or its first character on the fill. */
function Face({ member, size, className }: { member: FamilyMember; size: number; className?: string }) {
  return (
    <View
      className={cn("items-center justify-center overflow-hidden bg-secondary", className)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      {member.photoUrl ? (
        <Image source={member.photoUrl} style={{ width: size, height: size }} contentFit="cover" accessible={false} />
      ) : (
        <Text className="font-bold text-muted-foreground" style={{ fontSize: Math.round(size * 0.4) }}>
          {member.name.slice(0, 1)}
        </Text>
      )}
    </View>
  );
}

const PARENT_FACE = 30;
const FACE_RING = 2;

/** 父母 and the latest move, as two rows; each opens the page that tells the rest. */
function KeyRows({ profile }: { profile: Profile }) {
  const parents = profile.family ? [profile.family.mother, profile.family.father].filter((m): m is FamilyMember => m !== null) : [];
  const move = profile.move;
  if (parents.length === 0 && !move) return null;
  return (
    <ListSection>
      {parents.length > 0 ? (
        <ListCell
          leading={
            <View className="flex-row" accessible={false}>
              {parents.map((member, index) => (
                <View
                  key={member.id}
                  className={cn("rounded-pill border-card", index > 0 && "-ml-2.5")}
                  style={{ borderWidth: index > 0 ? FACE_RING : 0 }}
                >
                  <Face member={member} size={PARENT_FACE} />
                </View>
              ))}
            </View>
          }
          label={parents.map((member) => member.name).join(" · ")}
          meta="父母"
          accessibilityLabel={`父母，${parents.map((member) => `${member.relation}${member.name}`).join("，")}`}
          href={{ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } }}
          last={!move}
        />
      ) : null}
      {move ? (
        <ListCell
          leading={
            <View className="items-center" style={{ width: PARENT_FACE * 2 - 10 }}>
              <Icon icon={Plane} tone="label" />
            </View>
          }
          label={`${move.from} → ${move.to}`}
          accessibilityLabel={`${move.year} 年从${move.from}到${move.to}`}
          meta={move.year}
          href={{ pathname: "/pandas/[slug]/timeline", params: { slug: profile.slug } }}
          last
        />
      ) : null}
    </ListSection>
  );
}

function timelineItems(profile: Profile): TimelineItem[] {
  return [...profile.events]
    .reverse()
    .map((event) => ({ key: event.id, date: event.date, meta: KIND_WORD[event.kind], title: event.text }));
}

/** Who the events come from, as a seal: the newest event's first source, said short. */
function Seal({ source }: { source: Profile["sources"][number] }) {
  return (
    <Pressable
      role="link"
      accessibilityLabel={`来源，${source.publisher}`}
      accessibilityHint="在浏览器中打开"
      hitSlop={10}
      onPress={() => void WebBrowser.openBrowserAsync(source.url)}
      className="flex-row items-center gap-1 active:opacity-60"
    >
      <Icon icon={BadgeCheck} size={13} tone="tint" strokeWidth={2.2} />
      <Text variant="footnote" className="font-semibold text-muted-foreground" numberOfLines={1}>
        {shortPublisher(source.publisher)}
      </Text>
    </Pressable>
  );
}

function eventSource(profile: Profile) {
  const sources = new Map(profile.sources.map((source) => [source.id, source]));
  for (const event of [...profile.events].reverse()) {
    const found = event.sourceIds.map((id) => sources.get(id)).find(Boolean);
    if (found) return found;
  }
  return null;
}

/** 经历: the latest few events in a card, newest first, under the seal of who recorded them. */
function Experience({ profile }: { profile: Profile }) {
  const items = timelineItems(profile).slice(0, 3);
  if (items.length === 0) return null;
  const source = eventSource(profile);
  return (
    <View className="gap-3 bg-card px-4 py-3.5" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          role="link"
          accessibilityLabel="经历，看时间线"
          hitSlop={10}
          onPress={() => router.push({ pathname: "/pandas/[slug]/timeline", params: { slug: profile.slug } })}
          className="active:opacity-60"
        >
          <Text variant="subheadline" className="font-bold">
            经历
          </Text>
        </Pressable>
        {source ? <Seal source={source} /> : null}
      </View>
      <Timeline items={items} />
    </View>
  );
}

const TREE_PARENT = 52;
const TREE_CHILD = 46;
/** How many of the focus panda's generation the tree draws; the list under it names them all. */
const TREE_CHILDREN = 4;
const LINE = "bg-tertiary-foreground";

function year(member: FamilyMember) {
  return member.birthDate?.slice(0, 4) ?? "";
}

/** A face in the tree with its name and birth year; the focus panda is ringed in the vivid blue. */
function TreeNode({ member, size, focus = false }: { member: FamilyMember; size: number; focus?: boolean }) {
  const face = (
    <View className={cn("rounded-pill", focus ? "border-graphic" : "border-transparent")} style={{ borderWidth: 2, padding: 3 }}>
      <Face member={member} size={size} />
    </View>
  );
  const body = (
    <View className="items-center gap-0.5">
      {face}
      <Text variant="subheadline" className="font-semibold" numberOfLines={1}>
        {member.name}
      </Text>
      {year(member) ? (
        <Text variant="footnote" className="tabular-nums text-muted-foreground">
          {year(member)}
        </Text>
      ) : null}
    </View>
  );
  const spoken = `${focus ? "" : `${member.relation}，`}${member.name}${year(member) ? `，${year(member)} 年出生` : ""}`;
  if (focus) {
    return (
      <View accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }
  return (
    <Pressable role="link" accessibilityLabel={spoken} onPress={() => openPanda(member.slug)} className="active:opacity-60">
      {body}
    </Pressable>
  );
}

/** The focus panda and its nearest siblings by birth, at most TREE_CHILDREN. */
function treeChildren(family: Family): FamilyMember[] {
  const all = family.generation
    .flatMap((group) => group.members)
    .sort((a, b) => (a.birthDate ?? "").localeCompare(b.birthDate ?? ""));
  const at = Math.max(0, all.findIndex((member) => member.id === family.focus.id));
  const start = Math.max(0, Math.min(at - (TREE_CHILDREN - 1), all.length - TREE_CHILDREN));
  return all.slice(start, start + TREE_CHILDREN);
}

/** Parents over the focus panda's generation, joined by drawn lines. */
function Tree({ family }: { family: Family }) {
  const parents = [family.father, family.mother].filter((member): member is FamilyMember => member !== null);
  const children = treeChildren(family);
  const n = children.length;
  return (
    <View className="bg-card px-2.5 pt-4 pb-4" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
      <View className="flex-row justify-center gap-14">
        {parents.map((member) => (
          <TreeNode key={member.id} member={member} size={TREE_PARENT} />
        ))}
      </View>
      <View aria-hidden accessible={false} className="items-center">
        {parents.length === 2 ? (
          <View className="flex-row" style={{ width: 132, height: 12 }}>
            <View className={LINE} style={{ width: 1.5 }} />
            <View className="flex-1 justify-end">
              <View className={LINE} style={{ height: 1.5 }} />
            </View>
            <View className={LINE} style={{ width: 1.5 }} />
          </View>
        ) : null}
        <View className={LINE} style={{ width: 1.5, height: parents.length === 2 ? 8 : 16 }} />
      </View>
      <View aria-hidden accessible={false} style={{ height: 1.5 }}>
        {n > 1 ? (
          <View className={cn("absolute top-0 bottom-0", LINE)} style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />
        ) : null}
      </View>
      <View className="flex-row">
        {children.map((member) => (
          <View key={member.id} className="flex-1 items-center">
            <View aria-hidden accessible={false} className={LINE} style={{ width: 1.5, height: 12 }} />
            <TreeNode member={member} size={TREE_CHILD} focus={member.id === family.focus.id} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** 兄姐 when every sibling is older, 弟妹 when every one is younger, else 兄弟姐妹. */
function siblingsTitle(siblings: FamilyMember[], focus: FamilyMember) {
  const born = focus.birthDate;
  if (born && siblings.every((member) => member.birthDate && member.birthDate < born)) return "兄姐";
  if (born && siblings.every((member) => member.birthDate && member.birthDate > born)) return "弟妹";
  return "兄弟姐妹";
}

function MemberList({ title, members }: { title: string; members: FamilyMember[] }) {
  return (
    <View>
      <SectionHeader title={title} count={String(members.length)} />
      <ListSection>
        {members.map((member, index) => (
          <ListCell
            key={member.id}
            leading={<Face member={member} size={40} />}
            label={member.name}
            meta={year(member)}
            accessibilityLabel={`${member.relation}，${member.name}${year(member) ? `，${year(member)} 年出生` : ""}`}
            onPress={() => openPanda(member.slug)}
            role="link"
            last={index === members.length - 1}
          />
        ))}
      </ListSection>
    </View>
  );
}

function FamilyTab({ profile }: { profile: Profile }) {
  const family = profile.family;
  const tree = { pathname: "/pandas/[slug]/family" as const, params: { slug: profile.slug } };
  if (!family) {
    return (
      <ListSection>
        <ListCell icon={Network} label="家族树" href={tree} last />
      </ListSection>
    );
  }
  const siblings = family.generation
    .flatMap((group) => group.members)
    .filter((member) => member.id !== family.focus.id)
    .sort((a, b) => (a.birthDate ?? "").localeCompare(b.birthDate ?? ""));
  const children = [...family.children].sort((a, b) => (a.birthDate ?? "").localeCompare(b.birthDate ?? ""));
  return (
    <View className="gap-4">
      {family.father || family.mother ? <Tree family={family} /> : null}
      {siblings.length > 0 ? <MemberList title={siblingsTitle(siblings, family.focus)} members={siblings} /> : null}
      {children.length > 0 ? <MemberList title="子女" members={children} /> : null}
      <ListSection>
        <ListCell icon={Network} label="家族树" href={tree} last />
      </ListSection>
    </View>
  );
}

const GRID_GAP = 3;
const ALL = "全部";

/** "© Roshan Patel、Amaury Laporte": everyone whose photo is shown, once each. */
function creditsOf(photos: Photo[]) {
  const names = [...new Set(photos.map((photo) => photo.creator).filter((name): name is string => Boolean(name)))];
  return names.length > 0 ? `© ${names.join("、")}` : null;
}

function PhotoCell({ photo, size, index, slug }: { photo: Photo; size: number; index: number; slug: string }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/pandas/[slug]/photos", params: { slug } })}
      role="link"
      accessibilityLabel={`照片 ${index + 1}`}
    >
      <Image source={photo.url} style={{ width: size, height: size }} contentFit="cover" accessible={false} />
    </Pressable>
  );
}

function PhotosTab({ profile }: { profile: Profile }) {
  const [width, setWidth] = useState(0);
  const [source, setSource] = useState(ALL);
  const archives = [...new Set(profile.photos.map((photo) => photo.source).filter((name): name is string => Boolean(name)))];
  if (profile.photos.length === 0) {
    return (
      <ListSection>
        <ListCell label="有它的照片？告诉我们" tone="tint" onPress={() => correct(profile.slug)} last />
      </ListSection>
    );
  }
  const photos = source === ALL ? profile.photos : profile.photos.filter((photo) => photo.source === source);
  const cell = Math.floor((width - GRID_GAP * 2) / 3);
  const lead = cell * 2 + GRID_GAP;
  const [first, second, third, ...rest] = photos;
  const credits = creditsOf(photos);
  return (
    <View className="gap-2.5">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text variant="subheadline" className="font-semibold tabular-nums text-muted-foreground">
          {`${photos.length} 张`}
        </Text>
        {archives.length > 0 ? (
          <View className="flex-row gap-2">
            {[ALL, ...archives].map((name) => (
              <Chip key={name} label={name} appearance="ink" selected={source === name} onPress={() => setSource(name)} />
            ))}
          </View>
        ) : null}
      </View>
      <View
        className="overflow-hidden"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ gap: GRID_GAP, borderRadius: RADIUS.tile, borderCurve: "continuous" }}
      >
        {first && cell > 0 ? (
          <View className="flex-row" style={{ gap: GRID_GAP }}>
            <PhotoCell photo={first} size={lead} index={0} slug={profile.slug} />
            <View style={{ gap: GRID_GAP }}>
              {second ? <PhotoCell photo={second} size={cell} index={1} slug={profile.slug} /> : null}
              {third ? <PhotoCell photo={third} size={cell} index={2} slug={profile.slug} /> : null}
            </View>
          </View>
        ) : null}
        {rest.length > 0 && cell > 0 ? (
          <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
            {rest.map((photo, index) => (
              <PhotoCell key={photo.id} photo={photo} size={cell} index={index + 3} slug={profile.slug} />
            ))}
          </View>
        ) : null}
      </View>
      {credits ? (
        <Text variant="footnote" className="px-0.5 text-muted-foreground">
          {credits}
        </Text>
      ) : null}
    </View>
  );
}

function EventsList({ profile }: { profile: Profile }) {
  const items = timelineItems(profile);
  const timeline = { pathname: "/pandas/[slug]/timeline" as const, params: { slug: profile.slug } };
  return (
    <View className="gap-3">
      {items.length > 0 ? (
        <View className="bg-card px-4 py-3.5" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
          <Timeline items={items} />
        </View>
      ) : null}
      <ListSection>
        <ListCell icon={History} label="时间线" href={timeline} last={items.length > 0} />
        {items.length === 0 ? (
          <ListCell label="知道它的经历？告诉我们" tone="tint" onPress={() => correct(profile.slug)} last />
        ) : null}
      </ListSection>
    </View>
  );
}

function Memories({ profile }: { profile: Profile }) {
  const sources = new Map(profile.sources.map((source) => [source.id, source]));
  // 满月 and 满百天 are 里程碑, and go with its switch.
  const milestonesOn = useMilestonesOn();
  const memories = profile.memories.filter((memory) => milestonesOn || !isCubDay(memory));
  if (memories.length === 0) return null;
  return (
    <ListSection title={profile.deceased ? DECEASED_POLICY.heading : "那年今天"} titleIcon={CalendarHeart}>
      {memories.map((memory, index) => (
        <ListCell
          key={memory.key}
          label={memory.text}
          detail={sourceLine(memory, memory.sourceIds.map((id) => sources.get(id)).find(Boolean)) ?? undefined}
          lines={3}
          last={index === memories.length - 1}
        />
      ))}
    </ListSection>
  );
}

/** Sources a fan sees before asking for the rest; a long list would bury the actions below it. */
const SOURCES_SHOWN = 5;

function Sources({ sources }: { sources: Profile["sources"] }) {
  const [all, setAll] = useState(false);
  const shown = all ? sources : sources.slice(0, SOURCES_SHOWN);
  const hidden = sources.length - shown.length;
  return (
    <ListSection title="资料来源" titleIcon={Newspaper}>
      {shown.map((source, index) => (
        <ListCell
          key={source.id}
          role="link"
          label={source.title}
          detail={`${source.publisher}　${longDate(source.lastVerifiedOn)}`}
          accessibilityLabel={`${source.publisher}，${source.title}，核实于 ${longDate(source.lastVerifiedOn)}`}
          accessibilityHint="在浏览器中打开"
          onPress={() => void WebBrowser.openBrowserAsync(source.url)}
          last={hidden === 0 && index === shown.length - 1}
        />
      ))}
      {hidden > 0 ? <ListCell tone="tint" label={`显示全部 ${sources.length} 条`} onPress={() => setAll(true)} last /> : null}
    </ListSection>
  );
}

function NoPhoto({ profile }: { profile: Profile }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 64 }} className="px-gutter">
      <ListSection>
        <ListCell label="暂无照片" />
        <ListCell label="有它的照片？告诉我们" tone="tint" onPress={() => correct(profile.slug)} last />
      </ListSection>
    </View>
  );
}

type Tab = "overview" | "family" | "photos" | "events";
const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "概况" },
  { value: "family", label: "家族" },
  { value: "photos", label: "照片" },
  { value: "events", label: "动态" },
];

export default function ProfileScreen() {
  const { slug, tab: opened } = useLocalSearchParams<{ slug: string; tab?: string }>();
  const { data: profile, isError: failed, refetch } = useQuery(profileQueryOptions(slug));
  const { scrollY, onScroll, pastHero } = useHeroScroll(HERO);
  const [tab, setTab] = useState<Tab>(() => TABS.find((item) => item.value === opened)?.value ?? "overview");
  const page = String(useCSSVariable("--color-background"));

  if (!profile) {
    return (
      <View className="flex-1 bg-background">
        <HeroHeader title="" pastHero={false} />
        {failed ? (
          <View className="px-gutter pt-28">
            <LoadFailed message="资料暂时打不开。" onRetry={() => void refetch()} />
          </View>
        ) : (
          <View className="gap-4" accessibilityLabel="正在加载资料">
            <Skeleton className="h-96 w-full rounded-none" />
            <View className="gap-4 px-gutter">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-12 w-full rounded-pill" />
              <View className="flex-row gap-2.5">
                {[0, 1, 2].map((key) => (
                  <Skeleton key={key} className="h-24 flex-1 rounded-tile" />
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  const cover = profile.photos[0];
  const share = () => router.push({ pathname: "/pandas/[slug]/share", params: { slug: profile.slug } });
  const sexIcon = profile.sex === "male" ? Mars : profile.sex === "female" ? Venus : null;
  return (
    <View className="flex-1 bg-background">
      <HeroHeader
        title={profile.name}
        pastHero={pastHero}
        onShare={share}
        menu={[
          {
            label: "加入合集",
            icon: FolderHeart,
            onPress: () => router.push({ pathname: "/pandas/[slug]/collect", params: { slug: profile.slug } }),
          },
          { label: "资料有误", icon: Flag, onPress: () => correct(profile.slug) },
        ]}
      />
      <Animated.ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="pb-16"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {cover ? (
          <StretchyHero
            url={cover.url}
            height={HERO}
            scrollY={scrollY}
            label={`查看${profile.name}的照片，共 ${profile.photos.length} 张`}
            onPress={() => router.push({ pathname: "/pandas/[slug]/photos", params: { slug: profile.slug } })}
            overlay={<HeroFade id={`hero-${profile.id}`} page={page} />}
          />
        ) : (
          <NoPhoto profile={profile} />
        )}
        <Animated.View entering={PAGE_ENTER} className="gap-4 px-gutter" style={cover ? { marginTop: -OVERLAP } : undefined}>
          <View>
            <View className="flex-row items-center gap-2">
              <Text variant="display" className="shrink">
                {profile.name}
              </Text>
            </View>
            {profile.nameEn || sexIcon ? (
              <View
                className="flex-row items-center gap-1.5"
                accessible
                accessibilityLabel={`${profile.nameEn ?? ""}${profile.sex === "male" ? "，雄性" : profile.sex === "female" ? "，雌性" : ""}`}
              >
                {profile.nameEn ? (
                  <Text variant="subheadline" className="text-muted-foreground">
                    {profile.nameEn}
                  </Text>
                ) : null}
                {sexIcon ? <Icon icon={sexIcon} size="footnote" tone="secondary" strokeWidth={2.4} /> : null}
              </View>
            ) : null}
          </View>
          <PandaActions pandaId={profile.id} name={profile.name} deceased={profile.deceased} />
          {tab === "overview" ? <Stats profile={profile} /> : null}
          <View className="pt-0.5">
            <Segmented value={tab} options={TABS} onChange={setTab} accessibilityLabel="资料分区" />
          </View>
          {tab === "overview" ? (
            <View className="gap-3">
              <KeyRows profile={profile} />
              <Experience profile={profile} />
              <CompareRows slug={profile.slug} />
              {profile.memories.length > 0 ? <Memories profile={profile} /> : null}
              {profile.sources.length > 0 ? <Sources sources={profile.sources} /> : null}
              {cover?.credit ? (
                <Text variant="footnote" className="px-4 text-muted-foreground">
                  {`封面照片：${cover.credit}`}
                </Text>
              ) : null}
            </View>
          ) : tab === "family" ? (
            <FamilyTab profile={profile} />
          ) : tab === "photos" ? (
            <PhotosTab profile={profile} />
          ) : (
            <EventsList profile={profile} />
          )}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
