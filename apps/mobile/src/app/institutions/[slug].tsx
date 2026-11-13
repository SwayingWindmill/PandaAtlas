import { Image } from "expo-image";
import { Link, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { ICON_INSET, ListCell, ListSection, SectionTitle, useSingleColumn } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  Binoculars,
  CalendarCheck,
  Clock,
  History,
  Globe,
  Info,
  type LucideIcon,
  MapPin,
  Navigation,
  PawPrint,
  Sunrise,
  Ticket,
  TramFront,
  Users,
  Video,
} from "@/components/icons";
import { IconRow } from "@/components/icon-row";
import { Segmented } from "@/components/segmented";
import { StatTile } from "@/components/stat-tile";
import { SourceBadge } from "@/components/source-badge";
import { TimeBand } from "@/components/time-band";
import { LoadFailed } from "@/components/load-failed";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { HeroHeader, useHeroScroll } from "@/components/hero-header";
import { StretchyHero } from "@/components/stretchy-hero";
import { ViewingTiming } from "@/features/viewing/viewing-timing";
import { PAGE_ENTER } from "@/design/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { useInstitutionHero } from "@/features/institutions/institution-hero";
import { useFollowVenue } from "@/features/engagement/followed-venues";
import {
  type Facility,
  type InstitutionDetail,
  addressOf,
  guideVerifiedOn,
  hasGuide,
  hostname,
  isFreeEntry,
  loadInstitution,
  unseenResidents,
} from "@/features/institutions/institutions";
import type { FormerResident } from "@/features/institutions/residents";
import { loadSeenIds } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { VenueNewsSection } from "@/features/venue-news/venue-news-section";
import { FacilityVisits } from "@/features/visits/facility-visits";
import { usePandaCover } from "@/lib/covers";
import { HAIRLINE, RADIUS, pageColumn } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** Under a resident's photo while it loads, dark enough that the white name already reads. */
const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const GAP = semantic.spacing.row.value;
const FACE = 72;

function openMaps(name: string, { latitude, longitude }: NonNullable<Facility["coordinates"]>) {
  const label = encodeURIComponent(name);
  const url = Platform.select({
    ios: `maps:?q=${label}&ll=${latitude},${longitude}`,
    default: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
  });
  void Linking.openURL(url);
}

function NavigateCell({ facility, detail }: { facility: Facility; detail?: string }) {
  const coordinates = facility.coordinates;
  if (!coordinates) return null;
  return (
    <ListCell
      icon={Navigation}
      label="导航过去"
      detail={detail}
      tone="tint"
      accessibilityLabel={`在地图中导航到${facility.name}`}
      onPress={() => openMaps(facility.name, coordinates)}
      last
    />
  );
}

/** A resident as a portrait photograph with its name in white over the scrim, as Music lays out artists. */
function ResidentTile({ panda, width }: { panda: PandaListItem; width: number }) {
  const photo = usePandaCover(panda.id);
  const height = Math.round((width * 5) / 4);
  return (
    <Link href={{ pathname: "/pandas/[slug]", params: { slug: panda.slug } }} asChild>
      <Link.AppleZoom>
        <PressScale role="link" accessibilityLabel={panda.name} style={{ width, height }}>
          <View
            style={{ flex: 1, borderRadius: RADIUS.tile, borderCurve: "continuous", overflow: "hidden", backgroundColor: PLACEHOLDER }}
          >
            {photo ? (
              <Image
                source={photo}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                contentFit="cover"
                accessible={false}
                transition={200}
              />
            ) : null}
            <Scrim id={`resident-${panda.id}`} height="45%" />
            {/* Padding on the wrapper: on web a padded, clamped Text shows a third line in its padding. */}
            <View className="absolute right-0 bottom-0 left-0 p-3">
              <Text variant="title" role="none" className="text-on-media" numberOfLines={2}>
                {panda.name}
              </Text>
            </View>
            <PhotoOutline radius={RADIUS.tile} />
          </View>
        </PressScale>
      </Link.AppleZoom>
    </Link>
  );
}

function Residents({ pandas }: { pandas: PandaListItem[] }) {
  const { width } = useWindowDimensions();
  // Two large tiles a row, one at the largest sizes or in a narrow window, where the name needs the width.
  const columns = useSingleColumn() ? 1 : 2;
  const tile = Math.floor((pageColumn(width) - GAP * (columns - 1)) / columns);
  return (
    <View className="gap-1.5">
      <SectionTitle title={`住在这里的熊猫　${pandas.length} 只`} icon={PawPrint} />
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {pandas.map((panda) => (
          <ResidentTile key={panda.id} panda={panda} width={tile} />
        ))}
      </View>
    </View>
  );
}

function spanOf({ from, to }: FormerResident): string | undefined {
  if (from !== null && to !== null) return from === to ? `${from}` : `${from}–${to}`;
  if (to !== null) return `${to} 年离开`;
  return from !== null ? `${from} 年起` : undefined;
}

function Former({ pandas }: { pandas: FormerResident[] }) {
  return (
    <ListSection title={`以前住过　${pandas.length} 只`} titleIcon={History}>
      {pandas.map((item, index) => (
        <ListCell
          key={item.panda.id}
          label={item.panda.name}
          detail={item.bornHere ? "在这里出生" : undefined}
          meta={spanOf(item)}
          onPress={() => openPanda(item.panda.slug)}
          last={index === pandas.length - 1}
        />
      ))}
    </ListSection>
  );
}

function ResidentFace({ panda }: { panda: PandaListItem }) {
  return (
    <PressScale role="link" accessibilityLabel={panda.name} onPress={() => openPanda(panda.slug)} className="items-center gap-1.5" style={{ width: FACE }}>
      <PandaThumb pandaId={panda.id} name={panda.name} size={FACE} shape="round" />
      <Text variant="subheadline" className="font-semibold" numberOfLines={1}>
        {panda.name}
      </Text>
    </PressScale>
  );
}

function ResidentFaces({ pandas, onAll }: { pandas: PandaListItem[]; onAll: () => void }) {
  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-baseline justify-between">
        <SectionTitle title="住在这里" icon={PawPrint} />
        <Pressable role="button" accessibilityLabel="看全部熊猫" onPress={onAll} hitSlop={8} className="active:opacity-60">
          <Text variant="body" className="text-primary">
            全部
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-section px-gutter">
        {pandas.map((panda) => (
          <ResidentFace key={panda.id} panda={panda} />
        ))}
      </ScrollView>
    </View>
  );
}

function Badges({ institution }: { institution: InstitutionDetail }) {
  const count = institution.residents.length;
  const badges = [
    isFreeEntry(institution.facilities) ? { icon: Ticket, label: "免费", spoken: "免费参观" } : null,
    institution.liveCamUrl ? { icon: Video, label: "直播", spoken: "有官方直播" } : null,
    count > 0 ? { icon: PawPrint, label: `${count} 只`, spoken: `住着 ${count} 只熊猫` } : null,
  ].filter((badge) => badge !== null);
  return (
    <View className="flex-row items-center gap-stack-tight">
      <View className="min-w-0 flex-1 flex-row flex-wrap gap-stack-tight">
        {badges.map((badge) => (
          <View
            key={badge.label}
            accessible
            accessibilityLabel={badge.spoken}
            className="flex-row items-center gap-hair-gap rounded-pill bg-secondary px-row"
            style={{ height: 32 }}
          >
            <Icon icon={badge.icon} size="footnote" tone="label" />
            <Text variant="subheadline" className="font-semibold">
              {badge.label}
            </Text>
          </View>
        ))}
      </View>
      <FollowButton slug={institution.slug} name={institution.name} />
    </View>
  );
}

function FollowButton({ slug, name }: { slug: string; name: string }) {
  const { following, toggle } = useFollowVenue(slug);
  return (
    <Pressable
      role="button"
      accessibilityLabel={following ? `已关注${name}，点按取消` : `关注${name}`}
      onPress={toggle}
      hitSlop={6}
      className={cn("items-center justify-center rounded-pill px-section active:opacity-80", following ? "bg-highlight-soft" : "bg-button")}
      style={{ height: 32 }}
    >
      <Text variant="subheadline" className={cn("font-semibold", following ? "text-primary" : "text-primary-foreground")}>
        {following ? "已关注" : "关注"}
      </Text>
    </Pressable>
  );
}

const TABS = ["overview", "pandas", "guide"] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string | undefined): value is Tab => TABS.some((tab) => tab === value);

function Overview({ institution, onPandas }: { institution: InstitutionDetail; onPandas: () => void }) {
  const counts = [
    { label: "现在住这里", value: institution.residents.length },
    { label: "以前住过", value: institution.former.length },
    { label: "在这里出生", value: institution.bornHere },
  ].filter((count) => count.value > 0);
  const location = institution.facilities.find((facility) => facility.coordinates);
  return (
    <>
      {institution.summary ? <Text variant="body">{institution.summary}</Text> : null}
      {counts.length > 1 ? (
        <View className="flex-row gap-stack-tight">
          {counts.map((count) => (
            <StatTile key={count.label} label={count.label} value={`${count.value} 只`} />
          ))}
        </View>
      ) : null}
      {institution.residents.length > 0 ? <ResidentFaces pandas={institution.residents} onAll={onPandas} /> : null}
      <VenueNewsSection institutionSlug={institution.slug} />
      {location ? (
        <ListSection title="位置" titleIcon={MapPin}>
          <NavigateCell facility={location} detail={addressOf(location)} />
        </ListSection>
      ) : null}
      {institution.liveCamUrl ? (
        <ListSection>
          <ListCell
            icon={Video}
            label="看官方直播"
            tone="tint"
            role="link"
            accessibilityHint="在浏览器中打开"
            onPress={() => void Linking.openURL(institution.liveCamUrl!)}
            last
          />
        </ListSection>
      ) : null}
      <Sources institution={institution} />
    </>
  );
}

/** The glyph for each 参观攻略 fact, the way Maps marks hours, address and transit on a place card. */
const GUIDE_ICON: Record<string, LucideIcon> = {
  开放时间: Clock,
  门票: Ticket,
  熊猫馆: PawPrint,
  地址: MapPin,
  什么时候去: Sunrise,
  怎么找到熊猫: Binoculars,
  怎么去: TramFront,
  提示: Info,
};

/** "09:00–17:00" as one span, or null when the hours are seasonal, several, or free text. */
function singleSpan(value: string): { open: string; close: string } | null {
  const spans = [...value.matchAll(/(\d{1,2}:\d{2})\s*[-–—~至到]\s*(\d{1,2}:\d{2})/g)];
  if (spans.length !== 1) return null;
  const pad = (time: string) => time.padStart(5, "0");
  return { open: pad(spans[0]![1]!), close: pad(spans[0]![2]!) };
}

function GuideRow({ label, value, last }: { label: string; value: string; last: boolean }) {
  // One plain span of opening hours also draws as a band of the day. No "now" marker: the
  // venue's time zone is not in the guide, so the band says when, not whether it is open.
  const span = label === "开放时间" ? singleSpan(value) : null;
  return (
    <View accessible accessibilityLabel={`${label}，${value}`}>
      <View className="flex-row gap-3 px-4 py-3">
        <Icon icon={GUIDE_ICON[label] ?? Info} style={{ marginTop: 6 }} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="footnote" className="text-muted-foreground">
            {label}
          </Text>
          <Text variant="body">{value}</Text>
          {span ? (
            <View className="pt-hair-gap" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <TimeBand open={span.open} close={span.close} />
            </View>
          ) : null}
        </View>
      </View>
      {last ? null : <View className="bg-border" style={[{ height: HAIRLINE }, ICON_INSET]} />}
    </View>
  );
}

function FacilityGuide({ facility, title }: { facility: Facility; title?: string }) {
  const rows = [
    ...facility.guide,
    ...facility.tips.map((tip) => ({ label: tip.label, value: tip.text })),
  ];
  const coordinates = facility.coordinates;
  if (rows.length === 0 && !coordinates) return null;
  return (
    <ListSection title={title}>
      {rows.map((row, index) => (
        <GuideRow
          key={`${row.label}-${index}`}
          label={row.label}
          value={row.value}
          last={index === rows.length - 1 && !coordinates}
        />
      ))}
      <NavigateCell facility={facility} />
    </ListSection>
  );
}

/**
 * 参观攻略: what a visitor checks before going, folded into the base's own page rather than a page
 * of its own. Only published guide lines appear; hours and prices change, so the section says when
 * they were checked and sends the visitor to the official site. With no guide and no site it is left out.
 */
function VisitGuide({ institution, unseen }: { institution: InstitutionDetail; unseen: PandaListItem[] | null }) {
  const guided = institution.facilities.filter(hasGuide);
  const several = institution.facilities.length > 1;
  const verifiedOn = guideVerifiedOn(guided);
  const sources = [...new Set(guided.flatMap((facility) => facility.sourceUrls))];
  if (guided.length === 0 && !institution.websiteUrl) return null;
  return (
    <View className="gap-4">
      <View className="gap-hair-gap">
        <View className="flex-row items-center gap-stack-tight">
          <Icon icon={Ticket} size="title3" />
          <Text variant="title" role="heading">
            参观攻略
          </Text>
        </View>
        {/* The date is the caveat: hours and prices are as checked then; 出发前看官网 below says the rest. */}
        {guided.length > 0 && verifiedOn ? (
          <IconRow
            icon={CalendarCheck}
            text={longDate(verifiedOn)}
            accessibilityLabel={`开放时间和门票会调整，以官方公布为准。核实于 ${longDate(verifiedOn)}`}
          />
        ) : null}
      </View>
      {unseen && institution.residents.length > 0 ? (
        <ListSection title="这次去" titleIcon={Users}>
          <ListCell
            label={unseen.length === 0 ? "住在这里的你都见过了" : "还没见过"}
            detail={unseen.length === 0 ? undefined : unseen.map((panda) => panda.name).join("、")}
            meta={unseen.length === 0 ? undefined : `${unseen.length} 只`}
            last
          />
        </ListSection>
      ) : null}
      {guided.map((facility) => (
        <View key={facility.id} className="gap-4">
          {several ? (
            <Text variant="headline" role="heading">
              {facility.name}
            </Text>
          ) : null}
          <ViewingTiming facility={facility} />
          <FacilityGuide facility={facility} title="须知" />
        </View>
      ))}
      {institution.websiteUrl ? (
        <ListSection>
          <ListCell
            icon={Globe}
            label="出发前看官网"
            meta={hostname(institution.websiteUrl)}
            tone="tint"
            role="link"
            accessibilityHint="在浏览器中打开"
            onPress={() => void Linking.openURL(institution.websiteUrl!)}
            last
          />
        </ListSection>
      ) : null}
      {sources.length > 0 ? (
        <View className="flex-row flex-wrap gap-x-row gap-y-hair-gap px-4">
          {sources.map((url) => (
            <SourceBadge
              key={url}
              name={hostname(url)}
              icon={Globe}
              accessibilityLabel={`攻略出处 ${hostname(url)}`}
              onPress={() => void Linking.openURL(url)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Sources({ institution }: { institution: InstitutionDetail }) {
  if (!institution.verifiedOn && institution.sources.length === 0) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-x-row gap-y-hair-gap px-4">
      {institution.verifiedOn ? (
        <IconRow
          icon={CalendarCheck}
          text={longDate(institution.verifiedOn)}
          accessibilityLabel={`核实于 ${longDate(institution.verifiedOn)}`}
        />
      ) : null}
      {institution.sources.map((url) => (
        <SourceBadge
          key={url}
          name={hostname(url)}
          icon={Globe}
          accessibilityLabel={`来源 ${hostname(url)}`}
          onPress={() => void Linking.openURL(url)}
        />
      ))}
    </View>
  );
}

/** Hero height below the status bar, a little shorter than a panda's: the name sits on it. */
const HERO = 300;

/** The name and meta in white over the hero's scrim, as Music sets an artist's name on the photo. */
function HeroTitle({ institution }: { institution: InstitutionDetail }) {
  return (
    <View pointerEvents="none" className="absolute right-0 bottom-0 left-0 gap-1 px-4 pb-4">
      <Text variant="display" className="text-on-media" numberOfLines={3}>
        {institution.name}
      </Text>
      {institution.meta ? (
        <Text variant="footnote" className="font-semibold text-on-media/85">
          {institution.meta}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The top of a page with no curated photo: a plate in the brand's soft tint fading into the page,
 * with the name in the label color at its foot, so the page keeps the hero's height and rhythm
 * without showing a photo that was not reviewed. While the covers are still being looked up the
 * plate stands empty, so a photo that then arrives replaces it without moving the content.
 */
function PlateHero({ institution, pending }: { institution: InstitutionDetail; pending: boolean }) {
  const insets = useSafeAreaInsets();
  const [tint, ground] = useCSSVariable(["--color-highlight-soft", "--color-background"]);
  return (
    <View style={{ height: HERO + insets.top }}>
      <Svg aria-hidden style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="institution-plate" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={String(tint)} stopOpacity={1} />
            <Stop offset="0.55" stopColor={String(tint)} stopOpacity={0.6} />
            <Stop offset="1" stopColor={String(ground)} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#institution-plate)" />
      </Svg>
      {pending ? null : (
        <View className="absolute right-0 bottom-0 left-0 gap-hair-gap px-inset pb-inset">
          <Text variant="display" numberOfLines={3}>
            {institution.name}
          </Text>
          {institution.meta ? (
            <Text variant="footnote" className="font-semibold text-muted-foreground">
              {institution.meta}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function InstitutionScreen() {
  const params = useLocalSearchParams<{ slug: string; tab?: string }>();
  const slug = params.slug;
  const [institution, setInstitution] = useState<InstitutionDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : "overview");
  const hero = useInstitutionHero(institution?.residents ?? null);
  const { state } = useSession();
  const signedIn = state.status === "signedIn";
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    // 见过 is a nicety on the 攻略: signed out, or if it fails, the row is simply left out.
    let live = true;
    loadSeenIds()
      .then((ids) => live && setSeen(ids))
      .catch(() => live && setSeen(null));
    return () => {
      live = false;
    };
  }, [signedIn]);
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, pastHero } = useHeroScroll(HERO);

  const load = useCallback(() => {
    loadInstitution(slug)
      .then(setInstitution)
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  if (!institution) {
    return (
      <View className="flex-1 bg-background">
        <HeroHeader title="" pastHero={false} />
        {failed ? (
          <View className="px-gutter" style={{ paddingTop: insets.top + 64 }}>
            <LoadFailed message="这一页暂时打不开。" onRetry={retry} />
          </View>
        ) : (
          <View className="gap-4" accessibilityLabel="正在加载">
            <Skeleton className="w-full rounded-none" style={{ height: HERO + insets.top }} />
            <View className="flex-row gap-3 px-4">
              <Skeleton className="h-56 flex-1 rounded-tile" />
              <Skeleton className="h-56 flex-1 rounded-tile" />
            </View>
          </View>
        )}
      </View>
    );
  }

  const unseen = signedIn && seen ? unseenResidents(institution.residents, seen) : null;
  const tabs = [
    { value: "overview" as const, label: "概况" },
    institution.residents.length + institution.former.length > 0 ? { value: "pandas" as const, label: "熊猫" } : null,
    institution.facilities.length > 0 || institution.websiteUrl ? { value: "guide" as const, label: "攻略" } : null,
  ].filter((option) => option !== null);
  const shown = tabs.some((option) => option.value === tab) ? tab : "overview";

  return (
    <View className="flex-1 bg-background">
      <HeroHeader title={institution.name} pastHero={pastHero} />
      <Animated.ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="pb-16"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {hero ? (
          <StretchyHero
            url={hero.url}
            height={HERO}
            scrollY={scrollY}
            label={`${institution.name}，照片里是${hero.pandaName}`}
            overlay={
              <>
                <Scrim id="institution-hero" height="70%" />
                <HeroTitle institution={institution} />
              </>
            }
          />
        ) : (
          <PlateHero institution={institution} pending={hero === undefined} />
        )}
        <Animated.View entering={PAGE_ENTER} className="gap-7 bg-background px-gutter pt-4">
          <View className="gap-section">
            <Badges institution={institution} />
            {tabs.length > 1 ? (
              <Segmented value={shown} options={tabs} onChange={setTab} accessibilityLabel={`${institution.name}的页面`} />
            ) : null}
          </View>
          {shown === "overview" ? <Overview institution={institution} onPandas={() => setTab("pandas")} /> : null}
          {shown === "pandas" ? (
            <>
              {institution.residents.length > 0 ? <Residents pandas={institution.residents} /> : null}
              {institution.former.length > 0 ? <Former pandas={institution.former} /> : null}
            </>
          ) : null}
          {shown === "guide" ? (
            <>
              <VisitGuide institution={institution} unseen={unseen} />
              {institution.facilities.length > 0 ? <FacilityVisits facilities={institution.facilities} /> : null}
            </>
          ) : null}
          {hero?.credit ? (
            <Text variant="footnote" className="px-4 text-muted-foreground">
              {`顶部照片：${hero.pandaName}，${hero.credit}`}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
